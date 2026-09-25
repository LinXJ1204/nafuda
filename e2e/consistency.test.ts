// Every title in the Nafuda index against ENS: holder (addr) and chip (text "slab.chip"),
// resolved through the ENSv2 Universal Resolver. Mismatches are re-checked (up to 3 × 20 s) before
// they count, since the index trails the chain by a few blocks.
//
//   cd e2e && npm run consistency        (COLLECTOR_URL to point at another deployment)

import { getAddress, isAddressEqual, type Address } from 'viem'
import { COLLECTOR, chain, check, done } from './lib.ts'

const UR: Address = '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'
type Row = { grader: string; cert: string; holder: string; chip: string }

async function compare(t: Row) {
  const name = `${t.cert}.${t.grader}.nafuda.eth`
  const [holder, chip] = await Promise.all([
    chain.getEnsAddress({ name, universalResolverAddress: UR }),
    chain.getEnsText({ name, key: 'slab.chip', universalResolverAddress: UR }),
  ])
  const holderOk = !!holder && isAddressEqual(holder, getAddress(t.holder))
  const chipOk = !!chip && isAddressEqual(getAddress(chip), getAddress(t.chip))
  return { name, holderOk, chipOk, holder, chip }
}

const { items } = (await (await fetch(`${COLLECTOR}/api/titles?limit=200`)).json()) as { items: Row[] }
console.log(`== ${items.length} titles: index vs ENS ==`)
let results = await Promise.all(items.map(compare))
let bad = results.filter((r) => !r.holderOk || !r.chipOk)
// The index trails the chain by a couple of blocks, and the market simulator may be trading
// while this runs: re-check the ones that differ, up to three times.
for (let round = 1; bad.length && round <= 3; round++) {
  console.log(`  ${bad.length} differ; re-check ${round}/3 in 20 s`)
  await new Promise((r) => setTimeout(r, 20_000))
  const again = (await (await fetch(`${COLLECTOR}/api/titles?limit=200`)).json()) as { items: Row[] }
  const byName = new Map(again.items.map((t) => [`${t.cert}.${t.grader}.nafuda.eth`, t]))
  results = await Promise.all(bad.map((b) => compare(byName.get(b.name)!)))
  bad = results.filter((r) => !r.holderOk || !r.chipOk)
}
for (const b of bad) console.log(`  ✗ ${b.name}: holder ${b.holderOk ? 'ok' : `ENS ${b.holder}`}, chip ${b.chipOk ? 'ok' : `ENS ${b.chip}`}`)
check(bad.length === 0, `every indexed title matches ENS (holder and slab.chip)`, `${items.length - bad.length}/${items.length}`)
done()
