// Second witness: Curvegrid MultiBaas indexes the grader registries on its own infrastructure and
// pushes each event to us by a signed webhook. This module is the pure part: check the signature,
// turn a delivery into rows, and compare those rows with our own index in both directions.
// Witness rows are never written into titles or transfers; they are only compared against them.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { decodeEventLog, type Hex } from 'viem'
import { canonicalId, transferBatchEvent, transferSingleEvent } from '../../packages/core/src/abis.ts'

const ZERO = '0x0000000000000000000000000000000000000000'
export const MAX_SKEW_SEC = 300

// ---------------------------------------------------------------------------------------------
// Signature: hex(HMAC-SHA256(secret, body || timestamp)), timestamp in unix seconds as a decimal
// string (MultiBaas docs, "Validating the data").

export type SignatureCheck = 'ok' | 'missing' | 'stale' | 'bad-signature'

export function signBody(body: Uint8Array | string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(body).update(timestamp).digest('hex')
}

export function checkSignature(input: {
  body: Uint8Array
  signature: string | undefined
  timestamp: string | undefined
  secret: string
  nowSec: number
}): SignatureCheck {
  const { signature, timestamp } = input
  if (!signature || !timestamp || !/^\d{1,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return 'missing'
  const expected = Buffer.from(signBody(input.body, timestamp, input.secret), 'hex')
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return 'bad-signature'
  // Checked after the signature, so an attacker learns nothing about the window from the answer.
  if (Math.abs(input.nowSec - Number(timestamp)) > MAX_SKEW_SEC) return 'stale'
  return 'ok'
}

// ---------------------------------------------------------------------------------------------
// Delivery → rows. We decode the raw log ourselves (topics, data, position) instead of trusting
// the decoded inputs MultiBaas adds, which are formatted for display.

export type WitnessKind = 'transfer' | 'mint' | 'burn'
export type WitnessRow = {
  deliveryId: string
  grader: string
  registry: string
  tx: string
  logIndex: number
  batchIndex: number
  block: bigint
  blockHash: string
  kind: WitnessKind
  from: string
  to: string
  tokenId: bigint
  removed: boolean
  triggeredAt: Date | null
}

type RawLog = { address: string; topics: Hex[]; data: Hex; blockNumber: string; transactionHash: string; blockHash: string; logIndex: string; removed?: boolean }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isHash = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)
const quantity = (v: unknown): bigint | null => (typeof v === 'string' && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? BigInt(v) : typeof v === 'number' && Number.isSafeInteger(v) ? BigInt(v) : null)

function rawLog(item: Record<string, unknown>): RawLog | null {
  const data = item.data
  if (!isObj(data) || !isObj(data.event) || typeof data.event.rawFields !== 'string') return null
  let raw: unknown
  try {
    raw = JSON.parse(data.event.rawFields)
  } catch {
    return null
  }
  if (!isObj(raw) || typeof raw.address !== 'string' || !Array.isArray(raw.topics) || typeof raw.data !== 'string') return null
  if (!isHash(raw.transactionHash) || !isHash(raw.blockHash) || quantity(raw.blockNumber) === null || quantity(raw.logIndex) === null) return null
  return raw as unknown as RawLog
}

/// Rows for every registry transfer in a delivery. Anything else (other event types, contracts
/// that are not a grader registry, malformed items) is counted as ignored.
export function parseDelivery(body: unknown, graderOfRegistry: (address: string) => string | null): { rows: WitnessRow[]; ignored: number } {
  const rows: WitnessRow[] = []
  let ignored = 0
  if (!Array.isArray(body)) return { rows, ignored: 1 }
  for (const item of body) {
    if (!isObj(item) || item.event !== 'event.emitted' || typeof item.id !== 'string') {
      ignored++
      continue
    }
    const raw = rawLog(item)
    const grader = raw ? graderOfRegistry(raw.address) : null
    if (!raw || !grader) {
      ignored++
      continue
    }
    let decoded
    try {
      decoded = decodeEventLog({ abi: [transferSingleEvent, transferBatchEvent], topics: raw.topics as [Hex, ...Hex[]], data: raw.data, strict: true })
    } catch {
      ignored++
      continue
    }
    const from = decoded.args.from.toLowerCase()
    const to = decoded.args.to.toLowerCase()
    const ids = decoded.eventName === 'TransferSingle' ? [decoded.args.id] : decoded.args.ids
    const triggeredAt = isObj(item.data) && typeof item.data.triggeredAt === 'string' ? new Date(item.data.triggeredAt) : null
    ids.forEach((tokenId, batchIndex) =>
      rows.push({
        deliveryId: item.id as string,
        grader,
        registry: raw.address.toLowerCase(),
        tx: raw.transactionHash.toLowerCase(),
        logIndex: Number(quantity(raw.logIndex)),
        batchIndex,
        block: quantity(raw.blockNumber)!,
        blockHash: raw.blockHash.toLowerCase(),
        kind: from === ZERO ? 'mint' : to === ZERO ? 'burn' : 'transfer',
        from,
        to,
        tokenId,
        removed: raw.removed === true,
        triggeredAt: triggeredAt && !Number.isNaN(triggeredAt.getTime()) ? triggeredAt : null,
      }),
    )
  }
  return { rows, ignored }
}

// ---------------------------------------------------------------------------------------------
// Reconciliation, both ways:
//   witnessed → index: every event Curvegrid saw must be in our index (or be a token-id
//     regeneration, which is not a change of holder and which neither side records);
//   index → witnessed: every transfer and issuance we indexed inside the window Curvegrid covers
//     must have been seen by Curvegrid. This direction is the one that would catch our own
//     server inventing a record.

export type Verdict = 'agreed' | 'mismatch' | 'missing' | 'pending' | 'regeneration'
export type IndexTransfer = { grader: string; cert: string; tx: string; logIndex: number; batchIndex: number; block: bigint; from: string; to: string }
export type IndexIssue = { grader: string; cert: string; labelId: bigint; tx: string; block: bigint; holder: string }

export type Judged = WitnessRow & { cert: string | null; verdict: Verdict; detail: string | null }
export type Unwitnessed = { kind: 'transfer' | 'issue'; grader: string; cert: string; tx: string; block: bigint }
export type Summary = {
  witnessed: number
  agreed: number
  mismatch: number
  missing: number
  pending: number
  regeneration: number
  unwitnessed: number
  reorged: number
  fromBlock: bigint | null
  toBlock: bigint | null
}

const tkey = (tx: string, logIndex: number, batchIndex: number) => `${tx}:${logIndex}:${batchIndex}`
const ckey = (grader: string, id: bigint) => `${grader}:${canonicalId(id)}`

export function reconcile(input: {
  witnessed: WitnessRow[]
  transfers: IndexTransfer[]
  issues: IndexIssue[]
  /// last block our indexer has fully written, or null before its first batch
  indexedThrough: bigint | null
}): { events: Judged[]; unwitnessed: Unwitnessed[]; summary: Summary } {
  const live = input.witnessed.filter((w) => !w.removed)
  const reorged = input.witnessed.length - live.length
  const certOf = new Map(input.issues.map((i) => [ckey(i.grader, i.labelId), i.cert]))
  const transfers = new Map(input.transfers.map((t) => [tkey(t.tx, t.logIndex, t.batchIndex), t]))
  const issuesByTx = new Map<string, IndexIssue[]>()
  for (const i of input.issues) issuesByTx.set(i.tx, [...(issuesByTx.get(i.tx) ?? []), i])
  // A regeneration burns and re-mints the same name in one transaction.
  const burned = new Set(live.filter((w) => w.kind === 'burn').map((w) => `${w.tx}:${ckey(w.grader, w.tokenId)}`))
  const minted = new Set(live.filter((w) => w.kind === 'mint').map((w) => `${w.tx}:${ckey(w.grader, w.tokenId)}`))
  const notYet = (block: bigint) => input.indexedThrough === null || block > input.indexedThrough

  const events: Judged[] = live.map((w) => {
    const cert = certOf.get(ckey(w.grader, w.tokenId)) ?? null
    const judged = (verdict: Verdict, detail: string | null = null): Judged => ({ ...w, cert, verdict, detail })
    const pair = `${w.tx}:${ckey(w.grader, w.tokenId)}`
    if ((w.kind === 'mint' && burned.has(pair)) || (w.kind === 'burn' && minted.has(pair))) return judged('regeneration')
    if (w.kind === 'mint') {
      const issue = (issuesByTx.get(w.tx) ?? []).find((i) => i.grader === w.grader && canonicalId(i.labelId) === canonicalId(w.tokenId))
      if (issue) return judged('agreed')
      return notYet(w.block) ? judged('pending') : judged('missing', 'minted without a TitleIssued event from the grader’s controller')
    }
    if (w.kind === 'burn') return notYet(w.block) ? judged('pending') : judged('missing', 'a burn that the index does not record')
    const mine = transfers.get(tkey(w.tx, w.logIndex, w.batchIndex))
    if (!mine) return notYet(w.block) ? judged('pending') : judged('missing')
    const diffs = [
      mine.grader !== w.grader && `grader ${mine.grader} ≠ ${w.grader}`,
      mine.from !== w.from && `from ${mine.from} ≠ ${w.from}`,
      mine.to !== w.to && `to ${mine.to} ≠ ${w.to}`,
      cert !== null && mine.cert !== cert && `cert ${mine.cert} ≠ ${cert}`,
    ].filter(Boolean)
    return diffs.length ? judged('mismatch', diffs.join('; ')) : judged('agreed')
  })

  // Window Curvegrid covers: from its first event to (not including) its latest block, and never
  // past what our indexer has written. Rows in the latest block are left out, in case the rest of
  // that block's events are still on their way.
  const blocks = live.map((w) => w.block)
  const fromBlock = blocks.length ? blocks.reduce((a, b) => (b < a ? b : a)) : null
  const toBlock = blocks.length ? blocks.reduce((a, b) => (b > a ? b : a)) : null
  const unwitnessed: Unwitnessed[] = []
  if (fromBlock !== null && toBlock !== null) {
    const inWindow = (block: bigint) => block >= fromBlock && block < toBlock && !notYet(block)
    const seen = new Set(live.map((w) => tkey(w.tx, w.logIndex, w.batchIndex)))
    const seenMints = new Set(live.filter((w) => w.kind === 'mint').map((w) => `${w.tx}:${ckey(w.grader, w.tokenId)}`))
    for (const t of input.transfers)
      if (inWindow(t.block) && !seen.has(tkey(t.tx, t.logIndex, t.batchIndex))) unwitnessed.push({ kind: 'transfer', grader: t.grader, cert: t.cert, tx: t.tx, block: t.block })
    for (const i of input.issues)
      if (inWindow(i.block) && !seenMints.has(`${i.tx}:${ckey(i.grader, i.labelId)}`)) unwitnessed.push({ kind: 'issue', grader: i.grader, cert: i.cert, tx: i.tx, block: i.block })
  }

  const count = (v: Verdict) => events.filter((e) => e.verdict === v).length
  return {
    events,
    unwitnessed,
    summary: {
      witnessed: events.length,
      agreed: count('agreed'),
      mismatch: count('mismatch'),
      missing: count('missing'),
      pending: count('pending'),
      regeneration: count('regeneration'),
      unwitnessed: unwitnessed.length,
      reorged,
      fromBlock,
      toBlock,
    },
  }
}
