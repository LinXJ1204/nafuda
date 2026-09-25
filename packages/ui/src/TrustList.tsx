import type { TrustCheck } from '@nafuda/core/trust-rules.ts'

export function TrustList({ checks }: { checks: TrustCheck[] }) {
  return (
    <ul className="grid gap-3">
      {checks.map((c) => {
        const tone = c.ok ? 'text-ok border-ok' : c.group === 'lock' ? 'text-warn border-warn' : 'text-bad border-bad'
        return (
          <li key={c.id} className="grid grid-cols-[28px_1fr] gap-2">
            <span className={`grid size-6 place-items-center rounded-full border-2 text-xs font-extrabold ${tone}`}>
              {c.ok ? '✓' : c.group === 'lock' ? '○' : '✗'}
            </span>
            <div>
              <strong className="text-sm">{c.title}</strong>
              <p className="mt-0.5 text-[13px] text-muted">{!c.ok && c.group === 'lock' ? `Not yet: ${c.body}` : c.body}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
