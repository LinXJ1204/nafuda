// The buyer check, step by step: fresh challenge → the slab's chip signs it → recover the signer
// → compare with slab.chip on ENS → compare the seller with the holder on ENS → outcome.
// Every value shown is the real one from this run. A chip signature is proof, never
// authorization: nothing here changes any state.

import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress, isAddressEqual, type Address, type Hex } from 'viem'
import { COLLECTORS } from '@nafuda/core/deployment.ts'
import { SimulatedChip, type ChipVariant } from '@nafuda/core/chips.ts'
import { OUTCOME_TEXT, checkChip, classify, makeChallenge, makeSellerChallenge, type Challenge, type ChipCheck, type Outcome } from '@nafuda/core/verify.ts'
import { Avatar, Button, Card } from '@nafuda/ui/components.tsx'
import type { ResolvedTitle } from '@nafuda/ui/ens.ts'
import { short, who } from '@nafuda/ui/format.ts'
import { useT } from '@nafuda/ui/i18n.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { recoverMessageAddress } from 'viem'
import type { IntegrityCheck } from '@nafuda/core/integrity.ts'

type Run = {
  challenge: Challenge
  signature: Hex
  check: ChipCheck
  outcome: Outcome
  seller: Address | null
  replay: boolean
}

const STEP_MS = 450

