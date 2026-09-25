// Pure pre-send checks for issuing a title: the same conditions TitleController.issue enforces,
// so the console explains a problem instead of sending a transaction that would revert.
// Covered by rules.test.ts.

import { isAddress, isAddressEqual, zeroAddress, type Address } from 'viem'
import { isCanonicalCert } from '../lib/ens.ts'
import { short } from '../lib/dom.ts'

/// PSA's 1–10 scale, as PSA-Sim uses it.
export const GRADES = ['GEM MT 10', 'MINT 9', 'NM-MT 8', 'NM 7', 'EX-MT 6', 'EX 5', 'VG-EX 4', 'VG 3', 'GOOD 2', 'PR 1']
export const MAX_CARD_LENGTH = 64

export type IssueForm = { cert: string; card: string; grade: string; holder: string; chip: Address }

/// Everything the contract would reject, checked up front. Returns the reason, or null if OK.
export function precheck(form: IssueForm, account: Address | null, grader: Address, alreadyHeldBy: Address): string | null {
  if (!account) return 'Connect the PSA-Sim grader wallet first.'
  if (!isAddressEqual(account, grader)) return `Connected as ${short(account)}, which is not the grader. Only ${short(grader)} (TitleController.GRADER) can issue.`
  if (!isCanonicalCert(form.cert)) return 'A cert number is 1–10 digits with no leading zero.'
  if (!isAddressEqual(alreadyHeldBy, zeroAddress)) return `Cert #${form.cert} already has a title (held by ${short(alreadyHeldBy)}). A cert can be issued only once.`
  if (!isAddress(form.holder) || isAddressEqual(form.holder, zeroAddress)) return 'Enter the submitter’s address as the holder.'
  const card = form.card.trim()
  if (!card) return 'Enter the card name.'
  if (card.length > MAX_CARD_LENGTH) return `Keep the card name under ${MAX_CARD_LENGTH} characters.`
  if (!GRADES.includes(form.grade)) return 'Pick a grade.'
  return null
}

