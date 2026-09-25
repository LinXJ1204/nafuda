// P0 Gate 0 check: accounts funded, root name available, Beta contracts present.
// Exits 1 if any check fails.
//
//   npm run preflight -- --network sepolia

import { formatEther, parseEther } from 'viem'
import { BETA_CONTRACTS, SEPOLIA_CHAIN_ID, beta } from './addresses.ts'
import { ROLES, loadConfig, networkFromArgs, type Role } from './config.ts'

const MIN_BALANCE: Record<Role, bigint> = {
  operator: parseEther('0.05'),
  grader: parseEther('0.05'),
  alice: parseEther('0.01'),
  bob: parseEther('0.01'),
  mallory: 0n,
}

const cfg = loadConfig(networkFromArgs())
const { publicClient: client } = cfg
let failed = 0

function check(ok: boolean, label: string, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`)
}

console.log(`== preflight (${cfg.network}) ==`)

check((await client.getChainId()) === SEPOLIA_CHAIN_ID, 'chain id is Sepolia')

for (const role of ROLES) {
  const { address } = cfg.accounts[role]
  const balance = await client.getBalance({ address })
  check(balance >= MIN_BALANCE[role], `${role.padEnd(8)} ${address}`, `${formatEther(balance)} ETH (need ≥ ${formatEther(MIN_BALANCE[role])})`)
}

for (const name of BETA_CONTRACTS) {
  const { address } = beta(name)
  const code = await client.getCode({ address })
  check(!!code && code !== '0x', `Beta ${name}`, address)
}

const registrar = beta('ETHRegistrar')
const available = await client.readContract({
  address: registrar.address,
  abi: registrar.abi,
  functionName: 'isAvailable',
  args: [cfg.nameLabel],
})
check(available === true, `${cfg.nameLabel}.eth is available`)

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