export function VerifyPanel({ grader, cert, title, onTapping, integrity }: { grader: string; cert: string; title: ResolvedTitle; onTapping?: (on: boolean) => void; integrity?: IntegrityCheck[] }) {
  const [variant, setVariant] = useState<ChipVariant>('genuine')
  const [seller, setSeller] = useState('')
  const [sellerNote, setSellerNote] = useState<string | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [shown, setShown] = useState(0)
  const [busy, setBusy] = useState(false)
  const timers = useRef<number[]>([])
  const { client } = useWallet()
  const { t, outcome } = useT()

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const sellerAddr = isAddress(seller.trim()) ? getAddress(seller.trim()) : null
  const picks = [
    ...(title.holder ? [{ label: `${who(title.holder)} (holder)`, address: title.holder }] : []),
    ...COLLECTORS.filter((c) => c.name === 'mallory' || c.name === 'bob')
      .filter((c) => !title.holder || !isAddressEqual(c.address, title.holder))
      .map((c) => ({ label: c.name, address: c.address })),
  ]

  function animate(r: Run) {
    timers.current.forEach(clearTimeout)
    setRun(r)
    setShown(0)
    onTapping?.(true)
    for (let i = 1; i <= 7; i++) timers.current.push(window.setTimeout(() => setShown(i), i * STEP_MS))
    timers.current.push(window.setTimeout(() => onTapping?.(false), 7 * STEP_MS))
  }

  async function tap() {
    setBusy(true)
    try {
      const challenge = makeChallenge(grader, cert)
      const signature = await new SimulatedChip(grader, variant, cert).sign(challenge.message)
      const check: ChipCheck = title.chip ? await checkChip(challenge, signature, title.chip) : { ok: false, reason: 'wrong-chip' }
      animate({ challenge, signature, check, outcome: classify(title, title.chip ? check : null, sellerAddr), seller: sellerAddr, replay: false })
    } finally {
      setBusy(false)
    }
  }

  async function replay() {
    if (!run || !title.chip) return
    const challenge = makeChallenge(grader, cert)
    const check = await checkChip(challenge, run.signature, title.chip)
    animate({ challenge, signature: run.signature, check, outcome: classify(title, check, sellerAddr), seller: sellerAddr, replay: true })
  }

  async function sellerProves() {
    try {
      const { wallet, account } = await client()
      const message = makeSellerChallenge(grader, cert).message
      const signature = await wallet.signMessage({ account, message })
      const signer = await recoverMessageAddress({ message, signature })
      setSeller(signer)
      setSellerNote(`Verified: ${who(signer)} signed a fresh challenge with their wallet.`)
    } catch (e) {
      setSellerNote(`Wallet: ${(e as Error).message.split('\n')[0]}`)
    }
  }

  const recovered = run && 'signer' in run.check ? run.check.signer : null
  const holderMatch = run?.seller && title.holder ? isAddressEqual(run.seller, title.holder) : null
  const text = run ? outcome(run.outcome, OUTCOME_TEXT[run.outcome]) : null
  const integrityOk = integrity?.every((c) => c.ok)
  const tone = { ok: 'border-ok text-ok', warn: 'border-warn text-warn', bad: 'border-bad text-bad', none: 'border-line text-muted' }

  const steps = run
    ? [
        { title: 'Fresh challenge', detail: `nonce ${short(run.challenge.nonce)} · valid 60 s`, mono: run.challenge.message, ok: true },
        { title: run.replay ? 'Old signature replayed' : 'Chip signs it', detail: run.replay ? 'an attacker re-sends a signature captured earlier' : `${variant === 'genuine' ? 'the slab the grader sealed' : 'a clone slab with the same cert'}`, mono: short(run.signature), ok: true },
        { title: 'Recover the signer', detail: 'EIP-191 ecrecover over this challenge', mono: recovered ?? '—', ok: true },
        { title: 'Compare with slab.chip on ENS', detail: title.chip ? `ENS says ${short(title.chip)}` : 'no title on ENS', mono: run.check.ok ? 'match' : `mismatch (${'reason' in run.check ? run.check.reason : ''})`, ok: run.check.ok },
        { title: 'Compare seller with the holder on ENS', detail: title.holder ? `holder is ${who(title.holder)}` : 'no holder', mono: run.seller ? (holderMatch ? `${who(run.seller)} is the holder` : `${who(run.seller)} is not the holder`) : 'no seller given', ok: !!holderMatch },
        ...(title.status === 'ISSUED'
          ? [
              {
                title: "The title follows the grader's rules (EAC)",
                detail: 'resolver is the grader\'s controller · holder can only transfer · sole assignee · registry emancipated',
                mono: integrity ? (integrityOk ? 'all 5 checks pass' : `failed: ${integrity.filter((c) => !c.ok).map((c) => c.title).join('; ')}`) : 'reading…',
                ok: !!integrityOk,
              },
            ]
          : []),
      ]
    : []

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{t('Check this slab before you buy')}</h2>
          <p className="mt-1 text-sm text-muted">{t('At a card show: tap the slab with your phone, then check the seller against the holder on ENS.')}</p>
        </div>
        <span className="rounded border border-shu px-1.5 text-[11px] font-bold tracking-wide text-shu">SIMULATED CHIP</span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-bold">
            <span className="text-accent">1</span> {t("The slab in the seller's hand")}
          </div>
          {(['genuine', 'clone'] as const).map((v) => (
            <label key={v} className={`mb-2 flex cursor-pointer gap-3 rounded-xl border p-3 ${variant === v ? 'border-accent bg-accent/5' : 'border-line'}`}>
              <input type="radio" name="variant" checked={variant === v} onChange={() => setVariant(v)} className="mt-1 accent-[var(--accent)]" />
              <span>
                <strong className="block text-sm">{v === 'genuine' ? 'Genuine slab' : 'Clone slab'}</strong>
                <small className="text-xs text-muted">
                  {v === 'genuine'
                    ? `Sealed by the grader for #${cert}. Its chip: ${short(new SimulatedChip(grader, 'genuine', cert).address)}.`
                    : `Same cert #${cert} on a perfect fake label, but a different chip: ${short(new SimulatedChip(grader, 'clone', cert).address)}.`}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div>
          <div className="mb-2 text-sm font-bold">
            <span className="text-accent">2</span> {t('Who is selling?')}
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {picks.map((p) => (
              <Button key={p.address} size="sm" onClick={() => (setSeller(p.address), setSellerNote('Typed in. Anyone can claim an address; the wallet button proves it.'))}>
                <Avatar address={p.address} size={14} /> {p.label}
              </Button>
            ))}
          </div>
          <input
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            placeholder="Seller address 0x…"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={sellerProves}>
              Seller proves it with their wallet
            </Button>
          </div>
          {sellerNote && <p className="mt-2 text-xs text-muted">{sellerNote}</p>}
        </div>
      </div>

      <Button variant="primary" size="lg" className="mt-5 w-full" disabled={busy} onClick={tap}>
        {t('Tap the slab and verify')}
      </Button>

      {run && (
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <ol className="relative grid gap-2">
            {steps.map((s, i) => (
              <li
                key={i}
                className={`grid grid-cols-[28px_1fr] gap-2 rounded-xl border p-2.5 transition-all duration-300 ${shown > i ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'} ${
                  i >= 3 ? (s.ok ? 'border-ok/40' : 'border-bad/40') : 'border-line'
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${i >= 3 ? (s.ok ? 'bg-ok text-white' : 'bg-bad text-white') : 'bg-raised text-muted'}`}>
                  {i >= 3 ? (s.ok ? '✓' : '✗') : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-xs text-muted">{s.detail}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{s.mono}</div>
                </div>
              </li>
            ))}
          </ol>
          {text && (
            <div className={`rounded-2xl border-2 p-5 transition-opacity duration-500 ${shown >= steps.length + 1 ? 'opacity-100' : 'opacity-0'} ${tone[text.tone]}`}>
              <div className="text-[11px] font-bold tracking-widest uppercase">{t('Result')}</div>
              <h3 className="mt-1 text-lg font-bold">{text.title}</h3>
              <p className="mt-2 text-sm text-ink">{text.body}</p>
              {run.replay && <p className="mt-2 text-xs text-muted">Replayed an earlier signature against a new challenge: it no longer proves anything.</p>}
              {integrity && !integrityOk && (
                <p className="mt-2 rounded-lg border border-bad bg-bad/5 px-2 py-1 text-xs font-semibold text-bad">
                  Warning: this title does not follow the grader's rules (see Title integrity). Its records could be changed; do not rely on it.
                </p>
              )}
              {!run.replay && title.chip && (
                <Button size="sm" className="mt-4" onClick={replay}>
                  Attack: replay this signature
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
