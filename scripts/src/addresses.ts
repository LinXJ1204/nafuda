// ENSv2 Sepolia Beta addresses and ABIs.
//
// Read straight from the official deployment records inside the contracts-v2
// submodule (pinned at the Beta deploy commit 71a3b733), so there is a single
// source of truth and no hand-copied addresses or ABIs.

import { readFileSync } from 'node:fs'
import type { Abi, Address } from 'viem'

const DEPLOYMENTS_DIR = new URL('../../contracts/lib/contracts-v2/contracts/deployments/sepolia/', import.meta.url)

export const BETA_CONTRACTS = [
  'RootRegistry',
  'ETHRegistry',
  'ETHRegistrar',
  'MockUSDC',
  'VerifiableFactory',
  'UserRegistryImpl',
  'UniversalHelper',
  'LabelStore',
  'UpgradableUniversalResolverProxy',
] as const

export type BetaContract = (typeof BETA_CONTRACTS)[number]

export type Deployment = { address: Address; abi: Abi }

const cache = new Map<BetaContract, Deployment>()

export function beta(name: BetaContract): Deployment {
  let d = cache.get(name)
  if (!d) {
    const json = JSON.parse(readFileSync(new URL(`${name}.json`, DEPLOYMENTS_DIR), 'utf8'))
    d = { address: json.address as Address, abi: json.abi as Abi }
    cache.set(name, d)
  }
  return d
}

/// The Universal Resolver proxy that viem must be pointed at explicitly:
/// viem's built-in sepolia default is the ENSv1 UR.
export const UNIVERSAL_RESOLVER = (): Address => beta('UpgradableUniversalResolverProxy').address

export const SEPOLIA_CHAIN_ID = 11155111
