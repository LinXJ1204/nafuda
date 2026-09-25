// The demo data plan (v3): which titles exist, who submitted them, which card and grade.
// Pure and deterministic (seeded PRNG), so seed.ts and market.ts agree on it without any
// shared state, and re-running either one never issues anything twice.
//
//   per grader: TITLES_PER_GRADER titles, certs seedCertStart + 0, 1, 2 …
//   the first ISSUE_NOW are issued by seed.ts; the rest by market.ts over the night
//   the author's wallet submits one slab per grader (issued now)

import { readFileSync } from 'node:fs'
import { getAddress, keccak256, toBytes, type Address, type Hex } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'

const demo = (file: string) => JSON.parse(readFileSync(new URL(`../../demo/${file}`, import.meta.url), 'utf8'))

export type GraderDef = {
  short: string
  name: string
  modeledAfter: string
  color: string
  certDigits: number
  seedCertStart: number
  scale: string[]
  subgrades?: string[]
  controller: 1 | 2
}
export const GRADERS: Record<string, GraderDef> = demo('graders.json').graders
export const CATALOG: { card: string; name: string; rarity: string; set: string }[] = demo('catalog.json').cards
export const COLLECTORS: { name: string; address: Address; source: 'env' | 'mnemonic' | 'external' }[] = demo('collectors.json').collectors

export const TITLES_PER_GRADER = 20
export const ISSUE_NOW = 12
/// Kept for the live demo (issued on camera from the grader console): never seeded.
export const RESERVED_PSA_POOL = { from: 12345680, to: 12345689 }

/// mulberry32: small deterministic PRNG
export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/// Simulated chip keys (public test keys). psa-sim keeps the original formula so the existing
/// demo slabs and test vectors stay valid; other graders include the label.
export function chipKey(grader: string, variant: 'genuine' | 'clone', cert: string): Hex {
  const seed = grader === 'psa-sim' ? `nafuda-demo-chip:${variant}:${cert}` : `nafuda-demo-chip:${grader}:${variant}:${cert}`
  return keccak256(toBytes(seed))
}
export const chipAddress = (grader: string, variant: 'genuine' | 'clone', cert: string) => privateKeyToAddress(chipKey(grader, variant, cert))

export type PlannedTitle = {
  grader: string
  cert: string
  card: string
  grade: string
  holder: Address
  holderName: string
  chip: Address
  attributes: [key: string, value: string][]
  now: boolean // issued by seed.ts (true) or by the market simulator later (false)
}

const pick = <T>(rand: () => number, items: T[]) => items[Math.floor(rand() * items.length)]

/// Grade index into the scale, skewed to the top like real submissions (most slabs sent in are
/// expected to grade high).
function gradeIndex(rand: () => number, n: number) {
  const r = rand()
  const i = r < 0.22 ? 0 : r < 0.55 ? 1 : r < 0.78 ? 2 : r < 0.92 ? 3 : 4
  return Math.min(i, n - 1)
}

function subgrades(rand: () => number, keys: string[], grade: string): [string, string][] {
  const overall = Number(/(\d+(?:\.\d)?)$/.exec(grade)?.[1] ?? '9')
  return keys.map((k) => {
    const delta = pick(rand, [-0.5, 0, 0, 0.5])
    const v = Math.max(7, Math.min(10, overall + delta))
    return [`subgrade.${k}`, String(v)]
  })
}

export function seedPlan(): PlannedTitle[] {
  const rand = prng(20260925)
  const submitters = COLLECTORS.filter((c) => c.name !== 'mallory' && c.source !== 'external')
  const author = COLLECTORS.find((c) => c.source === 'external')!
  const cards = CATALOG.slice(2) // the first two are the original psa-sim demo slabs
  const plan: PlannedTitle[] = []
  for (const [label, g] of Object.entries(GRADERS)) {
    for (let i = 0; i < TITLES_PER_GRADER; i++) {
      const cert = String(g.seedCertStart + i)
      const holder = i === 1 ? author : pick(rand, submitters)
      const grade = g.scale[gradeIndex(rand, g.scale.length)]
      plan.push({
        grader: label,
        cert,
        card: pick(rand, cards).card,
        grade,
        holder: getAddress(holder.address),
        holderName: holder.name,
        chip: chipAddress(label, 'genuine', cert),
        attributes: g.subgrades ? subgrades(rand, g.subgrades, grade) : [],
        now: i < ISSUE_NOW,
      })
    }
  }
  return plan
}

/// Declared sale price, carried in the `data` argument of safeTransferFrom:
/// "NFDP" magic (4 bytes) + uint256 price in JPY. Self-reported by the seller, never verified.
export const PRICE_MAGIC = '0x4e464450'
export function encodePrice(jpy: number): Hex {
  return `${PRICE_MAGIC}${BigInt(jpy).toString(16).padStart(64, '0')}` as Hex
}
export function decodePrice(data: Hex): number | null {
  if (!data.startsWith(PRICE_MAGIC) || data.length !== 2 + 8 + 64) return null
  return Number(BigInt(`0x${data.slice(10)}`))
}

/// A plausible asking price for a slab: rarity and grade drive it; noise keeps it human.
export function priceFor(rand: () => number, card: string, grade: string): number {
  const rarity = /- (\w+) #/.exec(card)?.[1] ?? 'Common'
  const base = { Secret: 180000, Holo: 60000, Promo: 45000, Rare: 30000, Uncommon: 12000, Common: 6000 }[rarity] ?? 8000
  const score = Number(/(\d+(?:\.\d)?)$/.exec(grade)?.[1] ?? '8')
  const gradeMult = score >= 10 ? 3 : score >= 9.5 ? 2 : score >= 9 ? 1.3 : score >= 8 ? 0.8 : 0.5
  const noise = 0.75 + rand() * 0.6
  return Math.round((base * gradeMult * noise) / 500) * 500
}
