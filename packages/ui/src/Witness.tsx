// Second witness: Curvegrid MultiBaas indexes the same grader registries on its own
// infrastructure and pushes each event to Nafuda through a signed webhook. The server compares
// the two indexes both ways (server/src/witness.ts); these components show the result.

import type { ReactNode } from 'react'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import { useWitness, type Status, type Witness, type WitnessVerdict } from './api.ts'
import { Addr, AppLink, Card, Empty, GraderBadge, Pill, Skeleton, TimeAgo, TxLink, useLinks } from './components.tsx'

const VERDICT: Record<WitnessVerdict, { label: string; tone: 'ok' | 'bad' | 'muted'; help: string }> = {
  agreed: { label: 'agrees', tone: 'ok', help: 'The same log, the same title, the same sender and recipient in both indexes.' },
  mismatch: { label: 'differs', tone: 'bad', help: 'Both indexes have this log but disagree on what it did.' },
  missing: { label: 'not in our index', tone: 'bad', help: 'Curvegrid saw this event; the Nafuda index has no matching record.' },
  pending: { label: 'indexer catching up', tone: 'muted', help: 'Newer than the last block the Nafuda indexer has written.' },
  regeneration: { label: 'token id regenerated', tone: 'muted', help: 'A burn and re-mint of the same name in one transaction: ENSv2 renews the token id when roles change. Not a change of holder.' },
}

const findings = (w: Witness) => w.summary.mismatch + w.summary.missing + w.summary.unwitnessed

export function WitnessStatus({ w }: { w: Witness }) {
  if (!w.configured) return <Pill tone="muted">not connected</Pill>
  if (!w.summary.witnessed) return <Pill tone="muted">waiting for the first event</Pill>
  const n = findings(w)
  return n ? <Pill tone="bad">{n} to look at</Pill> : <Pill tone="ok">✓ indexes agree</Pill>
}

