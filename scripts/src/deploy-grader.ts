// Add a grader under <name>.eth (v3): its own registry, its own TitleController, and the name
// <label>.<name>.eth pointing at both. The same steps deploy.ts ran for psa-sim, for any grader.
// Idempotent: every step checks chain state first.
//
//   npm run deploy-grader -- --network sepolia --label cgc-sim
//   npm run deploy-grader -- --network sepolia --label bgs-sim     (controller version from demo/graders.json)
//   npm run deploy-grader -- --network sepolia --adopt             (record psa-sim, deployed by deploy.ts)
//
// Result for <label>:
//   <label>.<name>.eth   owner grader; subregistry = the grader's registry; resolver = its controller
//   registry root        controller: REGISTRAR; grader: GRADER_FINAL_ROOT_ROLES → emancipated

import { readFileSync } from 'node:fs'
import { encodeAbiParameters, encodeFunctionData, keccak256, labelhash, maxUint256, parseEther, parseEventLogs, type Abi, type Address, type Hex } from 'viem'
import { beta } from './addresses.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import {
  ALL_ROLES,
  GRADER_FINAL_ROOT_ROLES,
  GRADER_NAME_TOKEN_ROLES,
  MAX_UINT64,
  ROLE,
  confirm,
  dns,
  loadState,
  sameAddress,
  saveState,
  skip,
  type GraderDeployment,
} from './lib.ts'

type GraderDef = { short: string; name: string; controller: 1 | 2 }
const GRADERS: Record<string, GraderDef> = JSON.parse(readFileSync(new URL('../../demo/graders.json', import.meta.url), 'utf8')).graders

const cfg = loadConfig(networkFromArgs())
const { publicClient: client, nameLabel } = cfg
const state = loadState(cfg.network, nameLabel)
if (!state.nafudaRegistry || !state.psaRegistry || !state.titleController) throw new Error('run deploy first')
const nafudaRegistry = state.nafudaRegistry
const registryAbi = beta('UserRegistryImpl').abi
const factory = beta('VerifiableFactory')
const operator = cfg.wallet('operator')
state.graders ??= {}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function hasCode(address?: Address) {
  if (!address) return false
  const code = await client.getCode({ address })
  return !!code && code !== '0x'
}

function artifact(version: 1 | 2): { abi: Abi; bytecode: Hex } {
  const name = version === 1 ? 'TitleController' : 'TitleControllerV2'
  const json = JSON.parse(readFileSync(new URL(`../../contracts/out/${name}.sol/${name}.json`, import.meta.url), 'utf8'))
  return { abi: json.abi, bytecode: json.bytecode.object }
}

