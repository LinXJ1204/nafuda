// Who traded with whom: collectors as nodes (size = titles held), transfers as edges.

import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { useNavigate } from 'react-router'
import { useGraph } from '@nafuda/ui/api.ts'
import { Card, Skeleton } from '@nafuda/ui/components.tsx'
import { compactJpy, short } from '@nafuda/ui/format.ts'
import { paletteOf } from '@nafuda/core/slab.ts'

export function MarketMapPage() {
  const graph = useGraph()
  const navigate = useNavigate()
  const g = graph.data
  const n = g?.nodes.length ?? 0
  const R = Math.max(260, n * 26)
  const nodes: Node[] =
    g?.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2
      const size = 36 + Math.min(node.titles, 8) * 7
      const { hue } = paletteOf(node.id)
      return {
        id: node.id,
        position: { x: R + R * Math.cos(angle) - size / 2, y: R + R * Math.sin(angle) - size / 2 },
        data: { label: `${node.name ?? short(node.id)} · ${node.titles}` },
        style: {
          width: size,
          height: size,
          borderRadius: '9999px',
          background: `hsl(${hue} 60% 55%)`,
          color: '#fff',
          border: '2px solid var(--card)',
          fontSize: 10,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          textAlign: 'center',
        },
      }
    }) ?? []
  const edges: Edge[] =
    g?.edges.map((e) => ({
      id: `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      label: e.volumeJpy ? compactJpy(e.volumeJpy) : String(e.count),
      style: { stroke: 'var(--accent)', strokeWidth: 1 + Math.min(e.count, 5), opacity: 0.7 },
      labelStyle: { fontSize: 10, fill: 'var(--muted)' },
      labelBgStyle: { fill: 'var(--card)' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
    })) ?? []

  return (
    <>
      <h1 className="mt-8 text-3xl font-bold">Market map</h1>
      <p className="mt-1 text-sm text-muted">Collectors as circles (bigger = more titles held), transfers as arrows (thicker = more trades, label = declared volume). Click a collector to open their profile.</p>
      <Card className="mt-6 h-[640px] overflow-hidden">
        {!g ? (
          <Skeleton className="h-full" />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            onNodeClick={(_, node) => navigate(`/collector/${node.id}`)}
          >
            <Background gap={20} size={1} color="var(--line)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </Card>
    </>
  )
}
