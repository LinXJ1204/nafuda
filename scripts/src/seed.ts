// Seed the v3 demo data: fund the demo collectors, then issue the "now" part of the seed plan
// (seed-plan.ts) from each grader. Idempotent: issued certs are skipped.
//
//   npm run seed -- --network fork|sepolia

import { parseEther, zeroAddress, type Address } from 'viem'
import { collectorAccounts } from './collectors.ts'
import { controllerAbi } from './chain.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { confirm, loadState, skip } from './lib.ts'
import { seedPlan } from './seed-plan.ts'

const cfg = loadConfig(networkFromArgs())
const { publicClient: client } = cfg
const state = loadState(cfg.network, cfg.nameLabel)
const graders = state.graders ?? {}
const plan = seedPlan().filter((t) => t.now)
const missing = [...new Set(plan.map((t) => t.grader))].filter((g) => !graders[g])
if (missing.length) throw new Error(`graders not deployed: ${missing.join(', ')} (run deploy-grader)`)

console.log(`== seed on ${cfg.network}: ${plan.length} titles across ${Object.keys(graders).length} graders ==`)

// 1. Gas for every collector whose key we hold (they trade in market.ts)
const MIN = parseEther('0.01')
const operator = cfg.wallet('operator')
for (const [name, account] of Object.entries(collectorAccounts())) {
  const balance = await client.getBalance({ address: account.address })
  if (balance >= MIN) continue
  const hash = await operator.sendTransaction({ to: account.address, value: MIN * 2n - balance })
  await confirm(client, `fund ${name}`, hash)
}

// 2. Issue, one queue per grader (graders send in parallel, each grader sequentially)
async function issueFor(label: string) {
  const g = graders[label]
  const wallet = cfg.walletFor(cfg.graderAccount(label))
  for (const t of plan.filter((p) => p.grader === label)) {
    const tag = `${label} ${t.cert} → ${t.holderName}`
    const holder = (await client.readContract({ address: g.controller, abi: controllerAbi, functionName: 'holderOf', args: [t.cert] })) as Address
    if (holder !== zeroAddress) {
      skip(tag, 'already issued')
      continue
    }
    const hash = t.attributes.length
      ? await wallet.writeContract({
          address: g.controller,
          abi: controllerAbi,
          functionName: 'issueWithAttributes',
          args: [t.cert, t.holder, t.chip, t.card, t.grade, t.attributes.map((a) => a[0]), t.attributes.map((a) => a[1])],
        })
      : await wallet.writeContract({ address: g.controller, abi: controllerAbi, functionName: 'issue', args: [t.cert, t.holder, t.chip, t.card, t.grade] })
    await confirm(client, tag, hash)
  }
}
await Promise.all(Object.keys(graders).map(issueFor))