/// Header badge on every page (both apps): the witness's verdict at a glance.
export function WitnessBadge({ w, href }: { w: NonNullable<Status['witness']>; href: string }) {
  const settled = w.witnessed - w.pending - w.regeneration
  const problems = w.mismatch + w.missing + w.unwitnessed
  return (
    <AppLink
      to={href}
      title="Second witness: Curvegrid MultiBaas indexes the same registries on its own infrastructure; the server checks that both indexes agree"
      className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap no-underline sm:inline-flex ${problems ? 'border-bad/40 text-bad' : 'border-ok/40 text-ok'}`}
    >
      {problems ? '✕' : '✓'} Curvegrid
      <span className="font-normal tabular-nums">{problems ? `${problems} to check` : `${w.agreed}/${settled}`}</span>
    </AppLink>
  )
}

/// One line for busy pages (Activity, the grader Trust page). Hidden until the witness is connected.
export function WitnessBanner({ href }: { href?: string }) {
  const q = useWitness()
  const w = q.data
  if (!w?.configured) return null
  const s = w.summary
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-card px-4 py-2.5 text-sm">
      <span className="font-semibold">Second witness</span>
      <span className="text-muted">Curvegrid MultiBaas</span>
      <WitnessStatus w={w} />
      {s.witnessed > 0 && (
        <span className="text-muted tabular-nums">
          {s.agreed}/{s.witnessed - s.pending - s.regeneration} events agree
          {s.unwitnessed ? ` · ${s.unwitnessed} indexed but not witnessed` : ''}
          {w.deliveries.last && (
            <>
              {' '}
              · last delivery <TimeAgo date={w.deliveries.last} />
            </>
          )}
        </span>
      )}
      {href && (
        <AppLink to={href} className="ml-auto text-accent">
          How it works →
        </AppLink>
      )}
    </div>
  )
}

function Flow() {
  const box = 'rounded-xl border border-line bg-raised px-3 py-2 text-center text-[13px] leading-snug'
  const arrow = <span className="text-faint" aria-hidden>→</span>
  return (
    <div className="mt-4 grid gap-2 text-sm md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
      <div className={box}>
        <div className="font-semibold">Sepolia</div>
        <div className="text-muted">3 grader registries</div>
      </div>
      <div className="hidden md:block">{arrow}</div>
      <div className="grid gap-2">
        <div className={box}>
          <div className="font-semibold">Nafuda indexer</div>
          <div className="text-muted">our server, reads logs</div>
        </div>
        <div className={`${box} border-accent/40`}>
          <div className="font-semibold">Curvegrid MultiBaas</div>
          <div className="text-muted">their servers, signed webhook</div>
        </div>
      </div>
      <div className="hidden md:block">{arrow}</div>
      <div className={`${box} border-ok/40`}>
        <div className="font-semibold">Compared both ways</div>
        <div className="text-muted">every event, by transaction and log position</div>
      </div>
    </div>
  )
}

/// The full panel (collector app, Developers page).
export function WitnessPanel() {
  const q = useWitness()
  const links = useLinks()
  const w = q.data
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Second witness: Curvegrid MultiBaas</h2>
        {w && <WitnessStatus w={w} />}
      </div>
      <p className="mt-2 text-sm text-muted">
        The Nafuda server indexes chain events for lists and charts. Title pages already re-check each title through ENS, but a list could still leave a transfer out, or show one
        that never happened. So a second, independent indexer watches the same three registries: <b className="text-ink">Curvegrid MultiBaas</b> syncs their events on its
        own infrastructure and pushes each one here through a webhook signed with HMAC-SHA256. The server checks both directions: every event Curvegrid saw must be in our
        index, and every transfer we indexed in Curvegrid&apos;s window must have been seen by Curvegrid. Its data is only compared, never copied into our index.
      </p>
      <Flow />
      {q.isLoading && <Skeleton className="mt-4 h-40" />}
      {w && !w.configured && <p className="mt-4 text-sm text-muted">Not connected yet.</p>}
      {w?.configured && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="Witnessed events" value={w.summary.witnessed} />
            <Tile label="Agree" value={w.summary.agreed} tone="ok" />
            <Tile label="Differ or missing" value={w.summary.mismatch + w.summary.missing} tone={w.summary.mismatch + w.summary.missing ? 'bad' : undefined} />
            <Tile label="Indexed, not witnessed" value={w.summary.unwitnessed} tone={w.summary.unwitnessed ? 'bad' : undefined} />
            <Tile label="Deliveries" value={w.deliveries.count} sub={w.deliveries.last ? <TimeAgo date={w.deliveries.last} /> : 'none yet'} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {w.summary.fromBlock ? (
              <>
                Window: blocks {w.summary.fromBlock}–{w.summary.toBlock}
                {w.deliveries.first && (
                  <>
                    , since <TimeAgo date={w.deliveries.first} />
                  </>
                )}
                .{' '}
              </>
            ) : null}
            On the free plan MultiBaas starts indexing at most 100 blocks before a contract is linked, so titles issued earlier are outside its window: the witness covers
            what happens from then on. Deliveries refused since the server started: {Object.entries(w.refused).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.
          </p>
          {w.unwitnessed.length > 0 && (
            <div className="mt-4 rounded-xl border border-bad/40 bg-bad/5 p-3 text-sm">
              <div className="font-semibold text-bad">Indexed by Nafuda but not reported by Curvegrid</div>
              <ul className="mt-1 space-y-0.5">
                {w.unwitnessed.map((u) => (
                  <li key={`${u.tx}:${u.cert}`}>
                    {u.kind} of <AppLink to={links.title(u.grader, u.cert)}>#{u.cert}</AppLink> ({graderByLabel(u.grader)?.short}) in block {u.block} · <TxLink hash={u.tx} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="mt-5 text-sm font-bold">Latest witnessed events</h3>
          {w.recent.length === 0 ? (
            <div className="mt-2">
              <Empty>Connected. Waiting for the first event: MultiBaas reports transfers as they happen.</Empty>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="px-3 py-2 font-semibold">Event</th>
                    <th className="px-2 py-2 font-semibold">Title</th>
                    <th className="px-2 py-2 font-semibold">From → to</th>
                    <th className="px-2 py-2 font-semibold">Verdict</th>
                    <th className="px-3 py-2 font-semibold">Tx · log</th>
                  </tr>
                </thead>
                <tbody>
                  {w.recent.map((e) => {
                    const v = VERDICT[e.verdict]
                    return (
                      <tr key={`${e.tx}:${e.logIndex}:${e.batchIndex}`} className="border-t border-line">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {e.kind === 'mint' ? 'Issued' : e.kind === 'burn' ? 'Burned' : 'Transfer'}
                          <div className="text-[11px] text-faint">
                            <TimeAgo date={e.triggeredAt} />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <GraderBadge label={e.grader} />{' '}
                          {e.cert ? <AppLink to={links.title(e.grader, e.cert)} className="font-mono text-[13px]">#{e.cert}</AppLink> : <span className="text-faint">unknown name</span>}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {e.kind === 'mint' ? <span className="text-muted">mint</span> : <Addr address={e.from} />} <span className="text-faint">→</span>{' '}
                          {e.kind === 'burn' ? <span className="text-muted">burn</span> : <Addr address={e.to} />}
                        </td>
                        <td className="px-2 py-2" title={e.detail ?? v.help}>
                          <Pill tone={v.tone}>{v.label}</Pill>
                          {e.detail && <div className="mt-0.5 text-[11px] text-bad">{e.detail}</div>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <TxLink hash={e.tx} /> <span className="font-mono text-[11px] text-faint">#{e.logIndex}{e.batchIndex ? `.${e.batchIndex}` : ''}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: number; sub?: ReactNode; tone?: 'ok' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2">
      <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  )
}
