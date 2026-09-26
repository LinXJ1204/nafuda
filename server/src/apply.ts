// Pure part of the indexer: turn one batch of logs into the rows to write. No I/O; the caller
// supplies block times, declared prices and the known label ids. Covered by apply.test.ts.

import { canonicalId } from '../../packages/core/src/abis.ts'
import { gradeScore } from '../../packages/core/src/slab.ts'
import type { Address, Hash } from 'viem'

type Pos = { blockNumber: bigint; logIndex: number; transactionHash: Hash; batchIndex?: number }
export type IssuedLog = Pos & { grader: string; args: { labelId: bigint; cert: string; holder: Address; chip: Address; card: string; grade: string } }
export type AttributeLog = Pos & { grader: string; args: { labelId: bigint; key: string; value: string } }
export type TransferLog = Pos & { grader: string; args: { from: Address; to: Address; id: bigint } }
export type TransferBatchLog = Omit<Pos, 'batchIndex'> & { grader: string; args: { from: Address; to: Address; ids: readonly bigint[] } }

export type TitleRow = {
  grader: string
  cert: string
  labelId: bigint
  card: string
  grade: string
  gradeScore: number
  chip: string
  holder: string
  issuedBlock: bigint
  issuedTx: string
  issuedAt: Date
}
export type TransferRow = {
  grader: string
  cert: string
  from: string
  to: string
  block: bigint
  logIndex: number
  /// position within a TransferBatch log (0 for TransferSingle)
  batchIndex: number
  tx: string
  time: Date
  priceJpy: number | null
}
export type AttributeRow = { grader: string; cert: string; key: string; value: string }

const ZERO = '0x0000000000000000000000000000000000000000'
const lower = (a: string) => a.toLowerCase()
const byPosition = (a: Pos, b: Pos) =>
  a.blockNumber !== b.blockNumber ? (a.blockNumber < b.blockNumber ? -1 : 1) : a.logIndex !== b.logIndex ? a.logIndex - b.logIndex : (a.batchIndex ?? 0) - (b.batchIndex ?? 0)

/// One TransferBatch log moves several names; give each its own transfer, keyed by its position.
export const expandBatch = (log: TransferBatchLog): TransferLog[] =>
  log.args.ids.map((id, batchIndex) => ({ ...log, batchIndex, args: { from: log.args.from, to: log.args.to, id } }))
const key = (grader: string, id: bigint) => `${grader}:${canonicalId(id)}`

export function applyBatch(input: {
  issued: IssuedLog[]
  attributes: AttributeLog[]
  transfers: TransferLog[]
  /// cert for label ids indexed in earlier batches, keyed `${grader}:${canonicalId}`
  knownCerts: Map<string, string>
  blockTime: (block: bigint) => Date
  /// declared price by transaction hash (from the transfer's calldata), if any. A batch declares
  /// one price for all its names, so the caller returns null for batches.
  priceOf: (tx: Hash) => number | null
}): { titles: TitleRow[]; attributes: AttributeRow[]; transfers: TransferRow[] } {
  const certs = new Map(input.knownCerts)
  const titles: TitleRow[] = []
  for (const log of [...input.issued].sort(byPosition)) {
    const a = log.args
    certs.set(key(log.grader, a.labelId), a.cert)
    titles.push({
      grader: log.grader,
      cert: a.cert,
      labelId: a.labelId,
      card: a.card,
      grade: a.grade,
      gradeScore: gradeScore(a.grade),
      chip: lower(a.chip),
      holder: lower(a.holder),
      issuedBlock: log.blockNumber,
      issuedTx: log.transactionHash,
      issuedAt: input.blockTime(log.blockNumber),
    })
  }
  const attributes: AttributeRow[] = []
  for (const log of [...input.attributes].sort(byPosition)) {
    const cert = certs.get(key(log.grader, log.args.labelId))
    if (cert) attributes.push({ grader: log.grader, cert, key: log.args.key, value: log.args.value })
  }
  const transfers: TransferRow[] = []
  for (const log of [...input.transfers].sort(byPosition)) {
    const { from, to, id } = log.args
    // Mints are the issuance (TitleIssued); a burn + mint pair is a token id regeneration.
    if (lower(from) === ZERO || lower(to) === ZERO) continue
    const cert = certs.get(key(log.grader, id))
    if (!cert) continue
    transfers.push({
      grader: log.grader,
      cert,
      from: lower(from),
      to: lower(to),
      block: log.blockNumber,
      logIndex: log.logIndex,
      batchIndex: log.batchIndex ?? 0,
      tx: log.transactionHash,
      time: input.blockTime(log.blockNumber),
      priceJpy: input.priceOf(log.transactionHash),
    })
  }
  return { titles, attributes, transfers }
}
