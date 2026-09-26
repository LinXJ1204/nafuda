// Second witness endpoints. MultiBaas pushes registry events to POST /api/hooks/multibaas (signed
// with the webhook secret); GET /api/witness compares them with our index, both ways. See
// witness.ts for the rules. Nothing here writes to titles or transfers.

import type { Context, Hono } from 'hono'
import { canonicalId } from '../../packages/core/src/abis.ts'
import { collectorOf, graderByRegistry } from '../../packages/core/src/deployment.ts'
import type { Sql } from './db.ts'
import { env } from './env.ts'
import { checkSignature, parseDelivery, reconcile, type IndexIssue, type IndexTransfer, type SignatureCheck, type WitnessRow } from './witness.ts'

type Out = (c: Context, data: unknown, status?: number) => Response

const MAX_BODY = 256 * 1024
/// Refused deliveries since this process started, by reason (shown on the panel).
const refused: Record<Exclude<SignatureCheck, 'ok'> | 'too-large' | 'not-json', number> = {
  missing: 0,
  'bad-signature': 0,
  stale: 0,
  'too-large': 0,
  'not-json': 0,
}

const name = (a: string) => collectorOf(a)?.name ?? null

export async function readWitness(sql: Sql) {
  const witnessedRows = await sql`select * from witness_events order by block, log_index, batch_index`
  const witnessed: WitnessRow[] = witnessedRows.map((r) => ({
    deliveryId: r.delivery_id,
    grader: r.grader,
    registry: r.registry,
    tx: r.tx,
    logIndex: r.log_index,
    batchIndex: r.batch_index,
    block: BigInt(r.block),
    blockHash: r.block_hash,
    kind: r.kind,
    from: r.from_addr,
    to: r.to_addr,
    tokenId: BigInt(r.token_id),
    removed: r.removed,
    triggeredAt: r.triggered_at,
  }))
  const from = witnessed.length ? witnessed[0].block : null
  const transfers: IndexTransfer[] =
    from === null
      ? []
      : (await sql`select grader, cert, tx, log_index, batch_index, block, from_addr, to_addr from transfers where block >= ${String(from)}`).map((r) => ({
          grader: r.grader,
          cert: r.cert,
          tx: r.tx,
          logIndex: r.log_index,
          batchIndex: r.batch_index,
          block: BigInt(r.block),
          from: r.from_addr,
          to: r.to_addr,
        }))
  const issues: IndexIssue[] = (await sql`select grader, cert, label_id::text, issued_tx, issued_block, holder from titles`).map((r) => ({
    grader: r.grader,
    cert: r.cert,
    labelId: BigInt(r.label_id),
    tx: r.issued_tx,
    block: BigInt(r.issued_block),
    holder: r.holder,
  }))
  const [state] = await sql`select value from indexer_state where key = 'block'`
  const [deliveries] = await sql`select count(*)::int as n, max(received_at) as last, min(received_at) as first from witness_deliveries`
  const result = reconcile({ witnessed, transfers, issues, indexedThrough: state ? BigInt(state.value) : null })
  return { result, deliveries: { count: deliveries.n as number, first: deliveries.first as Date | null, last: deliveries.last as Date | null } }
}

export function witnessRoutes(app: Hono, sql: Sql, out: Out) {
  app.post('/hooks/multibaas', async (c) => {
    const secret = env.webhookSecret()
    if (!secret) return out(c, { error: 'second witness not configured' }, 503)
    if (Number(c.req.header('content-length') ?? 0) > MAX_BODY) return (refused['too-large']++, out(c, { error: 'request too large' }, 413))
    const body = new Uint8Array(await c.req.arrayBuffer())
    if (body.length > MAX_BODY) return (refused['too-large']++, out(c, { error: 'request too large' }, 413))
    const check = checkSignature({
      body,
      signature: c.req.header('x-multibaas-signature'),
      timestamp: c.req.header('x-multibaas-timestamp'),
      secret,
      nowSec: Math.floor(Date.now() / 1000),
    })
    if (check !== 'ok') return (refused[check]++, out(c, { error: check }, 401))
    let json: unknown
    try {
      json = JSON.parse(new TextDecoder().decode(body))
    } catch {
      return (refused['not-json']++, out(c, { error: 'not json' }, 400))
    }
    const { rows, ignored } = parseDelivery(json, (a) => graderByRegistry(a)?.label ?? null)
    await sql.begin(async (tx) => {
      for (const r of rows) {
        // A redelivery is a no-op; a later delivery of the same log marked removed (reorg) sticks.
        await tx`
          insert into witness_events (tx, log_index, batch_index, block_hash, block, delivery_id, grader, registry, kind, from_addr, to_addr, token_id, removed, triggered_at)
          values (${r.tx}, ${r.logIndex}, ${r.batchIndex}, ${r.blockHash}, ${String(r.block)}, ${r.deliveryId}, ${r.grader}, ${r.registry}, ${r.kind},
            ${r.from}, ${r.to}, ${r.tokenId.toString()}, ${r.removed}, ${r.triggeredAt})
          on conflict (tx, log_index, batch_index, block_hash) do update set removed = witness_events.removed or excluded.removed`
      }
      await tx`insert into witness_deliveries (events, ignored) values (${rows.length}, ${ignored})`
    })
    return out(c, { accepted: rows.length, ignored })
  })

  app.get('/witness', async (c) => {
    const configured = env.webhookSecret() !== null
    const { result, deliveries } = await readWitness(sql)
    const { events, unwitnessed, summary } = result
    const byGrader = Object.fromEntries(
      [...new Set(events.map((e) => e.grader))].map((g) => {
        const mine = events.filter((e) => e.grader === g)
        return [g, { witnessed: mine.length, agreed: mine.filter((e) => e.verdict === 'agreed').length }]
      }),
    )
    return out(c, {
      source: 'Curvegrid MultiBaas',
      configured,
      deliveries,
      refused,
      summary: { ...summary, fromBlock: summary.fromBlock?.toString() ?? null, toBlock: summary.toBlock?.toString() ?? null },
      byGrader,
      recent: events
        .slice(-40)
        .reverse()
        .map((e) => ({
          grader: e.grader,
          cert: e.cert,
          kind: e.kind,
          from: e.from,
          fromName: name(e.from),
          to: e.to,
          toName: name(e.to),
          tx: e.tx,
          logIndex: e.logIndex,
          batchIndex: e.batchIndex,
          block: e.block.toString(),
          tokenId: canonicalId(e.tokenId).toString(),
          verdict: e.verdict,
          detail: e.detail,
          triggeredAt: e.triggeredAt,
        })),
      unwitnessed: unwitnessed.slice(0, 50).map((u) => ({ ...u, block: u.block.toString() })),
    })
  })
}
