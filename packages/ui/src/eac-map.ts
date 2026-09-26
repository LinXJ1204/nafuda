// Live data for the access-control map (core/eac-map.ts): every role holding that matters, read
// from the registries.

import { useQuery } from '@tanstack/react-query'
import { labelhash, type Address } from 'viem'
import { registryAbi } from '@nafuda/core/abis.ts'
import { COLLECTORS, ETH_REGISTRY, GRADERS, NAFUDA_REGISTRY, ROOT_LABEL } from '@nafuda/core/deployment.ts'
import type { MapNode } from '@nafuda/core/eac-map.ts'
import { api, type Title } from './api.ts'
import { publicClient } from './ens.ts'

const roles = (address: Address, id: bigint, account: Address) =>
  publicClient.readContract({ address, abi: registryAbi, functionName: 'roles', args: [id, account] }) as Promise<bigint>

export async function readEacMap(): Promise<MapNode[]> {
  const rootId = BigInt(labelhash(ROOT_LABEL))
  const operator = (await publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: 'getOwner', args: [rootId] })) as Address
  const aiko = COLLECTORS.find((c) => c.name === 'aiko')!
  const [ethRoles, rootRoles, aikoRoles] = await Promise.all([
    roles(ETH_REGISTRY, rootId, operator),
    roles(NAFUDA_REGISTRY, 0n, operator),
    roles(NAFUDA_REGISTRY, BigInt(labelhash('aiko')), aiko.address),
  ])
  const perGrader = await Promise.all(
    GRADERS.map(async (g) => {
      const sample = (await api<{ items: Title[] }>(`/titles?grader=${g.label}&sort=traded&limit=1`).catch(() => ({ items: [] as Title[] }))).items[0]
      const [nameRoles, graderRoot, controllerRoot, holderRoles] = await Promise.all([
        roles(NAFUDA_REGISTRY, BigInt(labelhash(g.label)), g.grader),
        roles(g.registry, 0n, g.grader),
        roles(g.registry, 0n, g.controller),
        sample ? roles(g.registry, BigInt(labelhash(sample.cert)), sample.holder as Address) : Promise.resolve(0n),
      ])
      const nodes: MapNode[] = [
        { id: `${g.label}-name`, title: g.ensName, subtitle: 'grader name (nafudaRegistry token)', kind: 'grader-name', holdings: [{ who: `${g.short} (grader)`, bitmap: nameRoles }] },
        {
          id: `${g.label}-root`,
          title: `${g.short} registry`,
          subtitle: 'root of the grader registry',
          kind: 'grader-registry',
          holdings: [
            { who: `${g.short} (grader)`, bitmap: graderRoot },
            { who: `controller v${g.controllerVersion}`, bitmap: controllerRoot },
          ],
        },
      ]
      if (sample) nodes.push({ id: `${g.label}-title`, title: `${sample.cert}.${g.label}`, subtitle: 'a title (most traded)', kind: 'title', holdings: [{ who: 'holder', bitmap: holderRoles }] })
      return nodes
    }),
  )
  return [
    { id: 'eth', title: `${ROOT_LABEL}.eth`, subtitle: 'ETHRegistry token', kind: 'root-name', holdings: [{ who: 'operator', bitmap: ethRoles }] },
    { id: 'root', title: 'nafuda.eth registry', subtitle: 'root of nafudaRegistry', kind: 'registry-root', holdings: [{ who: 'operator', bitmap: rootRoles }] },
    ...perGrader.flat(),
    { id: 'aiko', title: 'aiko.nafuda.eth', subtitle: "a collector's identity name", kind: 'identity', holdings: [{ who: 'aiko', bitmap: aikoRoles }] },
  ]
}

export const useEacMap = () => useQuery({ queryKey: ['eac-map'], queryFn: readEacMap, staleTime: 60_000 })
