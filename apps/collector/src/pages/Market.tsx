// Market: what titles sell for. Every number comes from the prices sellers declare in their
// transfers (payment happens off chain, so nobody verifies them); Curvegrid's copy of each
// transaction confirms that the number shown is the number on chain.

import { Link } from 'react-router'
import { GROUPS, type Group } from '@nafuda/core/categories.ts'
import { GRADERS, graderByLabel } from '@nafuda/core/deployment.ts'
import { splitCard } from '@nafuda/core/slab.ts'
import { useMarket } from '@nafuda/ui/api.ts'
import { GradeValueChart, GraderValueChart } from '@nafuda/ui/Charts.tsx'
import { Addr, AppLink, Card, GraderBadge, Section, Skeleton, Stat, TimeAgo, TxLink, useLinks } from '@nafuda/ui/components.tsx'
import { compactJpy, jpy } from '@nafuda/ui/format.ts'

const kindLabel = (category: string, kind: string | null) => {
  const g = GROUPS[category as Group]
  return (kind && (g?.options as Record<string, string> | undefined)?.[kind]) || kind || g?.label || category
}

export function MarketPage() {
  const q = useMarket()
  const links = useLinks()
  const m = q.data
  const guide = new Map<string, NonNullable<typeof m>['guide']>()
  for (const g of m?.guide ?? []) guide.set(g.card, [...(guide.get(g.card) ?? []), g])

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Market</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">What slabs sell for, by grade, grader and card. Built from every transfer that carries a declared price.</p>
        </div>
        <Link to="/map" className="text-sm text-muted hover:text-ink">
          Who traded with whom → Market map
        </Link>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted">
        <b className="text-ink">How to read these prices.</b> Payment happens off chain (cash at the table, a bank transfer), so the chain cannot know what was really paid.
        Each price is the number the seller wrote into the transfer. What <b className="text-ok">✓ confirmed</b> adds: Curvegrid MultiBaas, reading the same transaction on
        its own, found the same number, so what you see here is exactly what is on chain, not something our server made up.
      </div>

      {!m ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Priced sales" value={m.totals.sales} sub="transfers with a declared price" />
            <Stat label="Median sale" value={jpy(m.totals.median)} sub="all graders and grades" />
            <Stat label="Declared volume" value={compactJpy(m.totals.volume)} sub="self-reported by sellers" />
            <Stat
              label="Confirmed by Curvegrid"
              value={m.totals.confirmed}
              sub={
                <Link to="/witness" className="hover:text-ink">
                  prices read from Curvegrid&apos;s copy of the transaction →
                </Link>
              }
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-lg font-bold">What a grade is worth</h2>
              <p className="mb-3 text-xs text-muted">Median declared price by grade, across graders. Hover for the number of sales and the range.</p>
              <GradeValueChart data={m.byGrade} />
            </Card>
            <Card className="p-5">
              <h2 className="text-lg font-bold">By grader</h2>
              <p className="mb-3 text-xs text-muted">Median declared price of titles from each grader.</p>
              <GraderValueChart
                data={GRADERS.map((g) => {
                  const r = m.byGrader.find((x) => x.grader === g.label)
                  return { label: g.short, color: g.color, n: r?.n ?? 0, median: r?.median ?? 0 }
                })}
              />
            </Card>
          </div>

          <Section title="Price guide" sub="The most traded cards: median and last declared price for each grader and grade.">
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="px-4 py-2.5 font-semibold">Card</th>
                    <th className="px-2 py-2.5 font-semibold">Grader · grade → median (sales) · last</th>
                  </tr>
                </thead>
                <tbody>
                  {[...guide.entries()].map(([card, rows]) => {
                    const c = splitCard(card)
                    return (
                      <tr key={card} className="border-t border-line align-top">
                        <td className="px-4 py-2.5">
                          <AppLink to={`/explore?q=${encodeURIComponent(c.name)}`} className="font-semibold no-underline hover:text-accent">
                            {c.name}
                          </AppLink>
                          <div className="text-[12px] text-muted">{c.detail}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {rows.map((r) => (
                              <span key={`${r.grader}:${r.grade}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2 py-1 text-xs">
                                <span className="size-2 rounded-full" style={{ background: graderByLabel(r.grader)?.color }} />
                                <span className="text-muted">{r.grade}</span>
                                <strong className="tabular-nums">{jpy(r.median)}</strong>
                                <span className="text-faint">({r.n})</span>
                                {r.n > 1 && <span className="text-faint">· last {compactJpy(r.last)}</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {m.byCategory.length > 0 && (
            <Section title="By category" sub="Titles whose grader recorded a category (card.* ENS text records).">
              <div className="flex flex-wrap gap-2">
                {m.byCategory.map((c) => (
                  <AppLink
                    key={`${c.category}:${c.kind}`}
                    to={`/explore?category=${c.kind ?? c.category}`}
                    className="rounded-xl border border-line bg-card px-3 py-2 text-sm no-underline hover:border-accent"
                  >
                    <div className="font-semibold">{kindLabel(c.category, c.kind)}</div>
                    <div className="text-xs text-muted">
                      {c.titles} titles · {c.sales ? `${c.sales} sales, median ${jpy(c.median)}` : 'no sales yet'}
                    </div>
                  </AppLink>
                ))}
              </div>
            </Section>
          )}

          <Section title="Latest priced sales">
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="px-4 py-2.5 font-semibold">Title</th>
                    <th className="px-2 py-2.5 font-semibold">Seller → buyer</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Declared</th>
                    <th className="px-2 py-2.5 font-semibold">When</th>
                    <th className="px-4 py-2.5 font-semibold">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {m.recent.map((r) => (
                    <tr key={r.tx + r.cert} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <AppLink to={links.title(r.grader, r.cert)} className="font-medium no-underline hover:text-accent">
                          {splitCard(r.card).name}
                        </AppLink>{' '}
                        <GraderBadge label={r.grader} /> <span className="text-xs text-muted">{r.grade}</span>
                      </td>
                      <td className="px-2 py-2.5 whitespace-nowrap">
                        <Addr address={r.from} /> <span className="text-faint">→</span> <Addr address={r.to} />
                      </td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {jpy(r.priceJpy)}
                        {r.confirmed && (
                          <div className="text-[11px] font-semibold text-ok" title="Curvegrid's copy of the transaction carries the same declared price">
                            ✓ confirmed
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-muted">
                        <TimeAgo date={r.time} />
                      </td>
                      <td className="px-4 py-2.5">
                        <TxLink hash={r.tx} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  )
}
