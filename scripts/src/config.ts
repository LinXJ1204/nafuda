// Shared runtime config: network selection, clients, and the five demo accounts.
//
// Usage from any script: `const cfg = loadConfig(networkFromArgs())`.
// Networks:
//   sepolia  real Sepolia via SEPOLIA_RPC_URL
//   fork     an `anvil --fork-url $SEPOLIA_RPC_URL` node at FORK_RPC_URL (default http://127.0.0.1:8545)

import { createPublicClient, createWalletClient, http, type Hex, type PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

export type Network = 'sepolia' | 'fork'

export const ROLES = ['operator', 'grader', 'alice', 'bob', 'mallory'] as const
export type Role = (typeof ROLES)[number]

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

  return {
    network,
    rpcUrl,
    publicClient,
    accounts,
    wallet,
    nameLabel: process.env.NAME_LABEL ?? 'nafuda',
  }
}

export type Config = ReturnType<typeof loadConfig>
