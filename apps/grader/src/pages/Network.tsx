// The name tree every grader lives in: .eth → nafuda.eth → <grader>.nafuda.eth → <cert> titles.
// Each grader has its own registry and its own resolver; none can touch another's titles.

import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { ETH_REGISTRY, GRADERS, NAFUDA_REGISTRY } from '@nafuda/core/deployment.ts'
import { useQuery } from '@tanstack/react-query'
import { registryAbi } from '@nafuda/core/abis.ts'
import { useGraders } from '@nafuda/ui/api.ts'
import { publicClient } from '@nafuda/ui/ens.ts'
import { Card } from '@nafuda/ui/components.tsx'
import { short } from '@nafuda/ui/format.ts'

type Data = { title: string; lines: string[]; color?: string; badge?: string }

function TreeNode({ data }: NodeProps<Node<Data>>) {
  return (
    <div className="w-52 rounded-2xl border-2 bg-card px-3 py-2 shadow-sm" style={{ borderColor: data.color ?? 'var(--line)' }}>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <div className="font-mono text-sm font-bold" style={{ color: data.color }}>
        {data.title}
      </div>
      {data.lines.map((l) => (
        <div key={l} className="font-mono text-[10px] text-muted">
          {l}
        </div>
      ))}
      {data.badge && <div className="mt-1 text-[10px] font-bold text-ok">{data.badge}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  )
}

export function NetworkPage() {
  const graders = useGraders()
  const emancipated = useQuery({
    queryKey: ['emancipated'],
    queryFn: async () =>
      new Map(
        await Promise.all(
          GRADERS.map(async (g) => [g.label, await publicClient.readContract({ address: g.registry, abi: registryAbi, functionName: 'isEmancipated' })] as const),
        ),
      ),
  })
  const count = new Map(graders.data?.map((g) => [g.label, g.titles]))
  const W = 260
  const x0 = ((GRADERS.length - 1) * W) / 2
  const nodes: Node<Data>[] = [
    { id: 'eth', type: 'tree', position: { x: x0, y: 0 }, data: { title: 'eth', lines: [`ETHRegistry ${short(ETH_REGISTRY)}`] } },
    { id: 'nafuda', type: 'tree', position: { x: x0, y: 120 }, data: { title: 'nafuda.eth', lines: [`registry ${short(NAFUDA_REGISTRY)}`, 'owner: operator'] } },
    ...GRADERS.flatMap((g, i) => [
      {
        id: g.label,
        type: 'tree',
        position: { x: i * W, y: 260 },
        data: { title: g.ensName, color: g.color, lines: [`registry ${short(g.registry)}`, `resolver ${short(g.controller)} (v${g.controllerVersion})`], badge: emancipated.data ? (emancipated.data.get(g.label) ? '✓ emancipated (read live)' : '✗ not emancipated') : 'checking…' },
      },
      {
        id: `${g.label}-titles`,
        type: 'tree',
        position: { x: i * W, y: 410 },
        data: { title: `<cert>.${g.label}`, color: g.color, lines: [`${count.get(g.label) ?? '…'} titles`, 'holder: transfer only', 'records via wildcard'] },
      },
    ]),
  ]
  const edges: Edge[] = [
    { id: 'e1', source: 'eth', target: 'nafuda', style: { stroke: 'var(--ink)' } },
    ...GRADERS.flatMap((g) => [
      { id: `e-${g.label}`, source: 'nafuda', target: g.label, style: { stroke: g.color, strokeWidth: 2 } },
      { id: `t-${g.label}`, source: g.label, target: `${g.label}-titles`, animated: true, style: { stroke: g.color, strokeWidth: 2 } },
    ]),
  ]
  return (
    <>
      <h1 className="mt-8 text-3xl font-bold">The name tree</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Every grader is a name under nafuda.eth with its own registry of titles and its own resolver. Adding a grader touches nobody else's contracts, and
        each grader's registry is emancipated, so no grader can reach into another's titles, or back into its own.
      </p>
      <Card className="mt-6 h-[560px] overflow-hidden">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ tree: TreeNode }} fitView proOptions={{ hideAttribution: true }} nodesConnectable={false} nodesDraggable={false}>
          <Background gap={20} size={1} color="var(--line)" />
        </ReactFlow>
      </Card>
    </>
  )
}
