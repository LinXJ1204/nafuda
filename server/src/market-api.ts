// Market read model: what titles sell for, from the declared prices in transfers. Prices are
// self-reported by sellers (payment happens off chain); `confirmed` means Curvegrid's copy of the
// transaction carries the same price, i.e. the number shown is the number on chain.

import type { Context, Hono } from 'hono'
import { collectorOf } from '../../packages/core/src/deployment.ts'
import type { Sql } from './db.ts'

type Out = (c: Context, data: unknown, status?: number) => Response

const name = (a: string) => collectorOf(a)?.name ?? null

export function marketRoutes(app: Hono, sql: Sql, out: Out) {
  app.get('/market', async (c) => {
    const sales = sql`
      select t.grader, t.cert, t.price_jpy, t.time, t.tx, t.from_addr, t.to_addr, ti.card, ti.grade, ti.grade_score, ti.attributes,
        exists(select 1 from witness_events w where w.tx = t.tx and w.log_index = t.log_index and w.batch_index = t.batch_index
          and not w.removed and w.price_seen and w.price_jpy is not distinct from t.price_jpy) as confirmed
      from transfers t join titles ti using (grader, cert) where t.price_jpy is not null`
    const [totals] = await sql`
      select count(*)::int as sales, coalesce(percentile_cont(0.5) within group (order by price_jpy), 0)::int as median,
        coalesce(sum(price_jpy), 0)::bigint as volume, count(*) filter (where confirmed)::int as confirmed
      from (${sales}) s`
    const [{ checked }] = await sql`
      select count(*)::int as checked from witness_events where price_seen and not removed and kind = 'transfer'`
    const byGrade = await sql`
      select grade_score, count(*)::int as n, percentile_cont(0.5) within group (order by price_jpy)::int as median,
        min(price_jpy)::int as min, max(price_jpy)::int as max
      from (${sales}) s group by grade_score order by grade_score desc`
    const byGrader = await sql`
      select grader, count(*)::int as n, percentile_cont(0.5) within group (order by price_jpy)::int as median, sum(price_jpy)::bigint as volume
      from (${sales}) s group by grader order by grader`
    const byCategory = await sql`
      select ti.attributes->>'card.category' as category, coalesce(ti.attributes->>'card.game', ti.attributes->>'card.sport') as kind,
        count(distinct (ti.grader, ti.cert))::int as titles, count(t.price_jpy)::int as sales,
        (percentile_cont(0.5) within group (order by t.price_jpy))::int as median
      from titles ti left join transfers t on t.grader = ti.grader and t.cert = ti.cert and t.price_jpy is not null
      where ti.attributes ? 'card.category' group by 1, 2 order by titles desc, 2`
    // Price guide: the most traded cards, by grader and grade
    const guide = await sql`
      select card, grader, grade, grade_score, count(*)::int as n, percentile_cont(0.5) within group (order by price_jpy)::int as median,
        (array_agg(price_jpy order by time desc))[1] as last, max(time) as last_at
      from (${sales}) s
      where card in (select card from (${sales}) x group by card order by count(*) desc, card limit 12)
      group by card, grader, grade, grade_score order by card, grade_score desc, grader`
    const recent = await sql`select * from (${sales}) s order by time desc limit 12`
    return out(c, {
      totals: { ...totals, volume: Number(totals.volume), witnessChecked: checked },
      byGrade,
      byGrader: byGrader.map((r) => ({ ...r, volume: Number(r.volume) })),
      byCategory,
      guide,
      recent: recent.map((r) => ({
        grader: r.grader,
        cert: r.cert,
        card: r.card,
        grade: r.grade,
        priceJpy: r.price_jpy,
        time: r.time,
        tx: r.tx,
        from: r.from_addr,
        fromName: name(r.from_addr),
        to: r.to_addr,
        toName: name(r.to_addr),
        confirmed: r.confirmed,
      })),
    })
  })
}
