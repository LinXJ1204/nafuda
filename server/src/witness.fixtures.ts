// Test fixtures for the second witness: MultiBaas event.emitted items that carry real encoded logs.

import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, type Address, type Hash } from 'viem'
import { registryAbi, transferBatchEvent, transferSingleEvent } from '../../packages/core/src/abis.ts'
import { encodePrice } from '../../packages/core/src/price.ts'

export const PSA_REGISTRY = '0x7c4de791acf68e4fd9305770524f7f25a8ca646a'
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash

/// An event.emitted item shaped like the MultiBaas docs' sample, carrying a real encoded log.
export function webhookItem(opts: { n: number; from: Address; to: Address; ids: bigint[]; block: number; logIndex: number; address?: string; removed?: boolean; priceJpy?: number | null }) {
  const batch = opts.ids.length > 1
  const topics = batch
    ? encodeEventTopics({ abi: [transferBatchEvent], eventName: 'TransferBatch', args: { operator: opts.from, from: opts.from, to: opts.to } })
    : encodeEventTopics({ abi: [transferSingleEvent], eventName: 'TransferSingle', args: { operator: opts.from, from: opts.from, to: opts.to } })
  const data = batch
    ? encodeAbiParameters([{ type: 'uint256[]' }, { type: 'uint256[]' }], [opts.ids, opts.ids.map(() => 1n)])
    : encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [opts.ids[0], 1n])
  const rawFields = JSON.stringify({
    address: opts.address ?? PSA_REGISTRY,
    topics,
    data,
    blockNumber: `0x${opts.block.toString(16)}`,
    transactionHash: hash(opts.n),
    transactionIndex: '0x0',
    blockHash: hash(opts.block + 1_000_000),
    logIndex: `0x${opts.logIndex.toString(16)}`,
    removed: opts.removed ?? false,
  })
  return {
    id: `delivery-${opts.n}-${opts.logIndex}`,
    event: 'event.emitted',
    data: {
      triggeredAt: '2026-09-26T16:00:00+09:00',
      event: { name: batch ? 'TransferBatch' : 'TransferSingle', rawFields, indexInLog: opts.logIndex },
      // the transaction's calldata, as MultiBaas sends it along (only when a price is given)
      transaction:
        opts.priceJpy === undefined
          ? {}
          : {
              txData: encodeFunctionData({
                abi: registryAbi,
                functionName: 'safeTransferFrom',
                args: [opts.from, opts.to, opts.ids[0], 1n, opts.priceJpy === null ? '0x' : encodePrice(opts.priceJpy)],
              }),
            },
    },
  }
}

