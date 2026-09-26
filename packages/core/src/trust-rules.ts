// Scoring for the trust panel: raw on-chain facts in, pass/fail checks out. Pure, so the same
// rules are tested for the state before and after the final lock (trust-rules.test.ts).
// Mirrors scripts/src/verify.ts V3, V4 and V9–V11.

import { isAddressEqual, type Address } from 'viem'
import { DANGEROUS_ROOT_ROLES, GRADER_FINAL_ROOT_ROLES, GRADER_NAME_TOKEN_ROLES, ROLE, TITLE_ROLES } from './roles.ts'

export type TrustFacts = {
  psaEmancipated: boolean
  controllerIsRegistrar: boolean
  graderRootRoles: bigint
  holderRoles: { cert: string; roles: bigint }[]
  psaParent: { parent: Address; label: string }
  nafudaParent: { parent: Address; label: string }
  expected: { nafudaRegistry: Address; ethRegistry: Address; graderLabel: string; nameLabel: string }
  // final lock
  nafudaEmancipated: boolean
  graderNameTokenRoles: bigint
  operatorNameTokenRoles: bigint
  operatorRootNameRoles: bigint
}

export type TrustCheck = { id: string; group: 'titles' | 'lock'; ok: boolean; title: string; body: string }

export function evaluateTrust(f: TrustFacts): TrustCheck[] {
  const holdersOk = f.holderRoles.every((h) => h.roles === TITLE_ROLES)
  const lockedSubtree = (f.graderNameTokenRoles | f.operatorNameTokenRoles) & GRADER_NAME_TOKEN_ROLES
  const lockedRoot = f.operatorRootNameRoles & (ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY))
  return [
    {
      id: 'emancipated',
      group: 'titles',
      ok: f.psaEmancipated,
      title: 'The title registry is emancipated',
      body: 'isEmancipated() is true: nobody holds the roles to unregister names, re-point them, or upgrade the registry. This is also what lets ENSv2 allow safe transfers at all.',
    },
    {
      id: 'issuer',
      group: 'titles',
      ok: f.controllerIsRegistrar && (f.graderRootRoles & ROLE.REGISTRAR) === 0n,
      title: 'The TitleController issues; the grader does not hold ROLE_REGISTRAR',
      body: 'The controller holds ROLE_REGISTRAR and enforces its rules: one title per cert, chip recorded, holder can only transfer. The grader keeps REGISTRAR admin to switch issuing contracts, so it could grant itself ROLE_REGISTRAR for new certs. A title made that way fails the per-title checks every buyer runs on the title page.',
    },
    {
      id: 'grader',
      group: 'titles',
      ok: f.graderRootRoles === GRADER_FINAL_ROOT_ROLES && (f.graderRootRoles & DANGEROUS_ROOT_ROLES) === 0n,
      title: 'PSA-Sim cannot touch issued titles',
      body: 'It keeps only REGISTRAR admin (to switch the issuing contract for future certs), SET_PARENT and CAN_NAME. It cannot unregister, re-point, or change the chip record of an issued title.',
    },
    {
      id: 'holders',
      group: 'titles',
      ok: f.holderRoles.length > 0 && holdersOk,
      title: `Holders can only transfer (${f.holderRoles.filter((h) => h.roles === TITLE_ROLES).length}/${f.holderRoles.length} titles)`,
      body: 'Each holder has exactly ROLE_CAN_TRANSFER_ADMIN on their title: no resolver changes, no hidden delegates. A buyer who receives a title is its only assignee.',
    },
    {
      id: 'tree',
      group: 'titles',
      ok:
        isAddressEqual(f.psaParent.parent, f.expected.nafudaRegistry) &&
        f.psaParent.label === f.expected.graderLabel &&
        isAddressEqual(f.nafudaParent.parent, f.expected.ethRegistry) &&
        f.nafudaParent.label === f.expected.nameLabel,
      title: `The registry tree is ${f.expected.graderLabel}.${f.expected.nameLabel}.eth`,
      body: 'Each registry’s getParent() points one level up, so any client can walk from a title to .eth.',
    },
    {
      id: 'lock-registry',
      group: 'lock',
      ok: f.nafudaEmancipated,
      title: `The ${f.expected.nameLabel}.eth registry is emancipated`,
      body: `Nobody can replace or re-point ${f.expected.graderLabel}.${f.expected.nameLabel}.eth from the registry root.`,
    },
    {
      id: 'lock-subtree',
      group: 'lock',
      ok: lockedSubtree === 0n,
      title: `Nobody can re-point ${f.expected.graderLabel}.${f.expected.nameLabel}.eth`,
      body: 'Neither PSA-Sim nor the operator can swap the grader’s registry or its resolver (the TitleController), so the chip records are fixed end to end.',
    },
    {
      id: 'lock-root',
      group: 'lock',
      ok: lockedRoot === 0n,
      title: `The operator cannot swap ${f.expected.nameLabel}.eth’s registry`,
      body: `The operator keeps ${f.expected.nameLabel}.eth itself but can no longer replace the registry under it. New graders can still be added.`,
    },
  ]
}
