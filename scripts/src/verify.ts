// Checks V1–V8 from docs/plan/slab-title-implementation.md (P2). Exits 1 on any failure.
// Resolution checks go through viem + the ENSv2 Universal Resolver, exactly like any client.
//
//   npm run verify -- --network fork       (includes V8: transfer alice → bob → alice)
//   npm run verify -- --network sepolia    (V1–V7 only; add --with-transfer to run V8)

import { getAddress, labelhash, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { UNIVERSAL_RESOLVER, beta } from './addresses.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { GRADER_FINAL_ROOT_ROLES, GRADER_LABEL, GRADER_NAME_TOKEN_ROLES, ROLE, demoSlabs, loadState, sameAddress, transferTitle } from './lib.ts'

const cfg = loadConfig(networkFromArgs())
const { publicClient: client, accounts, nameLabel } = cfg
const state = loadState(cfg.network, nameLabel)
const withTransfer = cfg.network === 'fork' || process.argv.includes('--with-transfer')
const registryAbi = beta('UserRegistryImpl').abi
const ethRegistry = beta('ETHRegistry')
const universalResolverAddress = UNIVERSAL_RESOLVER()

const CERT = '12345678'
const UNISSUED = '99999999'
const certName = (cert: string) => normalize(`${cert}.${GRADER_LABEL}.${nameLabel}.eth`)
const holderOf = (cert: string) => client.getEnsAddress({ name: certName(cert), universalResolverAddress })
const textOf = (cert: string, key: string) => client.getEnsText({ name: certName(cert), key, universalResolverAddress })

let failed = 0
function check(id: string, ok: boolean, label: string, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${id} ${label}${detail ? `  (${detail})` : ''}`)
}

async function parentOf(registry: Address) {
  const [parent, label] = (await client.readContract({ address: registry, abi: registryAbi, functionName: 'getParent' })) as [Address, string]
  return { parent, label }
}

console.log(`== verify ${nameLabel}.eth on ${cfg.network} ==`)
if (!state.nafudaRegistry || !state.psaRegistry || !state.titleController) {
  throw new Error('deployment state incomplete: run deploy first')
}

const ethOwner = (await client.readContract({
  address: ethRegistry.address,
  abi: ethRegistry.abi,
  functionName: 'getOwner',
  args: [BigInt(labelhash(nameLabel))],
})) as Address
check('V1', sameAddress(ethOwner, accounts.operator.address), `${nameLabel}.eth owner is operator`, ethOwner)

const nafudaParent = await parentOf(state.nafudaRegistry)
const psaParent = await parentOf(state.psaRegistry)
check(
  'V2',
  sameAddress(nafudaParent.parent, ethRegistry.address) &&
    nafudaParent.label === nameLabel &&
    sameAddress(psaParent.parent, state.nafudaRegistry) &&
    psaParent.label === GRADER_LABEL,
  'getParent() points one level up',
  `${nafudaParent.label} → eth, ${psaParent.label} → ${nameLabel}`,
)

const emancipated = await client.readContract({ address: state.psaRegistry, abi: registryAbi, functionName: 'isEmancipated' })
check('V3', emancipated === true, 'psaRegistry.isEmancipated()')

const controllerIsRegistrar = await client.readContract({
  address: state.psaRegistry,
  abi: registryAbi,
  functionName: 'hasRootRoles',
  args: [ROLE.REGISTRAR, state.titleController],
})
const graderRoles = (await client.readContract({
  address: state.psaRegistry,
  abi: registryAbi,
  functionName: 'roles',
  args: [0n, accounts.grader.address],
})) as bigint
check(
  'V4',
  controllerIsRegistrar === true && graderRoles === GRADER_FINAL_ROOT_ROLES,
  'controller holds REGISTRAR; grader holds only its final roles',
)

const holder = await holderOf(CERT)
check('V5', sameAddress(holder ?? undefined, accounts.alice.address), `getEnsAddress(${certName(CERT)}) is alice`, String(holder))

const expectedChip = getAddress(demoSlabs()[CERT].genuine.address)
const chip = await textOf(CERT, 'slab.chip')
check('V6', chip === expectedChip, 'slab.chip matches demo/slabs.json', String(chip))

const unissued = await textOf(UNISSUED, 'title.status')
check('V7', unissued === 'NONE', `title.status of ${UNISSUED} is NONE`, String(unissued))

if (withTransfer) {
  await transferTitle(cfg, state.psaRegistry, 'alice', 'bob', CERT)
  const afterSale = await holderOf(CERT)
  await transferTitle(cfg, state.psaRegistry, 'bob', 'alice', CERT)
  const afterReturn = await holderOf(CERT)
  check(
    'V8',
    sameAddress(afterSale ?? undefined, accounts.bob.address) && sameAddress(afterReturn ?? undefined, accounts.alice.address),
    'transfer alice → bob → alice is reflected by resolution',
  )
} else {
  console.log('- V8 skipped (Sepolia; pass --with-transfer to run it)')
}

// Post-lock invariants (P7-4), checked only once lock.ts has run.
async function reverts(request: Parameters<typeof client.simulateContract>[0]) {
  try {
    await client.simulateContract(request)
    return false
  } catch {
    return true
  }
}

if (state.locked) {
  const nafudaRegistry = state.nafudaRegistry
  const rootNameId = BigInt(labelhash(nameLabel))
  const lockedRootRoles = ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY)

  const nafudaEmancipated = await client.readContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'isEmancipated' })
  check('V9', nafudaEmancipated === true, 'nafudaRegistry.isEmancipated()')

  // V10: every grader's name, not only psa-sim
  const graderLabels = Object.keys(state.graders ?? { [GRADER_LABEL]: true })
  let v10 = true
  for (const label of graderLabels) {
    const nameId = BigInt(labelhash(label))
    const grader = cfg.graderAccount(label)
    const tokenRoles = (await client.readContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'roles', args: [nameId, grader.address] })) as bigint
    const blocked =
      (await reverts({ address: nafudaRegistry, abi: registryAbi, functionName: 'setResolver', args: [nameId, grader.address], account: grader })) &&
      (await reverts({ address: nafudaRegistry, abi: registryAbi, functionName: 'setResolver', args: [nameId, accounts.operator.address], account: accounts.operator })) &&
      (await reverts({ address: nafudaRegistry, abi: registryAbi, functionName: 'setSubregistry', args: [nameId, accounts.operator.address], account: accounts.operator }))
    if ((tokenRoles & GRADER_NAME_TOKEN_ROLES) !== 0n || !blocked) v10 = false
  }
  check('V10', v10, `nobody can re-point ${graderLabels.map((l) => `${l}.${nameLabel}.eth`).join(', ')}`)

  const operatorRootRoles = (await client.readContract({
    address: ethRegistry.address,
    abi: ethRegistry.abi,
    functionName: 'roles',
    args: [rootNameId, accounts.operator.address],
  })) as bigint
  const swapBlocked = await reverts({
    address: ethRegistry.address,
    abi: ethRegistry.abi,
    functionName: 'setSubregistry',
    args: [rootNameId, accounts.operator.address],
    account: accounts.operator,
  })
  check('V11', (operatorRootRoles & lockedRootRoles) === 0n && swapBlocked, `operator cannot swap ${nameLabel}.eth's subregistry`)
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
