import { Link } from 'react-router'
import { useGraders } from '@nafuda/ui/api.ts'
import { Skeleton } from '@nafuda/ui/components.tsx'
import { SlabArt } from '@nafuda/ui/SlabArt.tsx'

export function GraderCards() {
  const graders = useGraders()
  if (!graders.data) return <Skeleton className="h-48" />
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {graders.data.map((g) => (
        <Link key={g.label} to={`/graders/${g.label}`} className="group flex gap-4 rounded-2xl border border-line bg-card p-4 no-underline transition hover:border-accent">
          <div className="w-24 shrink-0">
            <SlabArt grader={g.label} cert={String(10 ** (g.certDigits - 1) + 7)} card={`${g.short} Sample - Label #000 (demo card)`} grade={g.scale[0]} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: g.color }} />
              <strong className="text-lg">{g.short}</strong>
            </div>
            <div className="font-mono text-xs text-muted">{g.ensName}</div>
            <p className="mt-2 text-xs text-muted">Modeled after {g.modeledAfter}. Simulated; not affiliated.</p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>
                <strong className="tabular-nums">{g.titles}</strong> <span className="text-muted">titles</span>
              </span>
              <span>
                <strong className="tabular-nums">{g.holders}</strong> <span className="text-muted">holders</span>
              </span>
              <span>
                <strong className="tabular-nums">{g.transfers}</strong> <span className="text-muted">trades</span>
              </span>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-ok">✓ emancipated registry · controller v{g.controllerVersion}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function GradersPage() {
  return (
    <>
      <h1 className="mt-8 text-3xl font-bold">Graders</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Each grader has its own name under <span className="font-mono">nafuda.eth</span>, its own registry of titles, and its own issuing contract. A new grader
        joins without anyone else's contract changing, and brings its own record schema: BGS-Sim adds four subgrades as extra ENS text records.
      </p>
      <div className="mt-6">
        <GraderCards />
      </div>
    </>
  )
}
