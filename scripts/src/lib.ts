// Shared helpers for the deploy / issue / verify / transfer scripts.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { Abi, Address, Hash, Hex, PublicClient } from 'viem'
import { labelhash, toHex } from 'viem'
import { packetToBytes } from 'viem/ens'
import { beta } from './addresses.ts'
import type { Config, Network, Role } from './config.ts'

////////////////////////////////////////////////////////////////////////
// Names
////////////////////////////////////////////////////////////////////////

export const GRADER_LABEL = 'psa-sim'
export const GRADER_NAME = 'PSA-Sim (simulated grader modeled after PSA; not affiliated with PSA)'

/// 10 years; MockUSDC is free to mint, so the long duration costs nothing.
export const ROOT_NAME_DURATION = 10n * 365n * 24n * 60n * 60n

export const MAX_UINT64 = 2n ** 64n - 1n

/// DNS-encoded name as hex, the form ENSv2 contracts take (`bytes name`).
export const dns = (name: string): Hex => toHex(packetToBytes(name))

////////////////////////////////////////////////////////////////////////
// Roles (mirror of RegistryRolesLib / EACBaseRolesLib in the pinned Beta source)
////////////////////////////////////////////////////////////////////////

const admin = (role: bigint) => role << 128n

export const ROLE = {
  REGISTRAR: 1n << 0n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER_ADMIN: admin(1n << 28n),
  CAN_NAME: 1n << 120n,
  UPGRADE: 1n << 124n,
  admin,
}

/// `0x1111…1`: every role and every admin role.
export const ALL_ROLES = BigInt('0x' + '1'.repeat(64))

/// The grader's `psa-sim` token in nafudaRegistry before the final lock (P7-4 revokes these).
export const GRADER_NAME_TOKEN_ROLES =
  ROLE.SET_SUBREGISTRY | admin(ROLE.SET_SUBREGISTRY) | ROLE.SET_RESOLVER | admin(ROLE.SET_RESOLVER)

/// What the grader keeps on psaRegistry's root: swap the issuer, set the parent, name the
/// contract. Everything else is revoked, including ROLE_REGISTRAR (otherwise the grader could
/// bypass the controller). Pinned by test_setup_graderKeepsOnlyNonDangerousRootRoles.
export const GRADER_FINAL_ROOT_ROLES =
  admin(ROLE.REGISTRAR) | ROLE.SET_PARENT | admin(ROLE.SET_PARENT) | ROLE.CAN_NAME | admin(ROLE.CAN_NAME)

////////////////////////////////////////////////////////////////////////
// Artifacts and demo data
////////////////////////////////////////////////////////////////////////

const REPO = new URL('../../', import.meta.url)

export function titleControllerArtifact(): { abi: Abi; bytecode: Hex } {
  const path = new URL('contracts/out/TitleController.sol/TitleController.json', REPO)
  if (!existsSync(path)) throw new Error('TitleController artifact missing: run `forge build` in contracts/')
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return { abi: json.abi as Abi, bytecode: json.bytecode.object as Hex }
}

export type DemoSlab = {
  card: string
  grade: string
  genuine: { privateKey: Hex; address: Address }
  clone: { privateKey: Hex; address: Address }
}

export function demoSlabs(): Record<string, DemoSlab> {
  return JSON.parse(readFileSync(new URL('demo/slabs.json', REPO), 'utf8')).slabs
}

////////////////////////////////////////////////////////////////////////
// Deployment state: deployments/<network>.json (sepolia is committed, fork is not)
////////////////////////////////////////////////////////////////////////

export type DeploymentState = {
  network: Network
  nameLabel: string
  nafudaRegistry?: Address
  psaRegistry?: Address
  titleController?: Address
  txs: Record<string, Hash>
}

const DEPLOYMENTS = new URL('deployments/', REPO)
const statePath = (network: Network) => new URL(`${network}.json`, DEPLOYMENTS)

export function loadState(network: Network, nameLabel: string): DeploymentState {
  const path = statePath(network)
  if (!existsSync(path)) return { network, nameLabel, txs: {} }
  const state = JSON.parse(readFileSync(path, 'utf8')) as DeploymentState
  if (state.nameLabel !== nameLabel) {
    throw new Error(`deployments/${network}.json is for "${state.nameLabel}", not "${nameLabel}"`)
  }
  return state
}

export function saveState(state: DeploymentState) {
  mkdirSync(DEPLOYMENTS, { recursive: true })
  writeFileSync(statePath(state.network), JSON.stringify(state, null, 2) + '\n')
}

/// The commit-reveal secret lives in its own gitignored file and is deleted after registering.
export type CommitSecret = { secret: Hex; commitment: Hex; committedAt: number }
const secretPath = (network: Network) => new URL(`.secret-${network}.json`, DEPLOYMENTS)

export const loadSecret = (network: Network): CommitSecret | undefined =>
  existsSync(secretPath(network)) ? JSON.parse(readFileSync(secretPath(network), 'utf8')) : undefined

export function saveSecret(network: Network, secret: CommitSecret) {
  mkdirSync(DEPLOYMENTS, { recursive: true })
  writeFileSync(secretPath(network), JSON.stringify(secret, null, 2) + '\n', { mode: 0o600 })
}

export const deleteSecret = (network: Network) => rmSync(secretPath(network), { force: true })

////////////////////////////////////////////////////////////////////////
// Transactions
////////////////////////////////////////////////////////////////////////

/// Wait for `hash`, throw if it reverted, and log it. Returns the receipt.
export async function confirm(client: PublicClient, label: string, hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`)
  console.log(`  ✓ ${label.padEnd(48)} ${hash}  gas ${receipt.gasUsed}`)
  return receipt
}

export const skip = (label: string, why: string) => console.log(`  = ${label.padEnd(48)} ${why}`)

export const sameAddress = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/// Transfer a title from one demo account to another (ERC-1155 safeTransferFrom).
export async function transferTitle(cfg: Config, psaRegistry: Address, from: Role, to: Role, cert: string) {
  const registry = { address: psaRegistry, abi: beta('UserRegistryImpl').abi }
  const tokenId = (await cfg.publicClient.readContract({
    ...registry,
    functionName: 'getTokenId',
    args: [BigInt(labelhash(cert))],
  })) as bigint
  const hash = await cfg.wallet(from).writeContract({
    ...registry,
    functionName: 'safeTransferFrom',
    args: [cfg.accounts[from].address, cfg.accounts[to].address, tokenId, 1n, '0x'],
  })
  return confirm(cfg.publicClient, `transfer ${cert} ${from} → ${to}`, hash)
}
