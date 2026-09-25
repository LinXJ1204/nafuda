// Market simulator (v3 demo data): over the night, demo collectors trade titles and graders
// issue the rest of the seed plan, at random intervals, so the activity feed, charts and
// histories show realistic timing. Every transfer carries a declared price (seed-plan.ts).
//
//   npm run market -- --network sepolia --until 2026-09-26T07:30:00+09:00 --budget 0.3
//   options: --min 60 --max 300 (seconds between actions), --burst 12 (quick trades at start)
//
// Stops at --until or once the gas it paid reaches --budget (ETH). Logs one JSON line per action.
// Only collectors whose keys are in .env trade; the author's wallet can buy but never sells here.

import { formatEther, labelhash, parseEther, zeroAddress, type Address } from 'viem'
import { collectorAccounts } from './collectors.ts'
import { controllerAbi, registryAbi } from './chain.ts'
import { loadConfig, networkFromArgs } from './config.ts'
import { loadState } from './lib.ts'
import { COLLECTORS, encodePrice, priceFor, seedPlan, type PlannedTitle } from './seed-plan.ts'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const cfg = loadConfig(networkFromArgs())
const { publicClient: client } = cfg
const state = loadState(cfg.network, cfg.nameLabel)
const graders = state.graders ?? {}
const until = new Date(arg('until', new Date(Date.now() + 8 * 3600_000).toISOString())).getTime()
const budget = parseEther(arg('budget', '0.3'))
const minGap = Number(arg('min', '60')) * 1000
const maxGap = Number(arg('max', '300')) * 1000
let burst = Number(arg('burst', '0'))

const accounts = collectorAccounts()
const byAddress = new Map(Object.entries(accounts).map(([name, a]) => [a.address.toLowerCase(), { name, account: a }]))
const buyers = COLLECTORS.filter((c) => c.name !== 'mallory')
const plan = seedPlan()
let spent = 0n

const log = (event: Record<string, unknown>) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]

async function holderOf(t: PlannedTitle): Promise<Address> {
  return (await client.readContract({ address: graders[t.grader].controller, abi: controllerAbi, functionName: 'holderOf', args: [t.cert] })) as Address
}

async function paid(hash: `0x${string}`) {
  const receipt = await client.waitForTransactionReceipt({ hash })
  spent += receipt.gasUsed * receipt.effectiveGasPrice
  if (receipt.status !== 'success') throw new Error(`reverted: ${hash}`)
  return receipt
}

async function issueNext(): Promise<boolean> {
  for (const t of plan.filter((p) => !p.now)) {
    if ((await holderOf(t)) !== zeroAddress) continue
    const wallet = cfg.walletFor(cfg.graderAccount(t.grader))
    const g = graders[t.grader]
    const hash = t.attributes.length
      ? await wallet.writeContract({
          address: g.controller,
          abi: controllerAbi,
          functionName: 'issueWithAttributes',
          args: [t.cert, t.holder, t.chip, t.card, t.grade, t.attributes.map((a) => a[0]), t.attributes.map((a) => a[1])],
        })
      : await wallet.writeContract({ address: g.controller, abi: controllerAbi, functionName: 'issue', args: [t.cert, t.holder, t.chip, t.card, t.grade] })
    await paid(hash)
    log({ action: 'issue', grader: t.grader, cert: t.cert, holder: t.holderName, tx: hash })
    return true
  }
  return false
}

async function trade(): Promise<boolean> {
  // Titles whose holder we can sign for
  const holders = await Promise.all(plan.map(async (t) => ({ t, holder: await holderOf(t) })))
  const tradable = holders.filter((h) => h.holder !== zeroAddress && byAddress.has(h.holder.toLowerCase()))
  if (!tradable.length) return false
  const { t, holder } = pick(tradable)
  const seller = byAddress.get(holder.toLowerCase())!
  const buyer = Math.random() < 0.1 ? buyers.find((b) => b.name === 'sololin')! : pick(buyers.filter((b) => b.address.toLowerCase() !== holder.toLowerCase()))
  const price = priceFor(Math.random, t.card, t.grade)
  const registry = graders[t.grader].registry
  const tokenId = (await client.readContract({ address: registry, abi: registryAbi, functionName: 'getTokenId', args: [BigInt(labelhash(t.cert))] })) as bigint
  const hash = await cfg.walletFor(seller.account).writeContract({
    address: registry,
    abi: registryAbi,
    functionName: 'safeTransferFrom',
    args: [holder, buyer.address, tokenId, 1n, encodePrice(price)],
  })
  await paid(hash)
  log({ action: 'transfer', grader: t.grader, cert: t.cert, from: seller.name, to: buyer.name, priceJpy: price, tx: hash })
  return true
}

log({ action: 'start', network: cfg.network, until: new Date(until).toISOString(), budgetEth: formatEther(budget) })
while (Date.now() < until && spent < budget) {
  try {
    const unissued = plan.filter((p) => !p.now).length
    const doIssue = Math.random() < (burst > 0 ? 0.1 : 0.25) && unissued > 0
    const done = doIssue ? await issueNext() : false
    if (!done) await trade()
  } catch (e) {
    log({ action: 'error', message: (e as Error).message.split('\n')[0] })
  }
  const gap = burst-- > 0 ? 8000 : minGap + Math.random() * (maxGap - minGap)
  await sleep(gap)
}
log({ action: 'stop', spentEth: formatEther(spent), reason: spent >= budget ? 'budget' : 'time' })
