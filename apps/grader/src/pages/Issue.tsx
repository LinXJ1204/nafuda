// Issue a title, in four steps: pick a sealed slab from the bench → grade it → name the
// submitter → review and sign. Everything the contract would reject is checked before the
// wallet is asked to sign, and the call is simulated first.

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { privateKeyToAddress } from 'viem/accounts'
import { chipKey } from '@nafuda/core/chips.ts'
import { signGraderAction } from '@nafuda/ui/sign.ts'
import { isAddress, zeroAddress, type Hash } from 'viem'
import { COLLECTORS, titleName } from '@nafuda/core/deployment.ts'
import { SUBGRADE_VALUES, attributesFor, bench, type IssueForm } from '@nafuda/core/issue-rules.ts'
import { NO_CATEGORY, cardFields, checkCategory, type CategoryForm } from '@nafuda/core/categories.ts'
import { useTitles } from '@nafuda/ui/api.ts'
import { AppLink, Avatar, Button, Card, Pill, TxLink, useLinks } from '@nafuda/ui/components.tsx'
import { short, who } from '@nafuda/ui/format.ts'
import { SlabArt } from '@nafuda/ui/SlabArt.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { WalletButton } from '@nafuda/ui/WalletButton.tsx'
import { CategoryPicker } from '../components/CategoryPicker.tsx'
import { issueTitle } from '../issue.ts'
import { revertName } from '../revert.ts'
import { useConsole } from '../console.tsx'

const STEPS = ['Slab', 'Grade', 'Submitter', 'Review & sign']

