// Shared runtime config: network selection, clients, and the five demo accounts.
//
// Usage from any script: `const cfg = loadConfig(networkFromArgs())`.
// Networks:
//   sepolia  real Sepolia via SEPOLIA_RPC_URL
//   fork     an `anvil --fork-url $SEPOLIA_RPC_URL` node at FORK_RPC_URL (default http://127.0.0.1:8545)

import { createPublicClient, createWalletClient, http, parseEther, type Hex, type PrivateKeyAccount } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

export type Network = 'sepolia' | 'fork'

export const ROLES = ['operator', 'grader', 'alice', 'bob', 'mallory'] as const
export type Role = (typeof ROLES)[number]

/// Minimum balance each account needs for the full deploy + demo; `fund.ts` tops up to this.
export const MIN_BALANCE: Record<Role, bigint> = {
  operator: parseEther('0.05'),
  grader: parseEther('0.05'),
  alice: parseEther('0.01'),
  bob: parseEther('0.01'),
  mallory: 0n,
}

export function networkFromArgs(argv: string[] = process.argv): Network {
  const i = argv.indexOf('--network')
  const value = i >= 0 ? argv[i + 1] : 'sepolia'
  if (value !== 'sepolia' && value !== 'fork') {
    throw new Error(`--network must be "sepolia" or "fork", got "${value}"`)
  }
  return value
}

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set (see .env.example)`)
  return v
}

export function loadConfig(network: Network) {
  const rpcUrl = network === 'fork' ? (process.env.FORK_RPC_URL ?? 'http://127.0.0.1:8545') : required('SEPOLIA_RPC_URL')
  const transport = http(rpcUrl)
  const publicClient = createPublicClient({ chain: sepolia, transport })

  const accounts = Object.fromEntries(
    ROLES.map((role) => [role, privateKeyToAccount(required(`${role.toUpperCase()}_PK`) as Hex)]),
  ) as Record<Role, PrivateKeyAccount>

  const wallet = (role: Role) => createWalletClient({ account: accounts[role], chain: sepolia, transport })

  /// A grader's signing key: psa-sim uses GRADER_PK, others GRADER_<LABEL>_PK (e.g. GRADER_BGS_SIM_PK).
  const graderAccount = (label: string) =>
    label === 'psa-sim' ? accounts.grader : privateKeyToAccount(required(`GRADER_${label.toUpperCase().replace(/-/g, '_')}_PK`) as Hex)
  const walletFor = (account: PrivateKeyAccount | ReturnType<typeof mnemonicToAccount>) => createWalletClient({ account, chain: sepolia, transport })

  return {
    network,
    rpcUrl,
    publicClient,
    accounts,
    wallet,
    graderAccount,
    walletFor,
    nameLabel: process.env.NAME_LABEL ?? 'nafuda',
  }
}

export type Config = ReturnType<typeof loadConfig>
