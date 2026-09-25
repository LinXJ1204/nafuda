// P7-4 final lock (IRREVERSIBLE): after this nobody, including the operator and the grader,
// can swap the psa-sim subtree or re-point its resolver, so title records become immutable.
//
// Dry run (default) simulates every call with eth_call and changes nothing:
//   npm run lock -- --network fork
// Execute:
//   npm run lock -- --network fork --execute --i-understand-this-is-irreversible
//
// Steps
//   1. grader   revokes SET_SUBREGISTRY / SET_RESOLVER (+admin) on its `psa-sim` token in nafudaRegistry
//   2. operator revokes UNEMANCIPATED_ROLE_BITMAP on nafudaRegistry's root → nafudaRegistry emancipated
//   3. operator revokes SET_SUBREGISTRY (+admin) on its `nafuda` token in the .eth registry
// Kept on purpose: the operator's SET_RESOLVER on nafuda.eth (records for the root name itself;
// cert names resolve through the deeper psa-sim resolver), REGISTRAR on nafudaRegistry (can add new
// graders, cannot touch existing names), and nafuda.eth's transferability (roles move with it).

import { labelhash, type Address } from 'viem'
import { beta } from './addresses.ts'
import { loadConfig, networkFromArgs, type Role } from './config.ts'
import { GRADER_LABEL, GRADER_NAME_TOKEN_ROLES, ROLE, confirm, loadState, saveState } from './lib.ts'

export const UNEMANCIPATED_ROLE_BITMAP =
  ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY) |
  ROLE.SET_RESOLVER | ROLE.admin(ROLE.SET_RESOLVER) |
  ROLE.UNREGISTER | ROLE.admin(ROLE.UNREGISTER) |
  ROLE.UPGRADE | ROLE.admin(ROLE.UPGRADE)

export const ROOT_NAME_LOCKED_ROLES = ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY)

const execute = process.argv.includes('--execute')
if (execute && !process.argv.includes('--i-understand-this-is-irreversible')) {
  throw new Error('--execute also needs --i-understand-this-is-irreversible')
}

const cfg = loadConfig(networkFromArgs())
const { publicClient: client, accounts, nameLabel } = cfg
const state = loadState(cfg.network, nameLabel)
if (!state.nafudaRegistry || !state.psaRegistry) throw new Error('deployment state incomplete: run deploy first')
const registryAbi = beta('UserRegistryImpl').abi
const ethRegistry = beta('ETHRegistry')

const tokenIdOf = async (address: Address, abi: typeof registryAbi, label: string) =>
  (await client.readContract({ address, abi, functionName: 'getTokenId', args: [BigInt(labelhash(label))] })) as bigint

type Step = { role: Role; label: string; address: Address; abi: typeof registryAbi; functionName: string; args: readonly unknown[] }

const steps: Step[] = [
  {
    role: 'grader',
    label: `grader revokes subregistry/resolver roles on ${GRADER_LABEL}`,
    address: state.nafudaRegistry,
    abi: registryAbi,
    functionName: 'revokeRoles',
    args: [await tokenIdOf(state.nafudaRegistry, registryAbi, GRADER_LABEL), GRADER_NAME_TOKEN_ROLES, accounts.grader.address],
  },
  {
    role: 'operator',
    label: 'operator emancipates nafudaRegistry',
    address: state.nafudaRegistry,
    abi: registryAbi,
    functionName: 'revokeRootRoles',
    args: [UNEMANCIPATED_ROLE_BITMAP, accounts.operator.address],
  },
  {
    role: 'operator',
    label: `operator revokes subregistry role on ${nameLabel}.eth`,
    address: ethRegistry.address,
    abi: ethRegistry.abi,
    functionName: 'revokeRoles',
    args: [await tokenIdOf(ethRegistry.address, ethRegistry.abi, nameLabel), ROOT_NAME_LOCKED_ROLES, accounts.operator.address],
  },
]

console.log(`== lock on ${cfg.network} (${execute ? 'EXECUTE, irreversible' : 'dry run'}) ==`)
for (const step of steps) {
  const { role, label, ...call } = step
  const request = { ...call, account: accounts[role] } as Parameters<typeof client.simulateContract>[0]
  await client.simulateContract(request) // throws if it would revert
  if (!execute) {
    console.log(`  ~ ${label.padEnd(56)} would succeed`)
    continue
  }
  const hash = await cfg.wallet(role).writeContract(request as never)
  state.txs[`lock: ${label}`] = hash
  saveState(state)
  await confirm(client, label, hash)
}

if (execute) {
  state.locked = true
  saveState(state)
  console.log('\nlocked. Run `npm run verify` to check the post-lock invariants.')
}
