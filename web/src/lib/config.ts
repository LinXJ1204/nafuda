// Deployment data shared with the scripts: addresses from deployments/sepolia.json and the
// simulated chips from demo/slabs.json (single source of truth for both).

import type { Address, Hex } from 'viem'
import deployment from '../../../deployments/sepolia.json' with { type: 'json' }
import demo from '../../../demo/slabs.json' with { type: 'json' }

export const ROOT_NAME = `${deployment.nameLabel}.eth`
export const GRADER_LABEL: string = demo.grader
export const GRADER_NAME = `${GRADER_LABEL}.${ROOT_NAME}`

export const PSA_REGISTRY = deployment.psaRegistry as Address
export const TITLE_CONTROLLER = deployment.titleController as Address
export const NAFUDA_REGISTRY = deployment.nafudaRegistry as Address
/// First block of the deployment: event reads (getLogs) start here.
export const START_BLOCK: number = deployment.startBlock

/// ENSv2 Beta Universal Resolver proxy. viem's built-in Sepolia default is the ENSv1 UR,
/// so every ENS call passes this explicitly.
export const UNIVERSAL_RESOLVER: Address = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'

/// Public RPC by default so no API key ends up in the bundle. Override with VITE_SEPOLIA_RPC_URL.
export const SEPOLIA_RPC_URL: string =
  (import.meta.env?.VITE_SEPOLIA_RPC_URL as string | undefined) ?? 'https://ethereum-sepolia-rpc.publicnode.com'

export type DemoChip = { privateKey: Hex; address: Address }
export type DemoSlab = { card: string; grade: string; genuine: DemoChip; clone: DemoChip }
export const DEMO_SLABS = demo.slabs as Record<string, DemoSlab>

/// Demo accounts (public addresses only), used as quick picks for "who is the seller".
export const DEMO_ACCOUNTS: Record<string, Address> = {
  alice: '0x92785192Bb6a16be1Ac305ab419e0F36F0216370',
  bob: '0x3565a2f62c8283d8d7F7261f969C893C566740e2',
  mallory: '0xdc93F3229859dFA27F97608Bff83B53a1d39B477',
}
