// Read API over the index. Everything here is derived from chain events; the apps show it as
// lists, charts and feeds, and title pages double-check the facts through ENS in the browser.

import { Hono, type Context } from 'hono'
import { getAddress, isAddress } from 'viem'
import { COLLECTORS, GRADERS, collectorOf } from '../../packages/core/src/deployment.ts'
import type { Sql } from './db.ts'

const SORTS = {
  newest: 'issued_block desc, cert',
  oldest: 'issued_block asc, cert',
  traded: 'transfer_count desc, issued_block desc',
  grade: 'grade_score desc, issued_block desc',
  price: 'last_price_jpy desc nulls last, issued_block desc',
  recent: 'coalesce(last_transfer_at, issued_at) desc',
} as const

/// JSON with bigint → number (counts and sums from Postgres; all far below 2^53).
const out = (c: Context, data: unknown, status = 200) =>
  c.body(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)), status as 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })

const label = (address: string) => collectorOf(address)?.name ?? null

function titleOut(r: Record<string, unknown>) {
  return {
    grader: r.grader,
    cert: r.cert,
    card: r.card,
    grade: r.grade,
    gradeScore: r.grade_score,
    chip: r.chip,
    holder: r.holder,
    holderName: label(r.holder as string),
    issuedAt: r.issued_at,
    issuedTx: r.issued_tx,
    issuedBlock: String(r.issued_block),
    attributes: r.attributes,
    transferCount: r.transfer_count,
    lastPriceJpy: r.last_price_jpy,
    lastTransferAt: r.last_transfer_at,
  }
}

function transferOut(r: Record<string, unknown>) {
  return {
    grader: r.grader,
    cert: r.cert,
    card: r.card,
    grade: r.grade,
    from: r.from_addr,
    fromName: label(r.from_addr as string),
    to: r.to_addr,
    toName: label(r.to_addr as string),
    block: String(r.block),
    tx: r.tx,
    time: r.time,
    priceJpy: r.price_jpy,
  }
}

