import { useState } from 'react'
import { splitCard } from '@nafuda/core/slab.ts'
import { useTitles } from '@nafuda/ui/api.ts'
import { Addr, AppLink, Button, Skeleton, TimeAgo, TxLink, useLinks } from '@nafuda/ui/components.tsx'
import { jpy } from '@nafuda/ui/format.ts'
import { useConsole } from '../console.tsx'

function toCsv(rows: string[][]) {
  return rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')
}

export function IssuedPage() {
  const { grader } = useConsole()
  const links = useLinks()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest')
  const titles = useTitles({ grader: grader.label, q, sort, limit: 200 })

  function exportCsv() {
    const items = titles.data?.items ?? []
    const csv = toCsv([
      ['grader', 'cert', 'ens_name', 'card', 'grade', 'chip', 'holder', 'issued_at', 'transfers', 'last_declared_jpy', 'issue_tx'],
      ...items.map((t) => [t.grader, t.cert, `${t.cert}.${grader.ensName}`, t.card, t.grade, t.chip, t.holder, t.issuedAt, String(t.transferCount), String(t.lastPriceJpy ?? ''), t.issuedTx]),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${grader.label}-titles.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Issued titles</h1>
          <p className="mt-1 text-sm text-muted">{titles.data ? `${titles.data.total} titles` : 'Loading…'} · current holders from transfers since issue</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cert, card, address" className="rounded-xl border border-line bg-card px-3 py-2 text-sm" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-line bg-card px-2 py-2 text-sm">
            <option value="newest">Newest</option>
            <option value="traded">Most traded</option>
            <option value="grade">Highest grade</option>
          </select>
          <Button onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>
      {!titles.data ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                {['Cert', 'Card', 'Grade', 'Holder', 'Issued', 'Resales', 'Last declared', 'Tx'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {titles.data.items.map((t) => (
                <tr key={t.cert} className="border-t border-line hover:bg-raised">
                  <td className="px-3 py-2">
                    <AppLink to={links.title(t.grader, t.cert)} className="font-mono">
                      {t.cert}
                    </AppLink>
                  </td>
                  <td className="px-3 py-2">
                    {splitCard(t.card).name}
                    <div className="text-[11px] text-muted">{splitCard(t.card).detail}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {t.grade}
                    {Object.keys(t.attributes).length > 0 && (
                      <div className="text-[11px] text-muted">{Object.values(t.attributes).join(' / ')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Addr address={t.holder} />
                  </td>
                  <td className="px-3 py-2 text-muted">
                    <TimeAgo date={t.issuedAt} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.transferCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{jpy(t.lastPriceJpy)}</td>
                  <td className="px-3 py-2">
                    <TxLink hash={t.issuedTx} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
