// The permissions panel: who can do what to a title, answered by simulating each call from each
// actor's address (eth_call: no gas, no key, nothing changes) and reading the contract's own
// verdict. This module defines the actions and explains the outcomes. Pure; permissions.test.ts.

import type { Address, Hex } from 'viem'
import { decodeRoles, ROLE } from './roles.ts'

export type Actor = 'holder' | 'grader' | 'operator' | 'stranger'
export type ActionId = 'transfer' | 'resolver' | 'unregister' | 'upgrade' | 'subtree' | 'registrar'

export type Ctx = {
  graderRegistry: Address
  nafudaRegistry: Address
  userRegistryImpl: Address
  tokenId: bigint
  graderNameId: bigint
  addresses: Record<Actor, Address>
}

export type Call = { address: Address; functionName: string; args: readonly unknown[] }

export const ACTIONS: { id: ActionId; label: string; short: string; scope: 'title' | 'grader' }[] = [
  { id: 'transfer', label: 'Move the title', short: 'Transfer', scope: 'title' },
  { id: 'resolver', label: "Point the title at another resolver (fake its records)", short: 'Change records', scope: 'title' },
  { id: 'unregister', label: 'Unregister the title', short: 'Unregister', scope: 'title' },
  { id: 'upgrade', label: "Upgrade the grader's registry contract", short: 'Upgrade registry', scope: 'title' },
  { id: 'subtree', label: "Re-point the grader's whole name (all its titles)", short: 'Re-point grader', scope: 'grader' },
  { id: 'registrar', label: 'Grant itself the right to register certs', short: 'Grant REGISTRAR', scope: 'grader' },
]

export const ACTORS: { id: Actor; label: string }[] = [
  { id: 'holder', label: 'Holder' },
  { id: 'grader', label: 'Grader' },
  { id: 'operator', label: 'Operator (us)' },
  { id: 'stranger', label: 'A stranger' },
]

/// The call `actor` would make to attempt `action`. Moving the title: the holder sends it to the
/// stranger; everyone else tries to pull it to themselves.
export function callFor(action: ActionId, actor: Actor, c: Ctx): Call {
  const me = c.addresses[actor]
  switch (action) {
    case 'transfer':
      return actor === 'holder'
        ? { address: c.graderRegistry, functionName: 'safeTransferFrom', args: [me, c.addresses.stranger, c.tokenId, 1n, '0x' as Hex] }
        : { address: c.graderRegistry, functionName: 'safeTransferFrom', args: [c.addresses.holder, me, c.tokenId, 1n, '0x' as Hex] }
    case 'resolver':
      return { address: c.graderRegistry, functionName: 'setResolver', args: [c.tokenId, me] }
    case 'unregister':
      return { address: c.graderRegistry, functionName: 'unregister', args: [c.tokenId] }
    case 'upgrade':
      return { address: c.graderRegistry, functionName: 'upgradeToAndCall', args: [c.userRegistryImpl, '0x' as Hex] }
    case 'subtree':
      return { address: c.nafudaRegistry, functionName: 'setSubregistry', args: [c.graderNameId, me] }
    case 'registrar':
      return { address: c.graderRegistry, functionName: 'grantRootRoles', args: [ROLE.REGISTRAR, me] }
  }
}

export type Outcome = { allowed: boolean; error: string | null; args: readonly unknown[] }

/// Whether an allowed outcome is expected (green) or a remaining power (amber/red).
export function verdict(action: ActionId, actor: Actor, o: Outcome): 'expected' | 'refused' | 'power' {
  if (!o.allowed) return 'refused'
  return action === 'transfer' && actor === 'holder' ? 'expected' : 'power'
}

/// One line for humans: why the contract said yes or no.
export function explain(action: ActionId, actor: Actor, o: Outcome, names: Record<Actor, string>): string {
  const who = names[actor]
  if (o.allowed) {
    if (action === 'transfer') return `Allowed: ${who} holds CAN_TRANSFER_ADMIN and is the only assignee.`
    if (action === 'subtree') return `Allowed today: ${who} can still re-point the grader's name. The final lock removes this.`
    if (action === 'registrar') return `Allowed: ${who} holds REGISTRAR admin (to switch issuing contracts). Titles made outside the controller fail the per-title checks.`
    return `Allowed: ${who} can do this.`
  }
  switch (o.error) {
    case 'EACUnauthorizedAccountRoles': {
      const roles = decodeRoles(BigInt(o.args[1] as bigint)).join(', ')
      return `Refused by Enhanced Access Control: ${who} lacks ${roles} ${BigInt(o.args[0] as bigint) === 0n ? 'on the registry root' : 'on this name'}.`
    }
    case 'EACCannotGrantRoles':
      return `Refused by Enhanced Access Control: ${who} holds no admin role that could grant this.`
    case 'ERC1155MissingApprovalForAll':
      return `Refused: only the holder, or an operator the holder approved, can move a title.`
    case 'TransferUnsafeWithMultipleAssignees':
      return `Refused: someone else also holds a role on this title, so ENSv2 blocks safe transfers.`
    case 'TransferDisallowed':
      return `Refused: ${who} does not hold CAN_TRANSFER_ADMIN on this title.`
    case 'UUPSUnauthorizedCallContext':
      return 'Refused by the upgrade proxy.'
    default:
      return `Refused${o.error ? `: ${o.error}` : ''}.`
  }
}
