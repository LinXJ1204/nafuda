// Who can do what to this title, asked of the contracts live. Every cell is a simulated call from
// that actor's address; "Try it" replays an attack step by step with the contract's own reply.

import { useState } from 'react'
import type { Address } from 'viem'
import { ACTIONS, ACTORS, callFor, explain, verdict, type ActionId, type Actor } from '@nafuda/core/permissions.ts'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import { Button, Card, Pill, Skeleton, useEnsName } from '@nafuda/ui/components.tsx'
import { short } from '@nafuda/ui/format.ts'
import { simulate, usePermissions, useRoleBitmaps } from '@nafuda/ui/permissions.ts'
import { RoleBitmap } from './RoleBitmap.tsx'

const SCENARIOS: { id: string; title: string; actor: Actor; actions: ActionId[] }[] = [
  { id: 'grader', title: 'The grader tries to take it back', actor: 'grader', actions: ['transfer', 'resolver', 'unregister'] },
  { id: 'holder', title: 'The holder tries to fake its records', actor: 'holder', actions: ['resolver', 'unregister', 'upgrade'] },
  { id: 'stranger', title: 'A stranger tries to steal it', actor: 'stranger', actions: ['transfer', 'resolver'] },
  { id: 'operator', title: "We (the operator) try to swap the grader's name", actor: 'operator', actions: ['subtree', 'upgrade'] },
]

type Line = { text: string; tone: 'call' | 'ok' | 'refused' | 'power' }

const CELL = {
  expected: { icon: '✓', cls: 'bg-ok/15 text-ok', label: 'allowed' },
  refused: { icon: '✕', cls: 'bg-raised text-muted', label: 'refused' },
  power: { icon: '!', cls: 'bg-warn/20 text-warn', label: 'allowed' },
} as const