// psa-sim was deployed by deploy.ts before graders were recorded; record it once.
if (process.argv.includes('--adopt')) {
  if (state.graders['psa-sim']) {
    skip('adopt psa-sim', 'already recorded')
  } else {
    const grader = (await client.readContract({
      address: state.titleController,
      abi: [{ type: 'function', name: 'GRADER', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
      functionName: 'GRADER',
    })) as Address
    state.graders['psa-sim'] = {
      label: 'psa-sim',
      name: GRADERS['psa-sim'].name,
      grader,
      registry: state.psaRegistry,
      controller: state.titleController,
      controllerVersion: 1,
      startBlock: state.startBlock!,
    }
    saveState(state)
    console.log('  ✓ recorded psa-sim')
  }
  process.exit(0)
}

const label = arg('label')
if (!label || !GRADERS[label]) throw new Error(`--label must be one of ${Object.keys(GRADERS).join(', ')}`)
if (label === 'psa-sim') throw new Error('psa-sim is deployed by deploy.ts; use --adopt to record it')
const def = GRADERS[label]
const graderAccount = cfg.graderAccount(label)
const grader = graderAccount.address
const graderWallet = cfg.walletFor(graderAccount)
const entry: Partial<GraderDeployment> = state.graders[label] ?? { label, name: def.name, grader, controllerVersion: def.controller }
if (!sameAddress(entry.grader, grader)) throw new Error(`${label}: recorded grader ${entry.grader} differs from the key in .env`)

async function send(wallet: typeof operator | typeof graderWallet, what: string, request: Record<string, unknown>) {
  const hash = await wallet.writeContract(request as never)
  state.txs[`${label}: ${what}`] = hash
  saveState(state)
  return confirm(client, `${label}: ${what}`, hash)
}
const save = () => {
  state.graders![label] = entry as GraderDeployment
  saveState(state)
}

console.log(`== deploy grader ${label}.${nameLabel}.eth on ${cfg.network} ==`)

// 0. Gas for the grader
const minGraderBalance = parseEther('0.03')
const balance = await client.getBalance({ address: grader })
if (balance >= minGraderBalance) {
  skip(`${label}: fund grader`, `${grader} has enough`)
} else {
  const hash = await operator.sendTransaction({ to: grader, value: minGraderBalance - balance })
  state.txs[`${label}: fund grader`] = hash
  await confirm(client, `${label}: fund grader`, hash)
}

// 1. The grader's registry, admin = grader
if (await hasCode(entry.registry)) {
  skip(`${label}: deploy registry`, entry.registry!)
} else {
  const initData = encodeFunctionData({ abi: registryAbi, functionName: 'initialize', args: [[{ account: grader, roleBitmap: ALL_ROLES }]] })
  const salt = BigInt(keccak256(encodeAbiParameters([{ type: 'bytes' }, { type: 'string' }], [initData, `${nameLabel}:${label}:registry`])))
  const receipt = await send(operator, 'deploy registry', {
    address: factory.address,
    abi: factory.abi,
    functionName: 'deployProxy',
    args: [beta('UserRegistryImpl').address, salt, initData],
  })
  const [event] = parseEventLogs({ abi: factory.abi, eventName: 'ProxyDeployed', logs: receipt.logs }) as unknown as [{ args: { proxyAddress: Address } }]
  entry.registry = event.args.proxyAddress
  entry.startBlock = Number(receipt.blockNumber)
  save()
}
const registry = entry.registry!

// 2. The grader's controller (issuer + wildcard resolver)
if (await hasCode(entry.controller)) {
  skip(`${label}: deploy controller`, entry.controller!)
} else {
  const { abi, bytecode } = artifact(entry.controllerVersion!)
  const hash = await operator.deployContract({ abi, bytecode, args: [registry, grader, dns(`${label}.${nameLabel}.eth`), def.name] })
  state.txs[`${label}: deploy controller v${entry.controllerVersion}`] = hash
  const receipt = await confirm(client, `${label}: deploy controller v${entry.controllerVersion}`, hash)
  entry.controller = receipt.contractAddress!
  save()
}
const controller = entry.controller!

// 3. <label>.<name>.eth in nafudaRegistry: subregistry = registry, resolver = controller
const nameOwner = (await client.readContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'getOwner', args: [BigInt(labelhash(label))] })) as Address
if (sameAddress(nameOwner, grader)) {
  skip(`${label}: register name`, 'already owned by grader')
} else {
  await send(operator, 'register name', {
    address: nafudaRegistry,
    abi: registryAbi,
    functionName: 'register',
    args: [label, grader, registry, controller, GRADER_NAME_TOKEN_ROLES, MAX_UINT64],
  })
}

// 4. Upward edge
const [parent, parentLabel] = (await client.readContract({ address: registry, abi: registryAbi, functionName: 'getParent' })) as [Address, string]
if (sameAddress(parent, nafudaRegistry) && parentLabel === label) {
  skip(`${label}: setParent`, 'already set')
} else {
  await send(graderWallet, 'setParent', { address: registry, abi: registryAbi, functionName: 'setParent', args: [nafudaRegistry, label] })
}

// 5. Controller issues; grader keeps only its final roles
const controllerIsRegistrar = await client.readContract({ address: registry, abi: registryAbi, functionName: 'hasRootRoles', args: [ROLE.REGISTRAR, controller] })
if (controllerIsRegistrar) {
  skip(`${label}: grant REGISTRAR`, 'already granted')
} else {
  await send(graderWallet, 'grant REGISTRAR to controller', { address: registry, abi: registryAbi, functionName: 'grantRootRoles', args: [ROLE.REGISTRAR, controller] })
}
const graderRoles = (await client.readContract({ address: registry, abi: registryAbi, functionName: 'roles', args: [0n, grader] })) as bigint
if (graderRoles === GRADER_FINAL_ROOT_ROLES) {
  skip(`${label}: grader revokes`, 'already done')
} else {
  await send(graderWallet, 'grader revokes all but final roles', {
    address: registry,
    abi: registryAbi,
    functionName: 'revokeRootRoles',
    args: [ALL_ROLES & (maxUint256 ^ GRADER_FINAL_ROOT_ROLES), grader],
  })
}
const emancipated = await client.readContract({ address: registry, abi: registryAbi, functionName: 'isEmancipated' })
if (!emancipated) throw new Error(`${label}: registry is not emancipated`)
console.log(`\n${label}.${nameLabel}.eth\n  grader     ${grader}\n  registry   ${registry} (emancipated)\n  controller ${controller} (v${entry.controllerVersion})`)
