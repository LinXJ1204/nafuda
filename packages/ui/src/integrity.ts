// Per-title EAC checks, read live from the chain (core/integrity.ts scores them).

import { useQuery } from '@tanstack/react-query'
import { labelhash, parseAbi, toHex, zeroAddress, type Address } from 'viem'
import { packetToBytes } from 'viem/ens'
import { controllerAbi, registryAbi } from '@nafuda/core/abis.ts'
import { UNIVERSAL_RESOLVER, graderByLabel, titleName } from '@nafuda/core/deployment.ts'
import { checkIntegrity, type IntegrityCheck } from '@nafuda/core/integrity.ts'
import { ALL_ROLES } from '@nafuda/core/roles.ts'
import { publicClient } from './ens.ts'

const urAbi = parseAbi(['function findResolver(bytes name) view returns (address resolver, bytes32 node, uint256 offset)'])

export async function readIntegrity(grader: string, cert: string, holder: Address | null): Promise<IntegrityCheck[]> {
  const g = graderByLabel(grader)
  if (!g) throw new Error(`unknown grader ${grader}`)
  const id = BigInt(labelhash(cert))
  const dns = toHex(packetToBytes(titleName(grader, cert)))
  const [found, controllerHolder, holderRoles, assignees, emancipated] = await Promise.all([
    publicClient.readContract({ address: UNIVERSAL_RESOLVER, abi: urAbi, functionName: 'findResolver', args: [dns] }),
    publicClient.readContract({ address: g.controller, abi: controllerAbi, functionName: 'holderOf', args: [cert] }),
    holder ? publicClient.readContract({ address: g.registry, abi: registryAbi, functionName: 'roles', args: [id, holder] }) : Promise.resolve(0n),
    publicClient.readContract({ address: g.registry, abi: registryAbi, functionName: 'getAssigneeCount', args: [id, ALL_ROLES] }),
    publicClient.readContract({ address: g.registry, abi: registryAbi, functionName: 'isEmancipated' }),
  ])
  const [resolver, , offset] = found
  return checkIntegrity({
    resolver: resolver === zeroAddress ? null : resolver,
    // the grader's name starts right after the cert label: 1 length byte + the cert
    resolverAtGraderLevel: Number(offset) === 1 + cert.length,
    controller: g.controller,
    controllerHolder: controllerHolder === zeroAddress ? null : (controllerHolder as Address),
    holder,
    holderRoles: holderRoles as bigint,
    assigneeCounts: assignees[0],
    emancipated: emancipated as boolean,
  })
}

export const useIntegrity = (grader: string, cert: string, holder: Address | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ['integrity', grader, cert, holder],
    queryFn: () => readIntegrity(grader, cert, holder ?? null),
    enabled: enabled && holder !== undefined,
    staleTime: 30_000,
  })