export function PermissionsPanel({ grader, cert, holder }: { grader: string; cert: string; holder: Address }) {
  const perms = usePermissions(grader, cert, holder)
  const bitmaps = useRoleBitmaps(grader, cert, holder)
  const holderEns = useEnsName(holder)
  const strangerEns = useEnsName(perms.data?.ctx.addresses.stranger)
  const g = graderByLabel(grader)!
  const names: Record<Actor, string> = {
    holder: holderEns.data ?? short(holder),
    grader: g.short,
    operator: 'the operator',
    stranger: strangerEns.data ?? 'a stranger',
  }
  const [selected, setSelected] = useState<{ actor: Actor; action: ActionId } | null>({ actor: 'grader', action: 'resolver' })
  const [log, setLog] = useState<Line[]>([])
  const [running, setRunning] = useState<string | null>(null)

  async function run(s: (typeof SCENARIOS)[number]) {
    if (!perms.data) return
    setRunning(s.id)
    setLog([])
    const lines: Line[] = []
    const push = (l: Line) => {
      lines.push(l)
      setLog([...lines])
    }
    for (const action of s.actions) {
      const call = callFor(action, s.actor, perms.data.ctx)
      push({ tone: 'call', text: `› ${names[s.actor]} calls ${call.functionName}(…) on ${action === 'subtree' ? 'the nafuda.eth registry' : `the ${g.short} registry`}` })
      await new Promise((r) => setTimeout(r, 450))
      const o = await simulate(action, s.actor, perms.data.ctx)
      const v = verdict(action, s.actor, o)
      push({ tone: v === 'refused' ? 'refused' : v === 'power' ? 'power' : 'ok', text: `${o.allowed ? '✓ would succeed' : `✕ reverted${o.error ? `: ${o.error}` : ''}`} — ${explain(action, s.actor, o, names)}` })
      await new Promise((r) => setTimeout(r, 350))
    }
    setRunning(null)
  }

  const m = perms.data?.matrix
  const sel = selected && m ? { ...selected, o: m[selected.actor][selected.action] } : null

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Who can do what (Enhanced Access Control)</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Not our claim: each cell below is the call simulated from that actor's address against the live contracts (<span className="font-mono">eth_call</span>, no gas, nothing
            changes), with the contract's own answer.
          </p>
        </div>
        <Pill tone="accent">live on Sepolia</Pill>
      </div>

      {!m ? (
        <Skeleton className="mt-5 h-56" />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th />
                {ACTIONS.map((a) => (
                  <th key={a.id} className="px-1 pb-1 text-center text-[11px] font-semibold text-muted" title={a.label}>
                    {a.short}
                    <div className="text-[9px] font-normal text-faint">{a.scope === 'title' ? 'this title' : 'the grader name'}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTORS.map((actor) => (
                <tr key={actor.id}>
                  <td className="pr-2 text-right text-xs whitespace-nowrap">
                    <div className="font-semibold">{actor.label}</div>
                    <div className="max-w-40 truncate text-[10px] text-muted">{names[actor.id]}</div>
                  </td>
                  {ACTIONS.map((a) => {
                    const o = m[actor.id][a.id]
                    const v = verdict(a.id, actor.id, o)
                    const isSel = selected?.actor === actor.id && selected.action === a.id
                    return (
                      <td key={a.id} className="p-0">
                        <button
                          onClick={() => setSelected({ actor: actor.id, action: a.id })}
                          className={`grid h-11 w-full cursor-pointer place-items-center rounded-lg text-base font-extrabold transition ${CELL[v].cls} ${isSel ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-line'}`}
                          title={explain(a.id, actor.id, o, names)}
                        >
                          {CELL[v].icon}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
            <span><span className="font-bold text-ok">✓</span> allowed, as designed</span>
            <span><span className="font-bold">✕</span> refused by the contract</span>
            <span><span className="font-bold text-warn">!</span> allowed: a power someone still holds (see note)</span>
          </div>
          {ACTORS.some((a) => ACTIONS.some((x) => verdict(x.id, a.id, m[a.id][x.id]) === 'power')) && (
            <p className="mt-3 rounded-xl border border-warn/40 bg-warn/5 px-4 py-2 text-xs text-ink">
              <strong className="text-warn">Note on the ! cells.</strong>
              {m.operator.subtree.allowed || m.grader.subtree.allowed
                ? ' Re-point grader: until the final lock runs, the operator and each grader can still point a grader\'s whole name elsewhere. The lock (scripts/src/lock.ts) removes this for every grader, and is irreversible.'
                : ''}
              {m.grader.registrar.allowed
                ? ' Grant REGISTRAR: the grader keeps REGISTRAR admin so it can switch issuing contracts for future certs; a title registered outside the controller fails the title integrity checks below.'
                : ''}
            </p>
          )}
          {sel && (
            <div className="mt-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
              <div className="font-mono text-[11px] text-muted">
                from {names[sel.actor]} ({short(perms.data!.ctx.addresses[sel.actor])}) · {callFor(sel.action, sel.actor, perms.data!.ctx).functionName}(…)
              </div>
              <div className="mt-1">{explain(sel.action, sel.actor, sel.o, names)}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold">Try it: attacks, answered by the contract</h3>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <Button key={s.id} size="sm" variant={running === s.id ? 'primary' : 'secondary'} disabled={!perms.data || !!running} onClick={() => run(s)}>
                {s.title}
              </Button>
            ))}
          </div>
          <div className="mt-3 min-h-40 rounded-xl bg-[#15130f] p-3 font-mono text-[11.5px] leading-relaxed text-[#e9e3d6]">
            {log.length === 0 ? (
              <span className="text-[#8a8375]">Pick an attack. Each step is a real call simulated against Sepolia.</span>
            ) : (
              log.map((l, i) => (
                <div key={i} className={l.tone === 'call' ? 'text-[#b9b2a4]' : l.tone === 'refused' ? 'text-[#7fd1a0]' : l.tone === 'power' ? 'text-[#f0b860]' : 'text-[#7fd1a0]'}>
                  {l.text}
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-bold">The role bitmaps behind it</h3>
          {bitmaps.data ? <RoleBitmap items={bitmaps.data} /> : <Skeleton className="h-40" />}
        </div>
      </div>
    </Card>
  )
}
