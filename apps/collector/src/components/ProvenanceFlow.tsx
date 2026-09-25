// Chain of custody as a flow: grader → first holder → … → current holder. Each edge is a
// transfer (declared price, time, tx). Built with React Flow; read-only.

import { Link } from 'react-router'
import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import type { TitleDetail } from '@nafuda/ui/api.ts'
import { Avatar } from '@nafuda/ui/components.tsx'
import { jpy, scan, short, timeAgo, who } from '@nafuda/ui/format.ts'

type HolderData = { address: string; since: string; current: boolean; index: number }
type GraderData = { label: string; time: string }

function GraderNode({ data }: NodeProps<Node<GraderData>>) {
  const g = graderByLabel(data.label)
  return (
    <div className="w-40 rounded-2xl border-2 bg-card px-3 py-2 text-center shadow-sm" style={{ borderColor: g?.color }}>
      <div className="text-[10px] font-bold tracking-wide text-muted uppercase">Issued by</div>
      <div className="font-bold" style={{ color: g?.color }}>
        {g?.short}
      </div>
      <div className="text-[11px] text-muted">{timeAgo(data.time)}</div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
    </div>
  )
}

function HolderNode({ data }: NodeProps<Node<HolderData>>) {
  return (
    <Link
      to={`/collector/${data.address}`}
      className={`block w-40 rounded-2xl border-2 bg-card px-3 py-2 text-center no-underline shadow-sm ${data.current ? 'border-accent' : 'border-line'}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0" />
      <div className="flex items-center justify-center gap-1.5">
        <Avatar address={data.address} size={20} />
        <span className="font-bold">{who(data.address)}</span>
      </div>
      <div className="font-mono text-[10px] text-faint">{short(data.address)}</div>
      <div className={`mt-0.5 text-[11px] font-semibold ${data.current ? 'text-accent' : 'text-muted'}`}>{data.current ? 'Current holder' : `Holder #${data.index}`}</div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
    </Link>
  )
}

const nodeTypes = { grader: GraderNode, holder: HolderNode }

export function ProvenanceFlow({ title }: { title: TitleDetail }) {
  const holders = [{ address: title.history[0]?.from ?? title.holder, time: title.issuedAt }, ...title.history.map((t) => ({ address: t.to, time: t.time }))]
  // The first holder is whoever the title was issued to: the `from` of the first transfer, or the holder if never transferred.
  const X = 210
  const nodes: Node[] = [
    { id: 'grader', type: 'grader', position: { x: 0, y: 0 }, data: { label: title.grader, time: title.issuedAt }, draggable: false },
    ...holders.map((h, i) => ({
      id: `h${i}`,
      type: 'holder',
      position: { x: X * (i + 1), y: i % 2 === 0 ? 0 : 36 },
      data: { address: h.address, since: h.time, current: i === holders.length - 1, index: i + 1 },
      draggable: false,
    })),
  ]
  const edges: Edge[] = [
    { id: 'e-issue', source: 'grader', target: 'h0', label: 'issue', animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 }, labelStyle: { fontSize: 11 } },
    ...title.history.map((t, i) => ({
      id: `e${i}`,
      source: `h${i}`,
      target: `h${i + 1}`,
      animated: i === title.history.length - 1,
      label: `${t.priceJpy ? jpy(t.priceJpy) : 'no price'} · ${timeAgo(t.time)}`,
      style: { stroke: 'var(--ink)', strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fill: 'var(--ink)' },
      labelBgStyle: { fill: 'var(--card)' },
      data: { tx: t.tx },
    })),
  ]
  const width = X * (holders.length + 1)
  return (
    <div className="rounded-2xl border border-line bg-raised">
      <div className="h-44 overflow-x-auto">
        <div style={{ width: Math.max(width, 600), height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            onEdgeClick={(_, e) => {
              const tx = (e.data as { tx?: string } | undefined)?.tx
              if (tx) window.open(scan('tx', tx), '_blank', 'noreferrer')
            }}
          >
            <Background gap={16} size={1} color="var(--line)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