export function api(sql: Sql) {
  const app = new Hono().basePath('/api')

  app.get('/status', async (c) => {
    const [state] = await sql`select value from indexer_state where key = 'block'`
    const [counts] = await sql`select (select count(*) from titles)::int as titles, (select count(*) from transfers)::int as transfers`
    return out(c, { indexedBlock: state ? String(state.value) : null, ...counts, graders: GRADERS.length })
  })

  app.get('/graders', async (c) => {
    const rows = await sql`
      select g.label, count(t.cert)::int as titles, coalesce(sum(t.transfer_count), 0)::int as transfers,
        count(distinct t.holder)::int as holders, avg(t.grade_score)::float as avg_grade,
        coalesce(sum(t.last_price_jpy), 0)::bigint as last_price_total
      from graders g left join titles t on t.grader = g.label group by g.label`
    const stats = new Map(rows.map((r) => [r.label, r]))
    return out(c, 
      GRADERS.map((g) => ({
        ...g,
        titles: stats.get(g.label)?.titles ?? 0,
        transfers: stats.get(g.label)?.transfers ?? 0,
        holders: stats.get(g.label)?.holders ?? 0,
        avgGrade: stats.get(g.label)?.avg_grade ?? null,
      })),
    )
  })

  app.get('/graders/:label', async (c) => {
    const g = GRADERS.find((x) => x.label === c.req.param('label'))
    if (!g) return out(c, { error: 'unknown grader' }, 404)
    const [totals] = await sql`
      select count(*)::int as titles, coalesce(sum(transfer_count), 0)::int as transfers, count(distinct holder)::int as holders
      from titles where grader = ${g.label}`
    const grades = await sql`select grade, grade_score, count(*)::int as n from titles where grader = ${g.label} group by grade, grade_score order by grade_score desc`
    const issuedPerHour = await sql`
      select date_trunc('hour', issued_at) as hour, count(*)::int as n from titles where grader = ${g.label} group by 1 order by 1`
    return out(c, { ...g, ...totals, grades, issuedPerHour })
  })

  app.get('/titles', async (c) => {
    const q = c.req.query()
    const sort = SORTS[(q.sort as keyof typeof SORTS) ?? 'newest'] ?? SORTS.newest
    const limit = Math.min(Number(q.limit ?? 60) || 60, 200)
    const offset = Math.max(Number(q.offset ?? 0) || 0, 0)
    const grader = q.grader || null
    const holder = q.holder && isAddress(q.holder) ? q.holder.toLowerCase() : null
    const minGrade = q.minGrade ? Number(q.minGrade) : null
    const search = q.q?.trim().toLowerCase() || null
    const where = sql`
      where (${grader}::text is null or grader = ${grader})
        and (${holder}::text is null or holder = ${holder})
        and (${minGrade}::real is null or grade_score >= ${minGrade})
        and (${search}::text is null or cert like ${search + '%'} or lower(card) like ${'%' + search + '%'} or holder = ${search})`
    const rows = await sql`select * from titles ${where} order by ${sql.unsafe(sort)} limit ${limit} offset ${offset}`
    const [{ total }] = await sql`select count(*)::int as total from titles ${where}`
    return out(c, { total, items: rows.map(titleOut) })
  })

  app.get('/titles/:grader/:cert', async (c) => {
    const { grader, cert } = c.req.param()
    const [row] = await sql`select * from titles where grader = ${grader} and cert = ${cert}`
    if (!row) return out(c, { error: 'not indexed' }, 404)
    const history = await sql`
      select t.*, ti.card, ti.grade from transfers t join titles ti using (grader, cert)
      where t.grader = ${grader} and t.cert = ${cert} order by block, log_index`
    return out(c, { ...titleOut(row), history: history.map(transferOut) })
  })

  app.get('/activity', async (c) => {
    const q = c.req.query()
    const limit = Math.min(Number(q.limit ?? 50) || 50, 200)
    const grader = q.grader || null
    const type = q.type === 'issue' || q.type === 'transfer' ? q.type : null
    const rows = await sql`
      select * from (
        select 'issue' as kind, grader, cert, card, grade, null as from_addr, holder as to_addr, issued_block as block, 0 as log_index,
          issued_tx as tx, issued_at as time, null::int as price_jpy
        from titles
        union all
        select 'transfer', t.grader, t.cert, ti.card, ti.grade, t.from_addr, t.to_addr, t.block, t.log_index, t.tx, t.time, t.price_jpy
        from transfers t join titles ti using (grader, cert)
      ) a
      where (${grader}::text is null or grader = ${grader}) and (${type}::text is null or kind = ${type})
      order by block desc, log_index desc limit ${limit}`
    return out(c, rows.map((r) => ({ kind: r.kind, ...transferOut(r) })))
  })

  app.get('/stats', async (c) => {
    const [totals] = await sql`
      select (select count(*) from titles)::int as titles, (select count(*) from transfers)::int as transfers,
        (select count(distinct holder) from titles)::int as holders,
        (select coalesce(sum(price_jpy), 0) from transfers)::bigint as volume_jpy,
        (select count(*) from transfers where price_jpy is not null)::int as priced_transfers`
    const perHour = await sql`
      select hour, sum(issued)::int as issued, sum(transfers)::int as transfers, sum(volume)::bigint as volume from (
        select date_trunc('hour', issued_at) as hour, 1 as issued, 0 as transfers, 0 as volume from titles
        union all
        select date_trunc('hour', time), 0, 1, coalesce(price_jpy, 0) from transfers
      ) x group by hour order by hour`
    const grades = await sql`select grader, grade, grade_score, count(*)::int as n from titles group by 1, 2, 3 order by grader, grade_score desc`
    const topHolders = await sql`select holder, count(*)::int as n from titles group by holder order by n desc limit 10`
    return out(c, {
      ...totals,
      volumeJpy: Number(totals.volume_jpy),
      perHour: perHour.map((r) => ({ ...r, volume: Number(r.volume) })),
      grades,
      topHolders: topHolders.map((r) => ({ ...r, name: label(r.holder) })),
    })
  })

  app.get('/holders/:address', async (c) => {
    const a = c.req.param('address')
    if (!isAddress(a)) return out(c, { error: 'bad address' }, 400)
    const address = a.toLowerCase()
    const held = await sql`select * from titles where holder = ${address} order by issued_block desc`
    const past = await sql`
      select * from titles where holder <> ${address} and (grader, cert) in (select grader, cert from transfers where from_addr = ${address}
        union select grader, cert from titles where false) order by issued_block desc`
    const activity = await sql`
      select 'transfer' as kind, t.*, ti.card, ti.grade from transfers t join titles ti using (grader, cert)
      where from_addr = ${address} or to_addr = ${address} order by block desc, log_index desc limit 100`
    const [{ bought, sold, spent, earned }] = await sql`
      select count(*) filter (where to_addr = ${address})::int as bought, count(*) filter (where from_addr = ${address})::int as sold,
        coalesce(sum(price_jpy) filter (where to_addr = ${address}), 0)::bigint as spent,
        coalesce(sum(price_jpy) filter (where from_addr = ${address}), 0)::bigint as earned
      from transfers where from_addr = ${address} or to_addr = ${address}`
    const collector = collectorOf(address)
    return out(c, {
      address: getAddress(address),
      name: collector?.name ?? null,
      bio: collector?.bio ?? null,
      held: held.map(titleOut),
      past: past.map(titleOut),
      activity: activity.map((r) => ({ kind: 'transfer', ...transferOut(r) })),
      stats: { bought, sold, spentJpy: Number(spent), earnedJpy: Number(earned) },
    })
  })

  app.get('/collectors', async (c) => {
    const rows = await sql`select holder, count(*)::int as n from titles group by holder`
    const counts = new Map(rows.map((r) => [r.holder, r.n]))
    return out(c, COLLECTORS.map((col) => ({ ...col, titles: counts.get(col.address.toLowerCase()) ?? 0 })))
  })

  /// Market map: holders as nodes, transfers aggregated into edges.
  app.get('/graph', async (c) => {
    const edges = await sql`
      select from_addr, to_addr, count(*)::int as n, coalesce(sum(price_jpy), 0)::bigint as volume
      from transfers group by 1, 2`
    const holdings = await sql`select holder, count(*)::int as n from titles group by holder`
    const ids = new Set<string>([...edges.flatMap((e) => [e.from_addr, e.to_addr]), ...holdings.map((h) => h.holder)])
    const held = new Map(holdings.map((h) => [h.holder, h.n]))
    return out(c, {
      nodes: [...ids].map((id) => ({ id, name: label(id), titles: held.get(id) ?? 0 })),
      edges: edges.map((e) => ({ from: e.from_addr, to: e.to_addr, count: e.n, volumeJpy: Number(e.volume) })),
    })
  })

  app.notFound((c) => out(c, { error: 'not found' }, 404))
  app.onError((err, c) => {
    console.error(err)
    return out(c, { error: 'internal error' }, 500)
  })
  return app
}
