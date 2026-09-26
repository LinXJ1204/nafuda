// Second witness page: Curvegrid MultiBaas indexes the same registries as Nafuda's own indexer,
// and the server publishes whether the two agree (server/src/witness.ts).

import { GRADERS } from '@nafuda/core/deployment.ts'
import { useWitness } from '@nafuda/ui/api.ts'
import { WitnessChart } from '@nafuda/ui/Charts.tsx'
import { Card } from '@nafuda/ui/components.tsx'
import { WitnessPanel } from '@nafuda/ui/Witness.tsx'

export function WitnessPage() {
  const w = useWitness().data
  return (
    <div className="max-w-5xl">
      <h1 className="mt-8 text-3xl font-bold">Second witness</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Every list, chart and feed on this site comes from Nafuda&apos;s own indexer. Don&apos;t take our server&apos;s word for it:{' '}
        <b className="text-ink">Curvegrid MultiBaas</b> indexes the same three grader registries on its own infrastructure, and this page shows, live, whether the two agree.
      </p>
      <div className="mt-6">
        <WitnessPanel />
      </div>
      {w?.configured && w.perHour.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">Seen by each index</h2>
            <WitnessChart data={w.perHour} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">By grader</h2>
            <ul className="space-y-3">
              {GRADERS.map((g) => {
                const s = w.byGrader[g.label] ?? { witnessed: 0, agreed: 0 }
                const pct = s.witnessed ? Math.round((s.agreed / s.witnessed) * 100) : 0
                return (
                  <li key={g.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="size-2 rounded-full" style={{ background: g.color }} />
                        {g.short}
                      </span>
                      <span className="text-muted tabular-nums">
                        {s.agreed}/{s.witnessed} agree
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised">
                      <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-xs text-muted">Events still being indexed on our side count as not yet agreeing, for a few seconds after each block.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
