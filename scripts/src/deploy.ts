// Deploy the Nafuda name tree (docs/plan/slab-title-plan.md §4, steps 1–8).
// Idempotent: each step checks chain state first and is skipped if already done.
//
//   npm run deploy -- --network fork      (anvil --fork-url $SEPOLIA_RPC_URL)
//   npm run deploy -- --network sepolia
//
// Resulting tree:
//   <name>.eth            operator; subregistry = nafudaRegistry
//   psa-sim.<name>.eth    grader;   subregistry = psaRegistry, resolver = TitleController
//   psaRegistry root      controller: REGISTRAR; grader: GRADER_FINAL_ROOT_ROLES → emancipated

import {
  createTestClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  labelhash,
  maxUint256,
  parseEventLogs,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { sepolia } from 'viem/chains'
import { beta } from './addresses.ts'
import { loadConfig, networkFromArgs, type Role } from './config.ts'
import {
  ALL_ROLES,
  GRADER_FINAL_ROOT_ROLES,
  GRADER_LABEL,
  GRADER_NAME,
  GRADER_NAME_TOKEN_ROLES,
  MAX_UINT64,
  ROLE,
  ROOT_NAME_DURATION,
  confirm,
  deleteSecret,
  dns,
  loadSecret,
  loadState,
  sameAddress,
  saveSecret,
  saveState,
  skip,
  titleControllerArtifact,
} from './lib.ts'

const cfg = loadConfig(networkFromArgs())
const { publicClient: client, accounts, nameLabel } = cfg
const operator = accounts.operator.address
const grader = accounts.grader.address
const state = loadState(cfg.network, nameLabel)

const ethRegistry = beta('ETHRegistry')
const ethRegistrar = beta('ETHRegistrar')
const mockUsdc = beta('MockUSDC')
const factory = beta('VerifiableFactory')
const userRegistryImpl = beta('UserRegistryImpl')
const registryAbi = userRegistryImpl.abi
const controllerArtifact = titleControllerArtifact()

async function hasCode(address?: Address) {
  if (!address) return false
  const code = await client.getCode({ address })
  return !!code && code !== '0x'
}

async function send(role: Role, label: string, request: Parameters<ReturnType<typeof cfg.wallet>['writeContract']>[0]) {
  const hash = await cfg.wallet(role).writeContract(request)
  state.txs[label] = hash
  saveState(state)
  return confirm(client, label, hash)
}

console.log(`== deploy ${nameLabel}.eth on ${cfg.network} ==`)

// 1. Registries (UserRegistry proxies via the official VerifiableFactory)
async function deployRegistry(key: 'nafudaRegistry' | 'psaRegistry', admin: Address): Promise<Address> {
  if (await hasCode(state[key])) {
    skip(`deploy ${key}`, state[key]!)
    return state[key]!
  }
  const initData = encodeFunctionData({
    abi: registryAbi,
    functionName: 'initialize',
    args: [[{ account: admin, roleBitmap: ALL_ROLES }]],
  })
  const salt = BigInt(keccak256(encodeAbiParameters([{ type: 'bytes' }, { type: 'string' }], [initData, `${nameLabel}:${key}`])))
  const receipt = await send('operator', `deploy ${key}`, {
    address: factory.address,
    abi: factory.abi,
    functionName: 'deployProxy',
    args: [userRegistryImpl.address, salt, initData],
  })
  const [event] = parseEventLogs({ abi: factory.abi, eventName: 'ProxyDeployed', logs: receipt.logs }) as unknown as [
    { args: { proxyAddress: Address } },
  ]
  state[key] = event.args.proxyAddress
  saveState(state)
  return state[key]!
}

const nafudaRegistry = await deployRegistry('nafudaRegistry', operator)
const psaRegistry = await deployRegistry('psaRegistry', grader)

// 2. TitleController
if (await hasCode(state.titleController)) {
  skip('deploy TitleController', state.titleController!)
} else {
  const hash = await cfg.wallet('operator').deployContract({
    abi: controllerArtifact.abi,
    bytecode: controllerArtifact.bytecode,
    args: [psaRegistry, grader, dns(`${GRADER_LABEL}.${nameLabel}.eth`), GRADER_NAME],
  })
  state.txs['deploy TitleController'] = hash
  const receipt = await confirm(client, 'deploy TitleController', hash)
  state.titleController = receipt.contractAddress!
  saveState(state)
}
const controller = state.titleController!

// 3. <name>.eth via ETHRegistrar commit-reveal, with nafudaRegistry as its subregistry.
//    The commitment is computed locally so the label never reaches the RPC before commit.
const nameId = BigInt(labelhash(nameLabel))
const ethOwner = (await client.readContract({
  address: ethRegistry.address,
  abi: ethRegistry.abi,
  functionName: 'getOwner',
  args: [nameId],
})) as Address

if (sameAddress(ethOwner, operator)) {
  skip(`register ${nameLabel}.eth`, 'already owned by operator')
} else {
  if (ethOwner !== zeroAddress) throw new Error(`${nameLabel}.eth is owned by ${ethOwner}; pick another NAME_LABEL`)

  let secret = loadSecret(cfg.network)
  const commitmentFor = (s: Hex) =>
    keccak256(
      encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'address' },
          { type: 'bytes32' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint64' },
          { type: 'bytes32' },
        ],
        [nameLabel, operator, s, nafudaRegistry, zeroAddress, ROOT_NAME_DURATION, toHex(0, { size: 32 })],
      ),
    )
  // A commitment is valid for one day; start over if it is older than 23 hours.
  if (!secret || Date.now() / 1000 - secret.committedAt > 23 * 3600) {
    const s = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const commitment = commitmentFor(s)
    const receipt = await send('operator', 'ETHRegistrar.commit', {
      address: ethRegistrar.address,
      abi: ethRegistrar.abi,
      functionName: 'commit',
      args: [commitment],
    })
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    secret = { secret: s, commitment, committedAt: Number(block.timestamp) }
    saveSecret(cfg.network, secret)
  } else {
    skip('ETHRegistrar.commit', `reusing commitment from ${new Date(secret.committedAt * 1000).toISOString()}`)
  }

  // MIN_COMMITMENT_AGE is 60s: warp on the fork, wait on Sepolia.
  const readyAt = BigInt(secret.committedAt + 61)
  if (cfg.network === 'fork') {
    const test = createTestClient({ chain: sepolia, mode: 'anvil', transport: http(cfg.rpcUrl) })
    const now = (await client.getBlock()).timestamp
    if (now < readyAt) await test.increaseTime({ seconds: Number(readyAt - now) })
    await test.mine({ blocks: 1 })
  } else {
    process.stdout.write('  … waiting for commitment age ')
    while ((await client.getBlock()).timestamp < readyAt) {
      process.stdout.write('.')
      await new Promise((r) => setTimeout(r, 6000))
    }
    console.log()
  }

  const [base, premium] = (await client.readContract({
    address: ethRegistrar.address,
    abi: ethRegistrar.abi,
    functionName: 'getRegisterPrice',
    args: [nameLabel, ROOT_NAME_DURATION, mockUsdc.address],
  })) as [bigint, bigint]
  const price = ((base + premium) * 101n) / 100n // small margin; MockUSDC is free
  await send('operator', 'MockUSDC.mint', {
    address: mockUsdc.address,
    abi: mockUsdc.abi,
    functionName: 'mint',
    args: [operator, price],
  })
  await send('operator', 'MockUSDC.approve', {
    address: mockUsdc.address,
    abi: mockUsdc.abi,
    functionName: 'approve',
    args: [ethRegistrar.address, price],
  })
  await send('operator', `ETHRegistrar.register ${nameLabel}`, {
    address: ethRegistrar.address,
    abi: ethRegistrar.abi,
    functionName: 'register',
    args: [nameLabel, operator, secret.secret, nafudaRegistry, zeroAddress, ROOT_NAME_DURATION, mockUsdc.address, toHex(0, { size: 32 })],
  })
  deleteSecret(cfg.network)
}

