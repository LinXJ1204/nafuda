import { graderByLabel } from '@nafuda/core/deployment.ts'
import { splitCard } from '@nafuda/core/slab.ts'
import type { Activity } from './api.ts'
import { Addr, AppLink, Empty, GraderBadge, Skeleton, TimeAgo, TxLink, useLinks } from './components.tsx'
import { jpy } from './format.ts'

export function ActivityFeed({ items, loading, compact = false }: { items?: Activity[]; loading?: boolean; compact?: boolean }) {
  const links = useLinks()
  if (loading && !items) return <Skeleton className="h-64" />
  if (!items?.length) return <Empty>No activity yet.</Empty>
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
            <th className="px-4 py-2.5 font-semibold">Event</th>
            <th className="px-2 py-2.5 font-semibold">Title</th>
            {!compact && <th className="px-2 py-2.5 font-semibold">Grader</th>}
            <th className="px-2 py-2.5 font-semibold">From</th>
            <th className="px-2 py-2.5 font-semibold">To</th>
            <th className="px-2 py-2.5 text-right font-semibold">Declared</th>
            <th className="px-2 py-2.5 font-semibold">When</th>
            {!compact && <th className="px-4 py-2.5 font-semibold">Tx</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={`${a.tx}:${a.kind}:${a.cert}`} className="border-t border-line hover:bg-raised">
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${a.kind === 'issue' ? 'text-accent' : ''}`}>
                  <span aria-hidden>{a.kind === 'issue' ? '◆' : '⇄'}</span>
                  {a.kind === 'issue' ? 'Issued' : 'Transfer'}
                </span>
              </td>
              <td className="px-2 py-2.5">
                <AppLink to={links.title(a.grader, a.cert)} className="font-medium no-underline hover:text-accent">
                  {splitCard(a.card).name}
                </AppLink>
                <div className="font-mono text-[11px] text-faint">#{a.cert}</div>
              </td>
              {!compact && (
                <td className="px-2 py-2.5">
                  <GraderBadge label={a.grader} />
                </td>
              )}
              <td className="px-2 py-2.5">{a.from ? <Addr address={a.from} /> : <span className="text-muted">{graderByLabel(a.grader)?.short ?? 'grader'}</span>}</td>
              <td className="px-2 py-2.5">
                <Addr address={a.to} />
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{a.priceJpy ? jpy(a.priceJpy) : <span className="text-faint">—</span>}</td>
              <td className="px-2 py-2.5 text-muted">
                <TimeAgo date={a.time} />
              </td>
              {!compact && (
                <td className="px-4 py-2.5">
                  <TxLink hash={a.tx} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
