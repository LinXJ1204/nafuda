// The access-control map, live: every resource titles depend on, who holds what on it, colored by
// what that means for issued titles. Toggle to see what the final lock changes (projected).

import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { GRADERS } from '@nafuda/core/deployment.ts'
import { describe, projectLock, riskOf, type MapNode, type Risk } from '@nafuda/core/eac-map.ts'
import { Button, Card, Skeleton } from '@nafuda/ui/components.tsx'
import { useEacMap } from '@nafuda/ui/eac-map.ts'

const STYLE: Record<Risk, { border: string; badge: string; text: string }> = {
  power: { border: 'var(--bad)', badge: 'bg-bad/15 text-bad', text: 'can still change the tree' },
  fixed: { border: 'var(--ok)', badge: 'bg-ok/15 text-ok', text: 'fixed' },
  owner: { border: 'var(--ai)', badge: 'bg-ai/15 text-ai', text: "owner's own name" },
}

function MapCard({ data }: NodeProps<Node<{ n: MapNode; risk: Risk }>>) {
  const s = STYLE[data.risk]
  return (
    <div className="w-[270px] rounded-2xl border-2 bg-card px-3 py-2 text-left shadow-sm" style={{ borderColor: s.border }}>
      <Handle type="target" position={Position.Top} className="!border-0 !bg-transparent" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-bold break-all">{data.n.title}</div>
          <div className="text-[10px] text-muted">{data.n.subtitle}</div>
        </div>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s.badge}`}>{s.text}</span>
      </div>
      <div className="mt-1.5 grid gap-0.5">
        {data.n.holdings.map((h) => (
          <div key={h.who} className="text-[10px] leading-snug">
            <span className="font-semibold">{h.who}:</span> <span className="font-mono text-muted">{describe(h.bitmap)}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-0 !bg-transparent" />
    </div>
  )
}

export function AccessMap() {
  const live = useEacMap()
  const [after, setAfter] = useState(false)
  if (!live.data) return <Skeleton className="h-[640px]" />
  const projected = projectLock(live.data)
  // Once the lock is on chain, projecting it changes nothing: no toggle, just the live map.
  const lockApplied = live.data.every((n, i) => riskOf(n) === riskOf(projected[i]))
  const nodesData = after && !lockApplied ? projected : live.data
  const W = 310
  const x0 = ((GRADERS.length - 1) * W) / 2
  const pos: Record<string, { x: number; y: number }> = { eth: { x: x0, y: 0 }, root: { x: x0, y: 150 }, aiko: { x: x0 + (GRADERS.length / 2 + 0.6) * W, y: 150 } }
  GRADERS.forEach((g, i) => {
    pos[`${g.label}-name`] = { x: i * W, y: 320 }
    pos[`${g.label}-root`] = { x: i * W, y: 470 }
    pos[`${g.label}-title`] = { x: i * W, y: 640 }
  })
  const nodes: Node[] = nodesData.map((n) => ({ id: n.id, type: 'card', position: pos[n.id] ?? { x: 0, y: 0 }, data: { n, risk: riskOf(n) }, draggable: false }))
  const edges: Edge[] = [
    { id: 'e1', source: 'eth', target: 'root' },
    { id: 'e2', source: 'root', target: 'aiko', style: { strokeDasharray: '4 4' } },
    ...GRADERS.flatMap((g) => [
      { id: `a-${g.label}`, source: 'root', target: `${g.label}-name`, style: { stroke: g.color, strokeWidth: 2 } },
      { id: `b-${g.label}`, source: `${g.label}-name`, target: `${g.label}-root`, style: { stroke: g.color, strokeWidth: 2 } },
      { id: `c-${g.label}`, source: `${g.label}-root`, target: `${g.label}-title`, style: { stroke: g.color, strokeWidth: 2 }, animated: true },
    ]),
  ]
  const counts = nodesData.reduce((acc, n) => ({ ...acc, [riskOf(n)]: (acc[riskOf(n)] ?? 0) + 1 }), {} as Record<Risk, number>)
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-lg font-bold">Access-control map</h2>
          <p className="text-xs text-muted">
            {lockApplied
              ? 'Live: every role below was read from the registries just now. The final lock is on chain, so what is left here is fixed for good.'
              : after
                ? 'Projected: today’s live roles with the final lock’s revocations applied. Not on chain until the lock runs.'
                : 'Live: every role below was read from the registries just now.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            <span className="font-bold text-bad">{counts.power ?? 0}</span> with powers left · <span className="font-bold text-ok">{counts.fixed ?? 0}</span> fixed
          </span>
          {!lockApplied && (
            <>
              <Button size="sm" variant={after ? 'secondary' : 'primary'} onClick={() => setAfter(false)}>
                Today (live)
              </Button>
              <Button size="sm" variant={after ? 'primary' : 'secondary'} onClick={() => setAfter(true)}>
                After the final lock
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="h-[760px]">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ card: MapCard }} fitView proOptions={{ hideAttribution: true }} nodesConnectable={false} nodesDraggable={false}>
          <Background gap={20} size={1} color="var(--line)" />
        </ReactFlow>
      </div>
    </Card>
  )
}