// 4. Upward edges and the psa-sim name
async function ensureParent(role: Role, registry: Address, parent: Address, label: string) {
  const [current, currentLabel] = (await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: 'getParent',
  })) as [Address, string]
  if (sameAddress(current, parent) && currentLabel === label) return skip(`setParent ${label}`, 'already set')
  await send(role, `setParent ${label}`, {
    address: registry,
    abi: registryAbi,
    functionName: 'setParent',
    args: [parent, label],
  })
}

await ensureParent('operator', nafudaRegistry, ethRegistry.address, nameLabel)

const graderNameOwner = (await client.readContract({
  address: nafudaRegistry,
  abi: registryAbi,
  functionName: 'getOwner',
  args: [BigInt(labelhash(GRADER_LABEL))],
})) as Address
if (sameAddress(graderNameOwner, grader)) {
  skip(`register ${GRADER_LABEL}`, 'already owned by grader')
} else {
  await send('operator', `register ${GRADER_LABEL}`, {
    address: nafudaRegistry,
    abi: registryAbi,
    functionName: 'register',
    args: [GRADER_LABEL, grader, psaRegistry, controller, GRADER_NAME_TOKEN_ROLES, MAX_UINT64],
  })
}

await ensureParent('grader', psaRegistry, nafudaRegistry, GRADER_LABEL)

// 5. Grader hands issuance to the controller, then gives up everything else.
const controllerIsRegistrar = await client.readContract({
  address: psaRegistry,
  abi: registryAbi,
  functionName: 'hasRootRoles',
  args: [ROLE.REGISTRAR, controller],
})
if (controllerIsRegistrar) {
  skip('grant REGISTRAR to controller', 'already granted')
} else {
  await send('grader', 'grant REGISTRAR to controller', {
    address: psaRegistry,
    abi: registryAbi,
    functionName: 'grantRootRoles',
    args: [ROLE.REGISTRAR, controller],
  })
}

const graderRootRoles = (await client.readContract({
  address: psaRegistry,
  abi: registryAbi,
  functionName: 'roles',
  args: [0n, grader],
})) as bigint
if (graderRootRoles === GRADER_FINAL_ROOT_ROLES) {
  skip('grader revokes all but final roles', 'already done')
} else {
  await send('grader', 'grader revokes all but final roles', {
    address: psaRegistry,
    abi: registryAbi,
    functionName: 'revokeRootRoles',
    args: [ALL_ROLES & (maxUint256 ^ GRADER_FINAL_ROOT_ROLES), grader],
  })
}

console.log(`\nnafudaRegistry  ${nafudaRegistry}\npsaRegistry     ${psaRegistry}\nTitleController ${controller}`)
