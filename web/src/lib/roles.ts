// ENSv2 registry roles (mirror of RegistryRolesLib in the pinned Beta source). A role bitmap
// packs each role in a nybble; the admin of a role sits 128 bits higher. Pure; roles.test.ts.

const admin = (role: bigint) => role << 128n

export const ROLE = {
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER: 1n << 28n, // only its admin bit is ever granted (ROLE_CAN_TRANSFER_ADMIN)
  SET_URI: 1n << 36n,
  CAN_NAME: 1n << 120n,
  UPGRADE: 1n << 124n,
  admin,
} as const

type RoleName = Exclude<keyof typeof ROLE, 'admin'>
const NAMES = Object.entries(ROLE).filter(([, v]) => typeof v === 'bigint') as [RoleName, bigint][]

/// What the grader keeps on its registry root (pinned by the Solidity setup test).
export const GRADER_FINAL_ROOT_ROLES =
  admin(ROLE.REGISTRAR) | ROLE.SET_PARENT | admin(ROLE.SET_PARENT) | ROLE.CAN_NAME | admin(ROLE.CAN_NAME)

/// The only role a title holder gets.
export const TITLE_ROLES = admin(ROLE.CAN_TRANSFER)

/// Roles that would let someone change or take back an existing title.
export const DANGEROUS_ROOT_ROLES =
  ROLE.REGISTRAR | ROLE.UNREGISTER | ROLE.SET_SUBREGISTRY | ROLE.SET_RESOLVER | ROLE.UPGRADE |
  admin(ROLE.UNREGISTER) | admin(ROLE.SET_SUBREGISTRY) | admin(ROLE.SET_RESOLVER) | admin(ROLE.UPGRADE)

/// The grader's powers over its own name `psa-sim` in nafudaRegistry, removed by the final lock.
export const GRADER_NAME_TOKEN_ROLES =
  ROLE.SET_SUBREGISTRY | admin(ROLE.SET_SUBREGISTRY) | ROLE.SET_RESOLVER | admin(ROLE.SET_RESOLVER)

/// ["REGISTRAR admin", "SET_PARENT", …]; unknown bits are listed as "bit N".
export function decodeRoles(bitmap: bigint): string[] {
  const out: string[] = []
  let rest = bitmap
  for (const [name, bit] of NAMES) {
    if (bitmap & bit) out.push(name)
    if (bitmap & admin(bit)) out.push(`${name} admin`)
    rest &= ~(bit | admin(bit))
  }
  for (let i = 0n; rest; i++, rest >>= 1n) if (rest & 1n) out.push(`bit ${i}`)
  return out
}
