// A6: ENS names for the demo collectors, so every app shows "aiko.nafuda.eth" instead of an
// address, and gets it from ENS itself (reverse + forward resolution through the Universal
// Resolver), not from a table in the app. Idempotent.
//
//   npm run names -- --network fork|sepolia
//
//   1. an official ENSv2 PermissionedResolver (proxy via VerifiableFactory), operator-administered
//   2. addr records for <name>.nafuda.eth → collector address (one multicall)
//   3. <name>.nafuda.eth registered in nafudaRegistry to the collector (transfer-only), with that resolver
//   4. each collector with a key sets its primary name (v1 addr.reverse, which ENSv2 reads through
//      its ReverseRegistrarAdapter / ENSV1Resolver)
//   5. each collector gets SET_RESOLVER on their own name: an identity name is the owner's to point
//      anywhere, unlike a title, which is transfer-only. On a name token ENSv2 lets a root admin
//      grant only the base role (never the admin), so this is exactly SET_RESOLVER. Must run
//      before the final lock, which revokes the operator's root SET_RESOLVER admin.
// The author's wallet gets its name too; setting its primary name is up to the author.

import { encodeAbiParameters, encodeFunctionData, keccak256, labelhash, parseAbi, parseEventLogs, zeroAddress, type Address, type Hex } from 'viem'
import { normalize } from 'viem/ens'
import { UNIVERSAL_RESOLVER, beta } from './addresses.ts'
import { collectorAccounts, collectors } from './collectors.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { ALL_ROLES, MAX_UINT64, ROLE, confirm, dns, loadState, sameAddress, saveState, skip } from './lib.ts'

const REVERSE_REGISTRAR: Address = '0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6' // ENS v1 addr.reverse on Sepolia (ReverseRegistrarAdapter.REVERSE_REGISTRAR)
const reverseAbi = parseAbi(['function setName(string name) returns (bytes32)'])

const cfg = loadConfig(networkFromArgs())
const { publicClient: client, nameLabel } = cfg
const state = loadState(cfg.network, nameLabel) as ReturnType<typeof loadState> & { collectorResolver?: Address }
if (!state.nafudaRegistry) throw new Error('run deploy first')
const nafudaRegistry = state.nafudaRegistry
const registryAbi = beta('UserRegistryImpl').abi
const resolverImpl = beta('PermissionedResolverImpl')
const factory = beta('VerifiableFactory')
const operator = cfg.wallet('operator')
const universalResolverAddress = UNIVERSAL_RESOLVER()
const list = collectors()
const keys = collectorAccounts()
const nameOf = (label: string) => `${label}.${nameLabel}.eth`

console.log(`== collector names on ${cfg.network}: ${list.length} collectors ==`)

// 1. Resolver
const hasCode = async (a?: Address) => !!a && ((await client.getCode({ address: a })) ?? '0x') !== '0x'
if (await hasCode(state.collectorResolver)) {
  skip('deploy collector resolver', state.collectorResolver!)
} else {
  const initData = encodeFunctionData({ abi: resolverImpl.abi, functionName: 'initialize', args: [[{ account: operator.account.address, roleBitmap: ALL_ROLES }], []] })
  const salt = BigInt(keccak256(encodeAbiParameters([{ type: 'bytes' }, { type: 'string' }], [initData, `${nameLabel}:collectors:resolver`])))
  const hash = await operator.writeContract({ address: factory.address, abi: factory.abi, functionName: 'deployProxy', args: [resolverImpl.address, salt, initData] })
  const receipt = await confirm(client, 'deploy collector resolver', hash)
  const [event] = parseEventLogs({ abi: factory.abi, eventName: 'ProxyDeployed', logs: receipt.logs }) as unknown as [{ args: { proxyAddress: Address } }]
  state.collectorResolver = event.args.proxyAddress
  state.txs['deploy collector resolver'] = hash
  saveState(state)
}
const resolver = state.collectorResolver!

// 2. addr records (only the missing ones, in one multicall)
const missing: Hex[] = []
for (const c of list) {
  const current = await client.getEnsAddress({ name: normalize(nameOf(c.name)), universalResolverAddress }).catch(() => null)
  if (sameAddress(current ?? undefined, c.address)) continue
  missing.push(encodeFunctionData({ abi: resolverImpl.abi, functionName: 'setAddress', args: [dns(nameOf(c.name)), 60n, c.address] }))
}
if (!missing.length) {
  skip('addr records', 'all set')
} else {
  const hash = await operator.writeContract({ address: resolver, abi: resolverImpl.abi, functionName: 'multicall', args: [missing] })
  state.txs['collector addr records'] = hash
  saveState(state)
  await confirm(client, `addr records ×${missing.length}`, hash)
}

// 3. Names in nafudaRegistry
for (const c of list) {
  const owner = (await client.readContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'getOwner', args: [BigInt(labelhash(c.name))] })) as Address
  if (sameAddress(owner, c.address)) {
    skip(`register ${nameOf(c.name)}`, 'already registered')
    continue
  }
  if (owner !== zeroAddress) throw new Error(`${nameOf(c.name)} is owned by ${owner}`)
  const hash = await operator.writeContract({
    address: nafudaRegistry,
    abi: registryAbi,
    functionName: 'register',
    args: [c.name, c.address, zeroAddress, resolver, ROLE.CAN_TRANSFER_ADMIN, MAX_UINT64],
  })
  state.txs[`register ${nameOf(c.name)}`] = hash
  saveState(state)
  await confirm(client, `register ${nameOf(c.name)}`, hash)
}

// 4. Primary names (reverse), from each collector's own wallet
for (const c of list) {
  const account = keys[c.name]
  if (!account) {
    skip(`primary name ${nameOf(c.name)}`, 'no key (the author sets it from their wallet)')
    continue
  }
  const current = await client.getEnsName({ address: c.address, universalResolverAddress }).catch(() => null)
  if (current === nameOf(c.name)) {
    skip(`primary name ${nameOf(c.name)}`, 'already set')
    continue
  }
  const hash = await cfg.walletFor(account).writeContract({ address: REVERSE_REGISTRAR, abi: reverseAbi, functionName: 'setName', args: [nameOf(c.name)] })
  await confirm(client, `primary name ${nameOf(c.name)}`, hash)
}

// 5. Owners control their identity names' resolver
const OWNER_NAME_ROLES = ROLE.SET_RESOLVER
for (const c of list) {
  const id = BigInt(labelhash(c.name))
  const roles = (await client.readContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'roles', args: [id, c.address] })) as bigint
  if ((roles & OWNER_NAME_ROLES) === OWNER_NAME_ROLES) {
    skip(`SET_RESOLVER for ${nameOf(c.name)}`, 'already granted')
    continue
  }
  const hash = await operator.writeContract({ address: nafudaRegistry, abi: registryAbi, functionName: 'grantRoles', args: [id, OWNER_NAME_ROLES, c.address] })
  state.txs[`grant SET_RESOLVER ${nameOf(c.name)}`] = hash
  saveState(state)
  await confirm(client, `SET_RESOLVER for ${nameOf(c.name)}`, hash)
}

// Check: reverse resolution through the ENSv2 Universal Resolver
for (const c of list.slice(0, 4)) {
  const name = await client.getEnsName({ address: c.address, universalResolverAddress }).catch((e) => `error: ${(e as Error).message.split('\n')[0]}`)
  console.log(`  getEnsName(${c.address}) → ${name}`)
}
