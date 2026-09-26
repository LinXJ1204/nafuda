// The access-control map: every resource that matters, who holds what on it, and how risky that
// is for issued titles, today and after the final lock (projected). Pure; eac-map.test.ts.

import { GRADER_NAME_TOKEN_ROLES, ROLE, decodeRoles } from './roles.ts'

/// Roles that can change or take back names (the ENSv2 "unemancipated" set)
export const DANGEROUS = ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY) | ROLE.SET_RESOLVER | ROLE.admin(ROLE.SET_RESOLVER) | ROLE.UNREGISTER | ROLE.admin(ROLE.UNREGISTER) | ROLE.UPGRADE | ROLE.admin(ROLE.UPGRADE)
const ROOT_NAME_LOCKED = ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY)

export type Holding = { who: string; bitmap: bigint }
export type MapNode = {
  id: string
  title: string
  subtitle: string
  kind: 'root-name' | 'registry-root' | 'grader-name' | 'grader-registry' | 'title' | 'identity'
  holdings: Holding[]
}
export type Risk = 'fixed' | 'owner' | 'power'

/// fixed: nobody can change titles through this resource. owner: only the owner's own identity
/// name. power: someone can still re-point, swap or unregister something titles depend on.
export function riskOf(n: MapNode): Risk {
  if (n.kind === 'identity') return 'owner'
  if (n.kind === 'root-name') return n.holdings.some((h) => (h.bitmap & ROOT_NAME_LOCKED) !== 0n) ? 'power' : 'fixed'
  return n.holdings.some((h) => (h.bitmap & DANGEROUS) !== 0n) ? 'power' : 'fixed'
}

/// What the final lock (scripts/src/lock.ts) revokes, applied to today's map.
export function projectLock(nodes: MapNode[]): MapNode[] {
  return nodes.map((n) => ({
    ...n,
    holdings: n.holdings.map((h) => {
      if (n.kind === 'grader-name') return { ...h, bitmap: h.bitmap & ~GRADER_NAME_TOKEN_ROLES }
      if (n.kind === 'registry-root') return { ...h, bitmap: h.bitmap & ~DANGEROUS }
      if (n.kind === 'root-name') return { ...h, bitmap: h.bitmap & ~ROOT_NAME_LOCKED }
      return h
    }),
  }))
}

/// "all roles", or the role names (without unnamed bits)
export function describe(bitmap: bigint): string {
  if (bitmap === BigInt('0x' + '1'.repeat(64))) return 'all roles'
  const names = decodeRoles(bitmap).filter((r) => !r.startsWith('bit '))
  return names.length ? names.join(', ') : 'none'
}
