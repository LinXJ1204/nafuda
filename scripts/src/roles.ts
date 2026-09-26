// Print the live Enhanced Access Control map of the Nafuda deployment: who holds which roles on
// which resource, from the .eth registry down to a title. Read-only.
//
//   npm run roles -- --network sepolia          (docs/access-control.md explains the map)

import { labelhash, type Address } from 'viem'
import { beta } from './addresses.ts'
import { collectors } from './collectors.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { loadState } from './lib.ts'
import { decodeRoles } from '../../packages/core/src/roles.ts'

const cfg = loadConfig(networkFromArgs())
const client = cfg.publicClient
const state = loadState(cfg.network, cfg.nameLabel) as ReturnType<typeof loadState> & { collectorResolver?: Address }
const registryAbi = beta('UserRegistryImpl').abi
const eth = beta('ETHRegistry')
const d = (b: bigint) => decodeRoles(b).filter((r) => !r.startsWith('bit ')).join(', ') || '—'
const roles = (address: Address, id: bigint, account: Address, abi = registryAbi) =>
  client.readContract({ address, abi, functionName: 'roles', args: [id, account] }) as Promise<bigint>
const emancipated = (address: Address) => client.readContract({ address, abi: registryAbi, functionName: 'isEmancipated' }) as Promise<boolean>

const operator = cfg.accounts.operator.address
const nafuda = state.nafudaRegistry!
const root = BigInt(labelhash(cfg.nameLabel))

console.log(`== EAC map on ${cfg.network} ==\n`)
console.log(`${cfg.nameLabel}.eth (ETHRegistry token)`)
console.log(`  operator        ${d(await roles(eth.address, root, operator, eth.abi))}`)
console.log(`\nnafudaRegistry root   emancipated: ${await emancipated(nafuda)}`)
console.log(`  operator        ${d(await roles(nafuda, 0n, operator))}`)

for (const g of Object.values(state.graders ?? {})) {
  const id = BigInt(labelhash(g.label))
  console.log(`\n${g.label}.${cfg.nameLabel}.eth (nafudaRegistry token)`)
  console.log(`  grader          ${d(await roles(nafuda, id, g.grader))}`)
  console.log(`${g.label} registry root   emancipated: ${await emancipated(g.registry)}`)
  console.log(`  grader          ${d(await roles(g.registry, 0n, g.grader))}`)
  console.log(`  controller v${g.controllerVersion}   ${d(await roles(g.registry, 0n, g.controller))}`)
}

const res = await fetch('https://nafuda.sololin.xyz/api/titles?limit=1&sort=traded').then((r) => r.json()).catch(() => null)
const t = res?.items?.[0]
if (t) {
  const g = state.graders![t.grader]
  console.log(`\ntitle ${t.cert}.${t.grader}.${cfg.nameLabel}.eth (a sample)`)
  console.log(`  holder          ${d(await roles(g.registry, BigInt(labelhash(t.cert)), t.holder))}`)
  console.log(`  grader          ${d(await roles(g.registry, BigInt(labelhash(t.cert)), g.grader))}`)
}

const aiko = collectors().find((c) => c.name === 'aiko')
if (aiko) {
  console.log(`\naiko.${cfg.nameLabel}.eth (a collector's name)`)
  console.log(`  aiko            ${d(await roles(nafuda, BigInt(labelhash('aiko')), aiko.address))}`)
}
if (state.collectorResolver) {
  console.log(`\ncollector-name resolver (PermissionedResolver) root`)
  console.log(`  operator        all roles: ${(await roles(state.collectorResolver, 0n, operator)) === BigInt('0x' + '1'.repeat(64))}`)
}
