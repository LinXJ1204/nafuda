// Off-chain, signed messages (EIP-712) for trade interest and grading submissions. They never
// move a title: the title only moves by an on-chain transfer from its holder. Shared by the apps
// (sign) and the server (verify). Pure; covered by signed.test.ts.

import { recoverTypedDataAddress, type Address, type Hex } from 'viem'
import { CHAIN_ID, isCanonicalCert } from './deployment.ts'

export const DOMAIN = { name: 'Nafuda', version: '1', chainId: CHAIN_ID } as const

export const TYPES = {
  Offer: [
    { name: 'grader', type: 'string' },
    { name: 'cert', type: 'string' },
    { name: 'kind', type: 'string' }, // "ask" (holder: open to sell at this price) or "bid" (anyone)
    { name: 'priceJpy', type: 'uint256' },
    { name: 'note', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
  Withdraw: [
    { name: 'offerId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
  Submission: [
    { name: 'grader', type: 'string' },
    { name: 'card', type: 'string' },
    { name: 'declaredValueJpy', type: 'uint256' },
    { name: 'service', type: 'string' },
    { name: 'nonce', type: 'uint256' },
  ],
  GraderAction: [
    { name: 'submissionId', type: 'uint256' },
    { name: 'action', type: 'string' }, // "grading" | "sealed" | "issued" | "rejected"
    { name: 'grade', type: 'string' },
    { name: 'cert', type: 'string' },
    { name: 'txHash', type: 'string' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

export type Offer = { grader: string; cert: string; kind: 'ask' | 'bid'; priceJpy: bigint; note: string; nonce: bigint; expiry: bigint }
export type Withdraw = { offerId: bigint; nonce: bigint }
export type Submission = { grader: string; card: string; declaredValueJpy: bigint; service: string; nonce: bigint }
export type GraderAction = { submissionId: bigint; action: 'grading' | 'sealed' | 'issued' | 'rejected'; grade: string; cert: string; txHash: string; nonce: bigint }

export const MAX_NOTE = 140
export const MAX_PRICE_JPY = 100_000_000n
export const SERVICES = ['Economy', 'Regular', 'Express'] as const
export const SUBMISSION_FLOW = ['received', 'grading', 'sealed', 'issued'] as const

/// How far from now a signed nonce (ms timestamp) may be: stops replaying old signatures.
export const NONCE_WINDOW_MS = 10 * 60_000

function freshNonce(nonce: bigint, nowMs: number) {
  return nonce <= BigInt(nowMs + 60_000) && nonce >= BigInt(nowMs - NONCE_WINDOW_MS)
}

export function checkOffer(o: Offer, nowMs = Date.now()): string | null {
  if (!isCanonicalCert(o.cert)) return 'bad cert'
  if (o.kind !== 'ask' && o.kind !== 'bid') return 'kind must be ask or bid'
  if (o.priceJpy <= 0n || o.priceJpy > MAX_PRICE_JPY) return 'price out of range'
  if (o.note.length > MAX_NOTE) return `note longer than ${MAX_NOTE} characters`
  if (!freshNonce(o.nonce, nowMs)) return 'stale signature'
  if (o.expiry <= BigInt(Math.floor(nowMs / 1000)) || o.expiry > BigInt(Math.floor(nowMs / 1000) + 30 * 86400)) return 'expiry must be within 30 days'
  return null
}

export function checkSubmission(s: Submission, graders: string[], nowMs = Date.now()): string | null {
  if (!graders.includes(s.grader)) return 'unknown grader'
  if (!s.card.trim() || s.card.length > 64) return 'card name must be 1–64 characters'
  if (s.declaredValueJpy <= 0n || s.declaredValueJpy > MAX_PRICE_JPY) return 'declared value out of range'
  if (!(SERVICES as readonly string[]).includes(s.service)) return 'unknown service level'
  if (!freshNonce(s.nonce, nowMs)) return 'stale signature'
  return null
}

/// The next status a grader may move a submission to.
export function nextStatus(current: string): string | null {
  const i = (SUBMISSION_FLOW as readonly string[]).indexOf(current)
  return i >= 0 && i < SUBMISSION_FLOW.length - 1 ? SUBMISSION_FLOW[i + 1] : null
}

export function checkGraderAction(a: GraderAction, current: string, nowMs = Date.now()): string | null {
  if (!freshNonce(a.nonce, nowMs)) return 'stale signature'
  if (a.action === 'rejected') return current === 'issued' ? 'already issued' : null
  if (nextStatus(current) !== a.action) return `cannot go from ${current} to ${a.action}`
  if (a.action === 'grading' && a.grade) return 'grade is set when sealing'
  if (a.action === 'sealed' && (!a.grade || !isCanonicalCert(a.cert))) return 'sealing needs a grade and a cert'
  if (a.action === 'issued' && !/^0x[0-9a-fA-F]{64}$/.test(a.txHash)) return 'issuing needs the transaction hash'
  return null
}

export const recoverOffer = (o: Offer, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ domain: DOMAIN, types: TYPES, primaryType: 'Offer', message: o, signature })
export const recoverWithdraw = (w: Withdraw, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ domain: DOMAIN, types: TYPES, primaryType: 'Withdraw', message: w, signature })
export const recoverSubmission = (s: Submission, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ domain: DOMAIN, types: TYPES, primaryType: 'Submission', message: s, signature })
export const recoverGraderAction = (a: GraderAction, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ domain: DOMAIN, types: TYPES, primaryType: 'GraderAction', message: a, signature })
