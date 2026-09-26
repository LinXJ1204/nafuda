// Per-title EAC checks: does this title follow the grader's rules? The grader can switch issuing
// contracts (REGISTRAR admin), so it could register a cert outside the controller's rules; these
// checks catch that for any single title, from on-chain facts only. Pure; integrity.test.ts.

import { isAddressEqual, type Address } from 'viem'
import { TITLE_ROLES } from './roles.ts'

export type IntegrityFacts = {
  /// The resolver the Universal Resolver found, and whether it was found at the grader's name
  /// (the cert itself has no resolver of its own: the wildcard path)
  resolver: Address | null
  resolverAtGraderLevel: boolean
  /// The grader's controller, from the deployment
  controller: Address
  /// controller.holderOf(cert): non-zero only for titles the controller issued
  controllerHolder: Address | null
  /// The holder on ENS
  holder: Address | null
  /// roles(title, holder) and getAssigneeCount(title, ALL_ROLES).counts on the grader registry
  holderRoles: bigint
  assigneeCounts: bigint
  /// isEmancipated() of the grader registry
  emancipated: boolean
}

export type IntegrityCheck = { id: string; ok: boolean; title: string; detail: string }

/// Nybble offset of a single-bit role in a packed count word
const nybble = (role: bigint) => {
  let i = 0n
  while (role > 1n) {
    role >>= 1n
    i++
  }
  return i
}

export function checkIntegrity(f: IntegrityFacts): IntegrityCheck[] {
  const shift = nybble(TITLE_ROLES)
  const transferAssignees = (f.assigneeCounts >> shift) & 0xfn
  const others = f.assigneeCounts & ~(0xfn << shift)
  return [
    {
      id: 'resolver',
      ok: !!f.resolver && f.resolverAtGraderLevel && isAddressEqual(f.resolver, f.controller),
      title: "Answered by the grader's controller",
      detail: 'The cert has no resolver of its own; ENS finds the grader\'s controller one level up (ENSIP-10 wildcard). A title with its own resolver could serve records someone can change.',
    },
    {
      id: 'issued',
      ok: !!f.controllerHolder && !!f.holder && isAddressEqual(f.controllerHolder, f.holder),
      title: 'Issued through the controller',
      detail: "The controller has a record for this cert (chip, card, grade) and agrees on the holder: it was issued by the controller's rules.",
    },
    {
      id: 'holder-roles',
      ok: f.holderRoles === TITLE_ROLES,
      title: 'The holder can only transfer',
      detail: 'The holder has exactly ROLE_CAN_TRANSFER_ADMIN on the title: no resolver or subregistry changes.',
    },
    {
      id: 'sole-assignee',
      ok: transferAssignees === 1n && others === 0n,
      title: 'Nobody else holds a role on this title',
      detail: 'One assignee in total (the holder). A hidden co-assignee would also block safe transfers.',
    },
    {
      id: 'emancipated',
      ok: f.emancipated,
      title: "The grader's registry is emancipated",
      detail: 'Nobody holds the root roles that could unregister, re-point or upgrade titles.',
    },
  ]
}
