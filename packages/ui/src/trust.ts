// Live trust facts for one grader, read straight from the registries (multicall), scored by
// core/trust-rules.ts. Used by the grader pages in both apps.

import { useQuery } from '@tanstack/react-query'
import { labelhash, type Address } from 'viem'
import { registryAbi } from '@nafuda/core/abis.ts'
import { ETH_REGISTRY, NAFUDA_REGISTRY, ROOT_LABEL, graderByLabel } from '@nafuda/core/deployment.ts'
import { ROLE } from '@nafuda/core/roles.ts'
import { evaluateTrust, type TrustCheck, type TrustFacts } from '@nafuda/core/trust-rules.ts'
import { api, type Title } from './api.ts'
import { publicClient } from './ens.ts'

export type GraderTrust = { facts: TrustFacts; checks: TrustCheck[]; operator: Address }

export async function readGraderTrust(label: string): Promise<GraderTrust> {
  const g = graderByLabel(label)
  if (!g) throw new Error(`unknown grader ${label}`)
  const read = <T>(address: Address, functionName: string, args: unknown[] = []) =>
    publicClient.readContract({ address, abi: registryAbi, functionName, args } as never) as Promise<T>
  const graderNameId = BigInt(labelhash(label))
  const rootNameId = BigInt(labelhash(ROOT_LABEL))
  const [operator, titles] = await Promise.all([
    read<Address>(ETH_REGISTRY, 'getOwner', [rootNameId]),
    api<{ items: Title[] }>(`/titles?grader=${label}&limit=200`).then((r) => r.items).catch(() => [] as Title[]),
  ])
  const [psaEmancipated, controllerIsRegistrar, graderRootRoles, parent, nafudaParent, nafudaEmancipated, graderNameTokenRoles, operatorNameTokenRoles, operatorRootNameRoles, holderRoles] =
    await Promise.all([
      read<boolean>(g.registry, 'isEmancipated'),
      read<boolean>(g.registry, 'hasRootRoles', [ROLE.REGISTRAR, g.controller]),
      read<bigint>(g.registry, 'roles', [0n, g.grader]),
      read<[Address, string]>(g.registry, 'getParent'),
      read<[Address, string]>(NAFUDA_REGISTRY, 'getParent'),
      read<boolean>(NAFUDA_REGISTRY, 'isEmancipated'),
      read<bigint>(NAFUDA_REGISTRY, 'roles', [graderNameId, g.grader]),
      read<bigint>(NAFUDA_REGISTRY, 'roles', [graderNameId, operator]),
      read<bigint>(ETH_REGISTRY, 'roles', [rootNameId, operator]),
      // The index only says which titles exist. Each holder is read from the registry, so a
      // transfer the indexer has not caught up with yet is not mistaken for a missing role.
      Promise.all(
        titles.map(async (t) => {
          const id = BigInt(labelhash(t.cert))
          const holder = await read<Address>(g.registry, 'getOwner', [id])
          return { cert: t.cert, roles: await read<bigint>(g.registry, 'roles', [id, holder]) }
        }),
      ),
    ])
  const facts: TrustFacts = {
    psaEmancipated,
    controllerIsRegistrar,
    graderRootRoles,
    holderRoles,
    psaParent: { parent: parent[0], label: parent[1] },
    nafudaParent: { parent: nafudaParent[0], label: nafudaParent[1] },
    expected: { nafudaRegistry: NAFUDA_REGISTRY, ethRegistry: ETH_REGISTRY, graderLabel: label, nameLabel: ROOT_LABEL },
    nafudaEmancipated,
    graderNameTokenRoles,
    operatorNameTokenRoles,
    operatorRootNameRoles,
  }
  return { facts, checks: evaluateTrust(facts), operator }
}

export const useGraderTrust = (label: string) => useQuery({ queryKey: ['trust', label], queryFn: () => readGraderTrust(label), staleTime: 60_000 })
