// Indexer: follows the chain N confirmations behind the head and writes every grader's
// issuances, attributes and transfers into Postgres. Restart-safe: a cursor row records the
// last fully written block, and each batch is one transaction.

import { createPublicClient, decodeFunctionData, fallback, http, type Hash } from 'viem'
import { sepolia } from 'viem/chains'
import { canonicalId, registryAbi, titleAttributeEvent, titleIssuedEvent, transferBatchEvent, transferSingleEvent } from '../../packages/core/src/abis.ts'
import { GRADERS, START_BLOCK, graderByController, graderByRegistry } from '../../packages/core/src/deployment.ts'
import { decodePrice } from '../../packages/core/src/price.ts'
import { applyBatch, expandBatch, type AttributeLog, type IssuedLog, type TransferBatchLog, type TransferLog } from './apply.ts'
import type { Sql } from './db.ts'
import { env } from './env.ts'

export async function syncGraders(sql: Sql) {
  for (const g of GRADERS) {
    await sql`
      insert into graders (label, ens_name, short, name, color, grader, registry, controller, controller_version)
      values (${g.label}, ${g.ensName}, ${g.short}, ${g.name}, ${g.color}, ${g.grader.toLowerCase()}, ${g.registry.toLowerCase()}, ${g.controller.toLowerCase()}, ${g.controllerVersion})
      on conflict (label) do update set ens_name = excluded.ens_name, short = excluded.short, name = excluded.name, color = excluded.color,
        grader = excluded.grader, registry = excluded.registry, controller = excluded.controller, controller_version = excluded.controller_version`
  }
}

/// Write one batch (from applyBatch) and refresh the touched titles' aggregates. Runs inside the
/// caller's transaction.
export async function writeBatch(tx: Sql, batch: ReturnType<typeof applyBatch>, blockTimes: Map<bigint, Date>) {
  for (const [number, time] of blockTimes) await tx`insert into blocks (number, time) values (${String(number)}, ${time}) on conflict do nothing`
  for (const t of batch.titles) {
    await tx`
      insert into titles (grader, cert, label_id, card, grade, grade_score, chip, holder, issued_block, issued_tx, issued_at)
      values (${t.grader}, ${t.cert}, ${t.labelId.toString()}, ${t.card}, ${t.grade}, ${t.gradeScore}, ${t.chip}, ${t.holder}, ${String(t.issuedBlock)}, ${t.issuedTx}, ${t.issuedAt})
      on conflict (grader, cert) do nothing`
  }
  for (const a of batch.attributes) {
    await tx`update titles set attributes = attributes || ${tx.json({ [a.key]: a.value })} where grader = ${a.grader} and cert = ${a.cert}`
  }
  for (const t of batch.transfers) {
    await tx`
      insert into transfers (grader, cert, from_addr, to_addr, block, log_index, batch_index, tx, time, price_jpy)
      values (${t.grader}, ${t.cert}, ${t.from}, ${t.to}, ${String(t.block)}, ${t.logIndex}, ${t.batchIndex}, ${t.tx}, ${t.time}, ${t.priceJpy})
      on conflict do nothing`
  }
  for (const k of new Set(batch.transfers.map((t) => `${t.grader}|${t.cert}`))) {
    const [grader, cert] = k.split('|')
    await tx`
      update titles set
        holder = (select to_addr from transfers where grader = ${grader} and cert = ${cert} order by block desc, log_index desc limit 1),
        transfer_count = (select count(*) from transfers where grader = ${grader} and cert = ${cert}),
        last_transfer_at = (select max(time) from transfers where grader = ${grader} and cert = ${cert}),
        last_price_jpy = (select price_jpy from transfers where grader = ${grader} and cert = ${cert} and price_jpy is not null order by block desc, log_index desc limit 1)
      where grader = ${grader} and cert = ${cert}`
  }
}

