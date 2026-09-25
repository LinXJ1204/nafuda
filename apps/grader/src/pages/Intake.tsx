// Intake board: submissions from collectors, moved along by the grader with signed actions
// (received → grading → sealed → issued). Issuing happens on chain from the Issue page.

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { bench } from '@nafuda/core/issue-rules.ts'
import { useSubmissions, useTitles, type SubmissionRow } from '@nafuda/ui/api.ts'
import { Addr, AppLink, Button, Card, TimeAgo, useLinks } from '@nafuda/ui/components.tsx'
import { jpy } from '@nafuda/ui/format.ts'
import { signGraderAction } from '@nafuda/ui/sign.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { useConsole } from '../console.tsx'

const COLUMNS: { status: SubmissionRow['status']; title: string; hint: string }[] = [
  { status: 'received', title: 'Received', hint: 'Card arrived at the grader' },
  { status: 'grading', title: 'Grading', hint: 'Being graded' },
  { status: 'sealed', title: 'Sealed', hint: 'In its slab, chip inside' },
  { status: 'issued', title: 'Title issued', hint: 'On ENS, with the submitter' },
]

export function IntakePage() {
  const { grader, canIssue } = useConsole()
  const { client } = useWallet()
  const links = useLinks()
  const queryClient = useQueryClient()
  const subs = useSubmissions({ grader: grader.label })
  const issued = useTitles({ grader: grader.label, limit: 200 })
  const [error, setError] = useState<string | null>(null)
  const [grades, setGrades] = useState<Record<string, string>>({})

  const taken = new Set([...(issued.data?.items.map((t) => t.cert) ?? []), ...(subs.data?.map((s) => s.cert).filter(Boolean) as string[] ?? [])])
  const freeCerts = bench(grader, 30).map((b) => b.cert).filter((c) => !taken.has(c))

  async function act(s: SubmissionRow, action: 'grading' | 'sealed' | 'rejected') {
    setError(null)
    try {
      const grade = action === 'sealed' ? (grades[s.id] ?? grader.scale[1] ?? grader.scale[0]) : ''
      const cert = action === 'sealed' ? freeCerts[0] : ''
      if (action === 'sealed' && !cert) throw new Error('No free cert numbers on the bench.')
      await signGraderAction(client, s.id, { action, grade, cert, txHash: '' })
      await queryClient.invalidateQueries({ queryKey: ['submissions'] })
    } catch (e) {
      setError((e as Error).message.split('\n')[0])
    }
  }

  const by = (status: string) => subs.data?.filter((s) => s.status === status) ?? []

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Intake</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Collectors submit cards with a signed message. Each move on this board is a message signed by the {grader.short} key, checked by the server. The
            last step, issuing the title, is an on-chain transaction.
          </p>
        </div>
        {!canIssue && <span className="text-sm text-muted">Read-only: connect the {grader.short} wallet to move cards.</span>}
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="rounded-2xl border border-line bg-raised p-3">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-bold">{col.title}</h2>
              <span className="text-xs text-muted">{by(col.status).length}</span>
            </div>
            <p className="-mt-2 mb-3 text-[11px] text-faint">{col.hint}</p>
            <div className="grid gap-2">
              {by(col.status).map((s) => (
                <Card key={s.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="leading-snug">{s.card.replace(' (demo card)', '')}</strong>
                    <span className="font-mono text-[11px] text-faint">#{s.id}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                    from <Addr address={s.submitter} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {s.service} · declared {jpy(s.declaredValueJpy)} · <TimeAgo date={s.updatedAt} />
                  </div>
                  {s.grade && (
                    <div className="mt-1 text-xs">
                      <strong>{s.grade}</strong> {s.cert && <span className="font-mono text-muted">cert #{s.cert}</span>}
                    </div>
                  )}
                  {canIssue && s.status === 'received' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => act(s, 'grading')}>
                        Start grading
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(s, 'rejected')}>
                        Return
                      </Button>
                    </div>
                  )}
                  {canIssue && s.status === 'grading' && (
                    <div className="mt-2 grid gap-2">
                      <select value={grades[s.id] ?? grader.scale[1] ?? grader.scale[0]} onChange={(e) => setGrades((g) => ({ ...g, [s.id]: e.target.value }))} className="rounded-lg border border-line bg-card px-2 py-1 text-xs">
                        {grader.scale.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="primary" onClick={() => act(s, 'sealed')}>
                        Seal as cert #{freeCerts[0] ?? '—'}
                      </Button>
                    </div>
                  )}
                  {s.status === 'sealed' && canIssue && (
                    <Link
                      to={`/issue?sub=${s.id}&cert=${s.cert}&card=${encodeURIComponent(s.card)}&grade=${encodeURIComponent(s.grade ?? '')}&holder=${s.submitter}`}
                      className="mt-2 inline-block text-xs font-semibold text-accent underline"
                    >
                      Issue the title →
                    </Link>
                  )}
                  {s.status === 'issued' && s.cert && (
                    <AppLink to={links.title(s.grader, s.cert)} className="mt-2 inline-block text-xs font-semibold text-ok underline">
                      View title #{s.cert} ↗
                    </AppLink>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
