// Demo data for card categories (docs/plan/upgrades.md, U1, light version): BGS-Sim, whose
// controller (v2) takes extra records, issues eight titles filed under a game or sport. The
// categories name real games; the cards are fictional demo cards. Certs already issued are
// skipped, so re-running is safe. Without --execute it only checks and simulates.
//
//   npm run categorized -- --network sepolia [--execute]

import { formatEther, zeroAddress, type Address } from 'viem'
import { privateKeyToAddress } from 'viem/accounts'
import type { CategoryForm } from '../../packages/core/src/categories.ts'
import { chipKey } from '../../packages/core/src/chips.ts'
import { COLLECTORS, graderByLabel } from '../../packages/core/src/deployment.ts'
import { attributesFor, precheck, type IssueForm } from '../../packages/core/src/issue-rules.ts'
import { controllerAbi } from './chain.ts'
import { loadConfig, networkFromArgs } from './config.ts'

type Planned = { cert: string; card: string; grade: string; sub: [string, string, string, string]; holder: string; category: CategoryForm }

const PLAN: Planned[] = [
  { cert: '1004827401', card: 'Kitsune Lantern - Promo #042 (demo card)', grade: 'GEM MINT 9.5', sub: ['9.5', '9.5', '10', '9.5'], holder: 'kenji', category: { group: 'tcg', kind: 'pokemon', year: '2025', language: 'JPN' } },
  { cert: '1004827402', card: 'Nafuda Dragon - Holo #001 (demo card)', grade: 'PRISTINE 10', sub: ['10', '10', '10', '10'], holder: 'sololin', category: { group: 'tcg', kind: 'pokemon', year: '2024', language: 'ENG' } },
  { cert: '1004827403', card: 'Raijin Spark - Secret #099 (demo card)', grade: 'MINT 9', sub: ['9', '9.5', '9', '9'], holder: 'yuki', category: { group: 'tcg', kind: 'yugioh', year: '2023', language: 'JPN' } },
  { cert: '1004827404', card: 'Fujin Gale - Secret #100 (demo card)', grade: 'GEM MINT 9.5', sub: ['9.5', '10', '9.5', '9.5'], holder: 'sakura', category: { group: 'tcg', kind: 'yugioh', year: '2025', language: 'JPN' } },
  { cert: '1004827405', card: 'Ryujin Pearl - Secret #007 (demo card)', grade: 'GEM MINT 9.5', sub: ['10', '9.5', '9.5', '9.5'], holder: 'haruto', category: { group: 'tcg', kind: 'one-piece', year: '2025', language: 'JPN' } },
  { cert: '1004827406', card: 'Hoo Phoenix - Secret #001 (demo card)', grade: 'NM-MT+ 8.5', sub: ['8.5', '9', '8.5', '8.5'], holder: 'emma', category: { group: 'tcg', kind: 'mtg', year: '2022', language: 'ENG' } },
  { cert: '1004827407', card: 'Harbor Hawks Slugger - Rookie #27 (demo card)', grade: 'GEM MINT 9.5', sub: ['9.5', '9.5', '9.5', '10'], holder: 'taro', category: { group: 'sports', kind: 'baseball', year: '2025', language: 'JPN' } },
  { cert: '1004827408', card: 'Tide City Guard - Rookie #11 (demo card)', grade: 'MINT 9', sub: ['9', '9', '9.5', '9'], holder: 'liam', category: { group: 'sports', kind: 'basketball', year: '2024', language: 'ENG' } },
]

const execute = process.argv.includes('--execute')
const cfg = loadConfig(networkFromArgs())
const client = cfg.publicClient
const g = graderByLabel('bgs-sim')!
const account = cfg.graderAccount('bgs-sim')
const wallet = cfg.walletFor(account)
if (account.address.toLowerCase() !== g.grader.toLowerCase()) throw new Error('GRADER_BGS_SIM_PK is not the BGS-Sim grader')
console.log(`BGS-Sim grader ${account.address}: ${formatEther(await client.getBalance({ address: account.address }))} ETH${execute ? '' : ' (dry run: add --execute to send)'}`)

const holderOf = (name: string): Address => {
  const c = COLLECTORS.find((x) => x.name === name)
  if (!c) throw new Error(`unknown collector ${name}`)
  return c.address as Address
}

for (const p of PLAN) {
  const form: IssueForm = {
    cert: p.cert,
    card: p.card,
    grade: p.grade,
    holder: holderOf(p.holder),
    chip: privateKeyToAddress(chipKey('bgs-sim', 'genuine', p.cert)),
    subgrades: Object.fromEntries(g.subgrades.map((k, i) => [k, p.sub[i]])),
    category: p.category,
  }
  const heldBy = (await client.readContract({ address: g.controller, abi: controllerAbi, functionName: 'holderOf', args: [p.cert] })) as Address
  if (heldBy !== zeroAddress) {
    console.log(`${p.cert}: already issued, skipped`)
    continue
  }
  const problem = precheck(form, g, account.address, heldBy)
  if (problem) throw new Error(`${p.cert}: ${problem}`)
  const { keys, values } = attributesFor(form, g)
  const args = [form.cert, form.holder as Address, form.chip, form.card, form.grade, keys, values] as const
  await client.simulateContract({ address: g.controller, abi: controllerAbi, functionName: 'issueWithAttributes', args, account })
  if (!execute) {
    console.log(`${p.cert}: would issue to ${p.holder} with ${keys.length} records (${values.slice(4).join(', ')})`)
    continue
  }
  const hash = await wallet.writeContract({ address: g.controller, abi: controllerAbi, functionName: 'issueWithAttributes', args })
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${p.cert}: reverted (${hash})`)
  console.log(`${p.cert}: issued to ${p.holder} (${values.slice(4).join(', ')}) ${hash}`)
}
