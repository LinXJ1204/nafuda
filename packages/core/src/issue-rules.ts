// Pure pre-send checks for issuing a title: the conditions the grader's controller enforces,
// checked in the console before the wallet is asked to sign. Covered by issue-rules.test.ts.

import { isAddress, isAddressEqual, zeroAddress, type Address } from 'viem'
import { isCanonicalCert, type Grader } from './deployment.ts'
import { chipKey } from './chips.ts'
import { privateKeyToAddress } from 'viem/accounts'
import { CATALOG } from './deployment.ts'

export const MAX_CARD_LENGTH = 64
export const SUBGRADE_VALUES = ['10', '9.5', '9', '8.5', '8', '7.5', '7']

export type IssueForm = { cert: string; card: string; grade: string; holder: string; chip: Address; subgrades: Record<string, string> }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function precheck(form: IssueForm, grader: Pick<Grader, 'grader' | 'scale' | 'subgrades' | 'short'>, account: Address | null, alreadyHeldBy: Address): string | null {
  if (!account) return `Connect the ${grader.short} grader wallet first.`
  if (!isAddressEqual(account, grader.grader)) return `Connected as ${short(account)}, which is not ${grader.short}. Only ${short(grader.grader)} can issue its titles.`
  if (!isCanonicalCert(form.cert)) return 'A cert number is 1–10 digits with no leading zero.'
  if (!isAddressEqual(alreadyHeldBy, zeroAddress)) return `Cert #${form.cert} already has a title (held by ${short(alreadyHeldBy)}). A cert can be issued only once.`
  if (!isAddress(form.holder) || isAddressEqual(form.holder, zeroAddress)) return 'Enter the submitter’s address as the holder.'
  const card = form.card.trim()
  if (!card) return 'Enter the card name.'
  if (card.length > MAX_CARD_LENGTH) return `Keep the card name under ${MAX_CARD_LENGTH} characters.`
  if (!grader.scale.includes(form.grade)) return `Pick a grade on the ${grader.short} scale.`
  for (const k of grader.subgrades) if (!SUBGRADE_VALUES.includes(form.subgrades[k] ?? '')) return `Pick the ${k} subgrade.`
  return null
}

export type BenchSlab = { cert: string; card: string; chip: Address }

/// Slabs on the grader's bench: graded and sealed, no title yet. psa-sim keeps the original demo
/// pool (12345680–12345689); the others continue after the seed plan's range.
export function bench(grader: Pick<Grader, 'label' | 'seedCertStart'> & { seedCertStart?: number }, count = 10): BenchSlab[] {
  const start = grader.label === 'psa-sim' ? 12345680 : (grader.seedCertStart ?? 1) + 20
  return Array.from({ length: count }, (_, i) => {
    const cert = String(start + i)
    const card = CATALOG[(Number(cert) * 7) % CATALOG.length].card
    return { cert, card, chip: privateKeyToAddress(chipKey(grader.label, 'genuine', cert)) }
  })
}
