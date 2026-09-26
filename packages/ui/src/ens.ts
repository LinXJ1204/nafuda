// Reading titles exactly like any ENS client: viem + the ENSv2 Universal Resolver. Also the
// resolution path (which registry answers each label, where the resolver is found), for the
// title page's diagram. Browser-side, public RPC: no Nafuda server involved.

import { createPublicClient, fallback, getAddress, http, parseAbi, toHex, zeroAddress, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { normalize, packetToBytes } from 'viem/ens'
import { registryAbi } from '@nafuda/core/abis.ts'
import { UNIVERSAL_RESOLVER, titleName } from '@nafuda/core/deployment.ts'

// Public RPCs (CORS-enabled, checked to resolve titles through the Universal Resolver). A rate
// limit or outage on one moves the request to the next; a contract revert is final and does not.
const RPCS = [
  import.meta.env?.VITE_SEPOLIA_RPC_URL as string | undefined,
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://1rpc.io/sepolia',
  'https://sepolia.gateway.tenderly.co',
].filter((u): u is string => !!u)
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback(RPCS.map((u) => http(u, { retryCount: 1 }))),
  batch: { multicall: true },
})

export const UNIVERSAL_HELPER: Address = getAddress('0x33f571aa8a160a21b877cf6e0fb8806692b97df5')

export type ResolvedTitle = {
  name: string
  status: 'ISSUED' | 'NONE'
  holder: Address | null
  chip: Address | null
  card: string | null
  grade: string | null
  issuedAt: Date | null
  grader: string | null
  attributes: Record<string, string>
}

export async function resolveTitle(grader: string, cert: string): Promise<ResolvedTitle> {
  const name = normalize(titleName(grader, cert))
  const opts = { name, universalResolverAddress: UNIVERSAL_RESOLVER }
  const text = (key: string) => publicClient.getEnsText({ ...opts, key }).catch(() => null)
  const [holder, status, chip, card, grade, issuedAt, graderName, attributeKeys] = await Promise.all([
    publicClient.getEnsAddress(opts),
    text('title.status'),
    text('slab.chip'),
    text('card'),
    text('grade'),
    text('issued_at'),
    text('grader'),
    text('attributes'),
  ])
  const keys = attributeKeys ? attributeKeys.split(',').filter(Boolean) : []
  const values = await Promise.all(keys.map((k) => text(k)))
  return {
    name,
    status: status === 'ISSUED' ? 'ISSUED' : 'NONE',
    holder: holder ?? null,
    chip: (chip as Address | null) ?? null,
    card,
    grade,
    issuedAt: issuedAt ? new Date(Number(issuedAt) * 1000) : null,
    grader: graderName,
    attributes: Object.fromEntries(keys.map((k, i) => [k, values[i] ?? ''])),
  }
}

const helperAbi = parseAbi(['function findRegistries(bytes name) view returns (address[])'])
const urAbi = parseAbi(['function findResolver(bytes name) view returns (address resolver, bytes32 node, uint256 offset)'])

export type PathStep = {
  label: string // "12345678", "psa-sim", "nafuda", "eth", "" (root)
  name: string // the full name at this level
  registry: Address | null // the registry *of* this name (its subregistry)
  resolver: Address | null // resolver set on this label in its parent registry
  answers: boolean // the Universal Resolver's resolver is found at this level
}

/// The chain of registries from the root down to the title, and where the resolver is found.
export async function resolutionPath(grader: string, cert: string): Promise<PathStep[]> {
  const name = titleName(grader, cert)
  const dns = toHex(packetToBytes(name))
  const [registries, found] = await Promise.all([
    publicClient.readContract({ address: UNIVERSAL_HELPER, abi: helperAbi, functionName: 'findRegistries', args: [dns] }),
    publicClient.readContract({ address: UNIVERSAL_RESOLVER, abi: urAbi, functionName: 'findResolver', args: [dns] }),
  ])
  const labels = [...name.split('.'), '']
  // offset → label index: walk DNS label lengths
  const bytes = packetToBytes(name)
  let offset = 0
  let answerIndex = -1
  for (let i = 0; i < labels.length; i++) {
    if (offset === Number(found[2])) answerIndex = i
    offset += bytes[offset] + 1
  }
  const steps = await Promise.all(
    labels.map(async (label, i): Promise<PathStep> => {
      const parent = registries[i + 1]
      const resolver =
        label && parent && parent !== zeroAddress
          ? await publicClient.readContract({ address: parent, abi: registryAbi, functionName: 'getResolver', args: [label] }).catch(() => zeroAddress)
          : zeroAddress
      return {
        label,
        name: labels.slice(i).filter(Boolean).join('.') || '(root)',
        registry: registries[i] && registries[i] !== zeroAddress ? registries[i] : null,
        resolver: resolver !== zeroAddress ? resolver : null,
        answers: i === answerIndex,
      }
    }),
  )
  return steps
}

/// Primary name of an address, via the ENSv2 Universal Resolver (reverse + forward check).
export async function lookupName(address: Address): Promise<string | null> {
  try {
    return await publicClient.getEnsName({ address, universalResolverAddress: UNIVERSAL_RESOLVER })
  } catch {
    return null
  }
}
