// Pure verification logic: chip challenge, signature check, and the outcome table from
// docs/plan/slab-title-plan.md §1.3. No DOM, no network; covered by verify.test.ts.
//
// Principle: a chip signature is proof, never authorization. Nothing here changes state.

import { bytesToHex, isAddressEqual, recoverMessageAddress, type Address, type Hex } from 'viem'

export const CHALLENGE_TTL_SECONDS = 60

export type Challenge = {
  grader: string
  cert: string
  nonce: Hex
  issuedAt: number // unix seconds
  message: string
}

/// `ENS-SLAB|<grader>|<cert>|<nonce>|<unix seconds>`, signed with EIP-191 (what HaLo chips support).
export function makeChallenge(grader: string, cert: string, nowMs = Date.now()): Challenge {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  const issuedAt = Math.floor(nowMs / 1000)
  return { grader, cert, nonce, issuedAt, message: `ENS-SLAB|${grader}|${cert}|${nonce}|${issuedAt}` }
}

export type ChipCheck =
  | { ok: true; signer: Address }
  | { ok: false; reason: 'expired' | 'wrong-chip' | 'bad-signature'; signer?: Address }

/// The signature must be over *this* challenge (fresh nonce the buyer generated) and come from
/// the chip address recorded on ENS. A signature captured earlier recovers to some other
/// address over the new message, so replays fail as `wrong-chip`.
export async function checkChip(
  challenge: Challenge,
  signature: Hex,
  expectedChip: Address,
  nowMs = Date.now(),
): Promise<ChipCheck> {
  if (Math.floor(nowMs / 1000) - challenge.issuedAt > CHALLENGE_TTL_SECONDS) return { ok: false, reason: 'expired' }
  let signer: Address
  try {
    signer = await recoverMessageAddress({ message: challenge.message, signature })
  } catch {
    return { ok: false, reason: 'bad-signature' }
  }
  return isAddressEqual(signer, expectedChip) ? { ok: true, signer } : { ok: false, reason: 'wrong-chip', signer }
}

export type Title = {
  status: 'ISSUED' | 'NONE'
  holder: Address | null
  chip: Address | null
}

export type Outcome = 'GENUINE_AND_HOLDER' | 'GENUINE_NOT_HOLDER' | 'NOT_SEALED_BY_GRADER' | 'NO_TITLE'

/// §1.3: chip first (which physical slab), then title (who owns it).
export function classify(title: Title, chip: ChipCheck | null, seller: Address | null): Outcome {
  if (title.status !== 'ISSUED' || !title.chip) return 'NO_TITLE'
  if (!chip || !chip.ok) return 'NOT_SEALED_BY_GRADER'
  if (seller && title.holder && isAddressEqual(seller, title.holder)) return 'GENUINE_AND_HOLDER'
  return 'GENUINE_NOT_HOLDER'
}

export const OUTCOME_TEXT: Record<Outcome, { tone: 'ok' | 'warn' | 'bad' | 'none'; title: string; body: string }> = {
  GENUINE_AND_HOLDER: {
    tone: 'ok',
    title: 'Genuine slab, and the seller is the registered holder',
    body: 'This is the slab the grader sealed. Pay, then have the seller transfer the title to you on the spot.',
  },
  GENUINE_NOT_HOLDER: {
    tone: 'warn',
    title: 'Genuine slab, but the seller is not the registered holder',
    body: 'Ask for the title transfer first. If the seller cannot transfer it, do not buy: the card may be stolen, or a past sale was never recorded.',
  },
  NOT_SEALED_BY_GRADER: {
    tone: 'bad',
    title: 'This is not the slab the grader sealed',
    body: 'The chip did not prove it is the slab recorded for this cert. It is a clone, or the chip was swapped.',
  },
  NO_TITLE: {
    tone: 'none',
    title: 'No title for this cert',
    body: 'The grader has not issued a title for this cert (not a participating grader, or an older slab). Nafuda cannot tell either way.',
  },
}
