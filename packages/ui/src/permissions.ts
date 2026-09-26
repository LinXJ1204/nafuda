// Ask the contracts who can do what: simulate each call from each actor's address (eth_call with
// `from`; no gas, no key, nothing changes) and decode the revert. Rules: core/permissions.ts.

import { useQuery } from '@tanstack/react-query'
import { BaseError, ContractFunctionRevertedError, labelhash, type Address } from 'viem'
import { eacAbi, registryAbi } from '@nafuda/core/abis.ts'
import { COLLECTORS, ETH_REGISTRY, NAFUDA_REGISTRY, ROOT_LABEL, USER_REGISTRY_IMPL, graderByLabel } from '@nafuda/core/deployment.ts'
import { ACTIONS, ACTORS, callFor, type ActionId, type Actor, type Ctx, type Outcome } from '@nafuda/core/permissions.ts'
import { publicClient } from './ens.ts'

export async function permissionContext(grader: string, cert: string, holder: Address): Promise<Ctx> {
  const g = graderByLabel(grader)!
  const [operator, tokenId] = await Promise.all([
    publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: 'getOwner', args: [BigInt(labelhash(ROOT_LABEL))] }),
    publicClient.readContract({ address: g.registry, abi: registryAbi, functionName: 'getTokenId', args: [BigInt(labelhash(cert))] }),
  ])
  const stranger = COLLECTORS.find((c) => c.name === 'mallory')!.address
  return {
    graderRegistry: g.registry,
    nafudaRegistry: NAFUDA_REGISTRY,
    userRegistryImpl: USER_REGISTRY_IMPL,
    tokenId: tokenId as bigint,
    graderNameId: BigInt(labelhash(grader)),
    addresses: { holder, grader: g.grader, operator: operator as Address, stranger },
  }
}

export async function simulate(action: ActionId, actor: Actor, ctx: Ctx): Promise<Outcome> {
  const call = callFor(action, actor, ctx)
  try {
    await publicClient.simulateContract({ ...call, abi: eacAbi, account: ctx.addresses[actor] } as never)
    return { allowed: true, error: null, args: [] }
  } catch (e) {
    const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
    if (revert instanceof ContractFunctionRevertedError) return { allowed: false, error: revert.data?.errorName ?? revert.reason ?? null, args: revert.data?.args ?? [] }
    return { allowed: false, error: (e as Error).message.split('\n')[0], args: [] }
  }
}

export type Matrix = Record<Actor, Record<ActionId, Outcome>>

export async function permissionMatrix(ctx: Ctx): Promise<Matrix> {
  const entries = await Promise.all(
    ACTORS.map(async (a) => [a.id, Object.fromEntries(await Promise.all(ACTIONS.map(async (x) => [x.id, await simulate(x.id, a.id, ctx)])))] as const),
  )
  return Object.fromEntries(entries) as Matrix
}

export const usePermissions = (grader: string, cert: string, holder: Address | null | undefined) =>
  useQuery({
    queryKey: ['permissions', grader, cert, holder],
    enabled: !!holder,
    staleTime: 60_000,
    queryFn: async () => {
      const ctx = await permissionContext(grader, cert, holder!)
      return { ctx, matrix: await permissionMatrix(ctx) }
    },
  })

/// Role bitmaps to draw: the holder on this title, and the grader, controller and operator on the
/// roots that matter.
export const useRoleBitmaps = (grader: string, cert: string, holder: Address | null | undefined) =>
  useQuery({
    queryKey: ['bitmaps', grader, cert, holder],
    enabled: !!holder,
    staleTime: 60_000,
    queryFn: async () => {
      const g = graderByLabel(grader)!
      const operator = (await publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: 'getOwner', args: [BigInt(labelhash(ROOT_LABEL))] })) as Address
      const read = (address: Address, id: bigint, account: Address) =>
        publicClient.readContract({ address, abi: registryAbi, functionName: 'roles', args: [id, account] }) as Promise<bigint>
      const [holderTitle, graderRoot, controllerRoot, graderName, operatorRoot] = await Promise.all([
        read(g.registry, BigInt(labelhash(cert)), holder!),
        read(g.registry, 0n, g.grader),
        read(g.registry, 0n, g.controller),
        read(NAFUDA_REGISTRY, BigInt(labelhash(grader)), g.grader),
        read(NAFUDA_REGISTRY, 0n, operator),
      ])
      return [
        { key: 'holder', label: 'Holder, on this title', bitmap: holderTitle },
        { key: 'grader', label: `${g.short}, on its registry root`, bitmap: graderRoot },
        { key: 'controller', label: 'Controller, on the registry root', bitmap: controllerRoot },
        { key: 'graderName', label: `${g.short}, on ${g.ensName}`, bitmap: graderName },
        { key: 'operator', label: 'Operator, on the nafuda.eth registry root', bitmap: operatorRoot },
      ]
    },
  })
