// Top up grader / alice / bob / mallory from the operator to MIN_BALANCE.
// Only the operator needs faucet ETH.
//
//   npm run fund -- --network sepolia

import { formatEther } from 'viem'
import { MIN_BALANCE, ROLES, loadConfig, networkFromArgs } from './config.ts'

const cfg = loadConfig(networkFromArgs())
const { publicClient: client } = cfg
const operator = cfg.wallet('operator')

for (const role of ROLES) {
  if (role === 'operator') continue
  const to = cfg.accounts[role].address
  const balance = await client.getBalance({ address: to })
  const shortfall = MIN_BALANCE[role] - balance
  if (shortfall <= 0n) {
    console.log(`= ${role.padEnd(8)} ${formatEther(balance)} ETH, no top-up needed`)
    continue
  }
  const hash = await operator.sendTransaction({ to, value: shortfall })
  await client.waitForTransactionReceipt({ hash })
  console.log(`+ ${role.padEnd(8)} +${formatEther(shortfall)} ETH  ${hash}`)
}