export async function runIndexer(sql: Sql, { once = false } = {}) {
  const retry = { retryCount: 6, retryDelay: 1500 }
  const client = createPublicClient({
    chain: sepolia,
    transport: fallback([http(env.rpcUrl(), retry), http('https://ethereum-sepolia-rpc.publicnode.com', retry)]),
  })
  await syncGraders(sql)
  const controllers = GRADERS.map((g) => g.controller)
  const registries = GRADERS.map((g) => g.registry)
  const v2Controllers = GRADERS.filter((g) => g.controllerVersion === 2).map((g) => g.controller)

  for (;;) {
    const [row] = await sql<{ value: bigint }[]>`select value from indexer_state where key = 'block'`
    const cursor = row?.value ?? BigInt(START_BLOCK - 1)
    const head = (await client.getBlockNumber()) - env.confirmations
    if (cursor >= head) {
      if (once) return
      await new Promise((r) => setTimeout(r, env.pollMs))
      continue
    }
    const fromBlock = cursor + 1n
    const toBlock = cursor + env.batchBlocks < head ? cursor + env.batchBlocks : head

    const [issuedRaw, attributesRaw, transfersRaw, batchesRaw] = await Promise.all([
      client.getLogs({ address: controllers, event: titleIssuedEvent, fromBlock, toBlock }),
      v2Controllers.length ? client.getLogs({ address: v2Controllers, event: titleAttributeEvent, fromBlock, toBlock }) : Promise.resolve([]),
      client.getLogs({ address: registries, event: transferSingleEvent, fromBlock, toBlock }),
      client.getLogs({ address: registries, event: transferBatchEvent, fromBlock, toBlock }),
    ])
    const issued = issuedRaw.map((l) => ({ ...l, grader: graderByController(l.address)!.label })) as unknown as IssuedLog[]
    const attributes = attributesRaw.map((l) => ({ ...l, grader: graderByController(l.address)!.label })) as unknown as AttributeLog[]
    const batches = batchesRaw.map((l) => ({ ...l, grader: graderByRegistry(l.address)!.label })) as unknown as TransferBatchLog[]
    const transfers = [
      ...(transfersRaw.map((l) => ({ ...l, grader: graderByRegistry(l.address)!.label })) as unknown as TransferLog[]),
      ...batches.flatMap(expandBatch),
    ]

    // Block times (cached in the blocks table)
    const blocks = [...new Set([...issued, ...transfers].map((l) => l.blockNumber))]
    const known = new Map(
      (blocks.length ? await sql<{ number: bigint; time: Date }[]>`select number, time from blocks where number = any(${blocks.map(String)}::bigint[])` : []).map((b) => [
        BigInt(b.number),
        b.time,
      ]),
    )
    for (const n of blocks.filter((b) => !known.has(b))) {
      const block = await client.getBlock({ blockNumber: n })
      known.set(n, new Date(Number(block.timestamp) * 1000))
    }

    // Declared prices from the transfers' calldata. A batch declares one price for several names,
    // which says nothing about each, so batches carry none.
    const prices = new Map<Hash, number | null>(batches.map((b) => [b.transactionHash, null]))
    for (const t of transfers) {
      if (prices.has(t.transactionHash) || t.args.from === '0x0000000000000000000000000000000000000000') continue
      try {
        const txn = await client.getTransaction({ hash: t.transactionHash })
        const { functionName, args } = decodeFunctionData({ abi: registryAbi, data: txn.input })
        prices.set(t.transactionHash, functionName === 'safeTransferFrom' ? decodePrice(args[4] as string) : null)
      } catch {
        prices.set(t.transactionHash, null) // not a direct call (e.g. through a contract wallet)
      }
    }

    const knownCerts = new Map(
      (await sql<{ grader: string; label_id: string; cert: string }[]>`select grader, label_id::text, cert from titles`).map((r) => [
        `${r.grader}:${canonicalId(BigInt(r.label_id))}`,
        r.cert,
      ]),
    )
    const batch = applyBatch({ issued, attributes, transfers, knownCerts, blockTime: (b) => known.get(b)!, priceOf: (h) => prices.get(h) ?? null })

    await sql.begin(async (tx) => {
      await writeBatch(tx as unknown as Sql, batch, known)
      await tx`insert into indexer_state (key, value) values ('block', ${String(toBlock)}) on conflict (key) do update set value = excluded.value`
    })
    console.log(
      JSON.stringify({ at: new Date().toISOString(), fromBlock: String(fromBlock), toBlock: String(toBlock), titles: batch.titles.length, transfers: batch.transfers.length }),
    )
  }
}