export function IssuePage() {
  const { grader, canIssue } = useConsole()
  const { account, client } = useWallet()
  const links = useLinks()
  const queryClient = useQueryClient()
  const issued = useTitles({ grader: grader.label, limit: 200 })
  const [params] = useSearchParams()
  const fromIntake = params.get('sub')
  const slabs = useMemo(() => {
    const list = bench(grader, 12)
    const c = params.get('cert')
    // a slab sealed from the intake board may sit outside the bench range: its chip is derivable
    if (c && !list.some((s) => s.cert === c)) list.unshift({ cert: c, card: params.get('card') ?? '', chip: privateKeyToAddress(chipKey(grader.label, 'genuine', c)) })
    return list
  }, [grader, params])
  const issuedCerts = new Set(issued.data?.items.map((t) => t.cert))

  const [step, setStep] = useState(0)
  const [cert, setCert] = useState<string | null>(null)
  const [card, setCard] = useState('')
  const [grade, setGrade] = useState(grader.scale[1] ?? grader.scale[0])
  const [subgrades, setSubgrades] = useState<Record<string, string>>({})
  const [category, setCategory] = useState<CategoryForm>(NO_CATEGORY)
  const [holder, setHolder] = useState('')
  const [result, setResult] = useState<{ kind: 'error' | 'busy' | 'done'; text: string; tx?: Hash } | null>(null)

  useEffect(() => {
    setStep(0)
    setCert(null)
    setGrade(grader.scale[1] ?? grader.scale[0])
    setSubgrades(Object.fromEntries(grader.subgrades.map((k) => [k, '9.5'])))
    setCategory(NO_CATEGORY)
    setResult(null)
    const c = params.get('cert')
    if (c) {
      setCert(c)
      setCard(params.get('card') ?? '')
      const g = params.get('grade')
      if (g && grader.scale.includes(g)) setGrade(g)
      setHolder(params.get('holder') ?? '')
      // From the intake board the submitter is known. v2 graders still stop at the grade step:
      // subgrades and the card category are recorded there.
      setStep(params.get('holder') && grader.controllerVersion !== 2 ? 3 : 1)
    }
  }, [grader, params])

  const slab = slabs.find((s) => s.cert === cert)
  const form: IssueForm | null = slab ? { cert: slab.cert, card, grade, holder: holder.trim(), chip: slab.chip, subgrades, category } : null

  function pick(c: string) {
    const s = slabs.find((x) => x.cert === c)!
    setCert(c)
    setCard(s.card)
    setResult(null)
    setStep(1)
  }

  async function issue() {
    if (!form) return
    try {
      const hash = await issueTitle(client, account, grader, form, (text, tx) => setResult({ kind: 'busy', text, tx }))
      let text = `Issued ${titleName(grader.label, form.cert)}`
      if (fromIntake) {
        try {
          await signGraderAction(client, fromIntake, { action: 'issued', grade: '', cert: '', txHash: hash })
          text += `, and submission #${fromIntake} is marked issued`
        } catch (e) {
          text += ` (could not update submission #${fromIntake}: ${(e as Error).message.split('\n')[0]})`
        }
      }
      setResult({ kind: 'done', text, tx: hash })
      await queryClient.invalidateQueries()
    } catch (e) {
      const name = revertName(e)
      setResult({ kind: 'error', text: name ? `The contract would revert with ${name}.` : (e as Error).message.split('\n')[0] })
    }
  }

  const holderOk = isAddress(holder.trim()) && holder.trim().toLowerCase() !== zeroAddress
  const extra = form ? attributesFor(form, grader) : { keys: [], values: [] }
  const attrs = Object.fromEntries(extra.keys.map((k, i) => [k, extra.values[i]]))
  const categoryProblem = checkCategory(category, new Date().getFullYear())

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Issue a title</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Issuing creates <span className="font-mono">{'<cert>'}.{grader.ensName}</span>: it records the slab's chip, belongs to the submitter, and can never be
            changed or revoked, including by {grader.short}.
          </p>
        </div>
        {!canIssue && <WalletButton label="Connect grader wallet" />}
      </div>

      <ol className="mt-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              disabled={i > 0 && !slab}
              onClick={() => setStep(i)}
              className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${step === i ? 'border-accent bg-accent/10 font-bold text-accent' : i < step ? 'border-ok/50 text-ok' : 'border-line text-muted'}`}
            >
              <span className="text-xs">{i < step ? '✓' : i + 1}</span> {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-5">
          {step === 0 && (
            <>
              <h2 className="text-lg font-bold">Slabs on the bench</h2>
              <p className="mt-1 text-sm text-muted">Graded and sealed, chip inside. Simulated: in production the console reads the chip address by tapping the slab.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {slabs.map((s) => {
                  const done = issuedCerts.has(s.cert)
                  return (
                    <button
                      key={s.cert}
                      onClick={() => !done && pick(s.cert)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left ${done ? 'cursor-default border-line opacity-60' : cert === s.cert ? 'border-accent bg-accent/5' : 'border-line hover:border-ink'}`}
                    >
                      <div className="w-10 shrink-0">
                        <SlabArt grader={grader.label} cert={s.cert} card={s.card} grade={grader.scale[0]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold">#{s.cert}</div>
                        <div className="truncate text-xs text-muted">{s.card.replace(' (demo card)', '')}</div>
                        <div className="font-mono text-[10px] text-faint">chip {short(s.chip)}</div>
                      </div>
                      {done ? <Pill tone="ok">Issued</Pill> : <Pill tone="accent">Awaiting title</Pill>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 1 && slab && (
            <>
              <h2 className="text-lg font-bold">Grade #{slab.cert}</h2>
              <label className="mt-4 block text-sm text-muted">Card</label>
              <input value={card} onChange={(e) => setCard(e.target.value)} maxLength={64} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" />
              <label className="mt-4 block text-sm text-muted">Grade ({grader.short} scale)</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {grader.scale.map((g) => (
                  <Button key={g} size="sm" variant={grade === g ? 'primary' : 'secondary'} onClick={() => setGrade(g)}>
                    {g}
                  </Button>
                ))}
              </div>
              {grader.subgrades.length > 0 && (
                <>
                  <label className="mt-4 block text-sm text-muted">Subgrades (stored as ENS text records by controller v2)</label>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {grader.subgrades.map((k) => (
                      <div key={k} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                        <span className="text-sm capitalize">{k}</span>
                        <select value={subgrades[k] ?? ''} onChange={(e) => setSubgrades((s) => ({ ...s, [k]: e.target.value }))} className="rounded-lg border border-line bg-card px-2 py-1">
                          {SUBGRADE_VALUES.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <CategoryPicker grader={grader} value={category} onChange={setCategory} problem={categoryProblem} />
              <div className="mt-6 text-right">
                <Button variant="primary" disabled={!!categoryProblem} onClick={() => setStep(2)}>
                  Next: submitter
                </Button>
              </div>
            </>
          )}

          {step === 2 && slab && (
            <>
              <h2 className="text-lg font-bold">Who submitted #{slab.cert}?</h2>
              <p className="mt-1 text-sm text-muted">The submitter becomes the first holder. They can only transfer the title, nothing else.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {COLLECTORS.filter((c) => c.name !== 'mallory').map((c) => (
                  <Button key={c.address} size="sm" variant={holder === c.address ? 'primary' : 'secondary'} onClick={() => setHolder(c.address)}>
                    <Avatar address={c.address} size={14} />
                    {c.name}
                  </Button>
                ))}
              </div>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="0x…" className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm" />
              <div className="mt-6 text-right">
                <Button variant="primary" disabled={!holderOk} onClick={() => setStep(3)}>
                  Next: review
                </Button>
              </div>
            </>
          )}

          {step === 3 && slab && form && (
            <>
              <h2 className="text-lg font-bold">Review and sign</h2>
              <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted">Name</dt>
                <dd className="font-mono">{titleName(grader.label, slab.cert)}</dd>
                <dt className="text-muted">Card</dt>
                <dd>{card}</dd>
                <dt className="text-muted">Grade</dt>
                <dd>
                  {grade} {grader.subgrades.length > 0 && <span className="text-muted">({grader.subgrades.map((k) => `${k} ${subgrades[k]}`).join(', ')})</span>}
                </dd>
                {cardFields(attrs).length > 0 && (
                  <>
                    <dt className="text-muted">Category</dt>
                    <dd>{cardFields(attrs).map(([k, v]) => `${k} ${v}`).join(' · ')}</dd>
                  </>
                )}
                <dt className="text-muted">Holder</dt>
                <dd>{who(form.holder)} <span className="font-mono text-xs text-muted">{form.holder}</span></dd>
                <dt className="text-muted">slab.chip</dt>
                <dd className="font-mono text-xs">{slab.chip}</dd>
                <dt className="text-muted">Call</dt>
                <dd className="font-mono text-xs">{grader.controllerVersion === 2 && extra.keys.length ? `issueWithAttributes (${extra.keys.length} extra records)` : 'issue'} on {short(grader.controller)}</dd>
              </dl>
              <Button variant="primary" size="lg" className="mt-6 w-full" disabled={result?.kind === 'busy'} onClick={issue}>
                {canIssue ? 'Issue title' : 'Check and issue (needs the grader wallet)'}
              </Button>
              {result && (
                <div className={`mt-4 rounded-xl border-2 p-4 text-sm ${result.kind === 'error' ? 'border-bad text-bad' : result.kind === 'done' ? 'border-ok' : 'border-line text-muted'}`}>
                  <strong className={result.kind === 'done' ? 'text-ok' : ''}>{result.kind === 'error' ? 'Not sent' : result.kind === 'done' ? 'Title issued' : 'Working'}</strong>
                  <p className="mt-1 text-ink">
                    {result.text} {result.tx && <TxLink hash={result.tx} />}
                  </p>
                  {result.kind === 'done' && (
                    <p className="mt-2">
                      <AppLink to={links.title(grader.label, slab.cert)} className="font-semibold underline">
                        Open it in the collector app and tap the slab →
                      </AppLink>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Card>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Preview</p>
          {slab ? (
            <SlabArt grader={grader.label} cert={slab.cert} card={card || ' '} grade={grade} attributes={attrs} />
          ) : (
            <div className="grid aspect-[300/480] place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-muted">Pick a slab</div>
          )}
        </div>
      </div>
    </>
  )
}
