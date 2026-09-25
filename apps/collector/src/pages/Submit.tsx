// Send a card to a grader: a signed submission the grader sees on its intake board. When the
// grader has graded and sealed the slab, it issues the title to the submitter.

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { GRADERS, graderByLabel } from '@nafuda/core/deployment.ts'
import { SERVICES } from '@nafuda/core/signed.ts'
import { useSubmissions, type SubmissionRow } from '@nafuda/ui/api.ts'
import { Button, Card, Empty, GraderBadge, Pill, TimeAgo } from '@nafuda/ui/components.tsx'
import { jpy } from '@nafuda/ui/format.ts'
import { signSubmission } from '@nafuda/ui/sign.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { WalletButton } from '@nafuda/ui/WalletButton.tsx'

const STATUS: Record<SubmissionRow['status'], { tone: 'muted' | 'warn' | 'accent' | 'ok' | 'bad'; text: string }> = {
  received: { tone: 'muted', text: 'Received' },
  grading: { tone: 'warn', text: 'Grading' },
  sealed: { tone: 'accent', text: 'Sealed, title next' },
  issued: { tone: 'ok', text: 'Title issued' },
  rejected: { tone: 'bad', text: 'Returned' },
}

export function SubmissionList({ items }: { items: SubmissionRow[] }) {
  if (!items.length) return <Empty>No submissions yet.</Empty>
  return (
    <div className="grid gap-2">
      {items.map((s) => {
        const st = STATUS[s.status]
        return (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <GraderBadge label={s.grader} />
              <div>
                <div className="font-semibold">{s.card.replace(' (demo card)', '')}</div>
                <div className="text-xs text-muted">
                  #{s.id} · {s.service} · declared {jpy(s.declaredValueJpy)} · <TimeAgo date={s.createdAt} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {s.grade && <span className="text-xs">{s.grade}</span>}
              {s.status === 'issued' && s.cert ? (
                <Link to={`/title/${s.grader}/${s.cert}`} className="text-xs font-semibold text-accent underline">
                  #{s.cert} →
                </Link>
              ) : (
                s.cert && <span className="font-mono text-xs text-muted">#{s.cert}</span>
              )}
              <Pill tone={st.tone}>{st.text}</Pill>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SubmitPage() {
  const { account, client } = useWallet()
  const queryClient = useQueryClient()
  const mine = useSubmissions({ submitter: account ?? undefined })
  const [grader, setGrader] = useState(GRADERS[0]?.label ?? 'psa-sim')
  const [card, setCard] = useState('')
  const [value, setValue] = useState('')
  const [service, setService] = useState<string>('Regular')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    const v = Number(value.replace(/[,¥\s]/g, ''))
    if (!card.trim()) return setMsg({ ok: false, text: 'Enter the card.' })
    if (!Number.isSafeInteger(v) || v <= 0) return setMsg({ ok: false, text: 'Enter the declared value in yen.' })
    try {
      const row = await signSubmission(client, { grader, card: card.trim(), declaredValueJpy: BigInt(v), service })
      setMsg({ ok: true, text: `Submission #${row.id} sent to ${graderByLabel(grader)?.short}.` })
      setCard('')
      setValue('')
      await queryClient.invalidateQueries()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.split('\n')[0] })
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mt-8 text-3xl font-bold">Submit a card for grading</h1>
      <p className="mt-2 text-muted">
        Your signed submission goes to the grader's intake board. The grader grades the card, seals it with a chip, and issues the title to you. You sign
        a message, not a transaction: it costs nothing.
      </p>
      <Card className="mt-6 grid gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          {GRADERS.map((g) => (
            <Button key={g.label} size="sm" variant={grader === g.label ? 'primary' : 'secondary'} onClick={() => setGrader(g.label)}>
              <span className="size-2 rounded-full" style={{ background: g.color }} />
              {g.short}
            </Button>
          ))}
        </div>
        <input value={card} onChange={(e) => setCard(e.target.value)} maxLength={64} placeholder="Card (e.g. Kitsune Lantern - Promo #042)" className="rounded-xl border border-line bg-paper px-3 py-2" />
        <div className="flex flex-wrap gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="Declared value ¥" className="w-48 rounded-xl border border-line bg-paper px-3 py-2" />
          <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-xl border border-line bg-paper px-3 py-2">
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="ml-auto">{account ? <Button variant="primary" onClick={submit}>Sign and submit</Button> : <WalletButton />}</div>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
      </Card>
      {account && (
        <>
          <h2 className="mt-10 mb-3 text-xl font-bold">My submissions</h2>
          <SubmissionList items={mine.data ?? []} />
        </>
      )}
    </div>
  )
}
