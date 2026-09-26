// "Does this title follow the grader's rules?": per-title EAC checks, read live.

import type { IntegrityCheck } from '@nafuda/core/integrity.ts'
import { Card, Pill, Skeleton } from '@nafuda/ui/components.tsx'

export function TitleIntegrity({ checks, loading }: { checks?: IntegrityCheck[]; loading?: boolean }) {
  const ok = checks?.every((c) => c.ok)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Title integrity (Enhanced Access Control)</h2>
          <p className="mt-1 text-xs text-muted">Read live from the grader's registry and the Universal Resolver. It confirms this title was issued by the grader's rules and nobody can change it.</p>
        </div>
        {checks && <Pill tone={ok ? 'ok' : 'bad'}>{ok ? 'All checks pass' : 'Check failed'}</Pill>}
      </div>
      {loading || !checks ? (
        <Skeleton className="mt-4 h-40" />
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {checks.map((c) => (
            <li key={c.id} className="grid grid-cols-[24px_1fr] gap-2">
              <span className={`grid size-5 place-items-center rounded-full border-2 text-[10px] font-extrabold ${c.ok ? 'border-ok text-ok' : 'border-bad text-bad'}`}>{c.ok ? '✓' : '✗'}</span>
              <div>
                <strong className="text-sm">{c.title}</strong>
                <p className="text-xs text-muted">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
