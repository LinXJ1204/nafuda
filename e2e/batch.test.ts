// Live, on Sepolia: the grader console's batch issue. CGC-Sim issues every sealed submission on
// its intake board (one transaction each), and each is marked issued. Pause the market first.
//
//   cd e2e && node --env-file=../.env batch.test.ts

import type { Hex } from 'viem'
import { COLLECTOR, GRADER, check, clickText, done, launch, open, text, waitFor } from './lib.ts'

const graderKey = process.env.GRADER_CGC_SIM_PK as Hex | undefined
if (!graderKey) throw new Error('needs GRADER_CGC_SIM_PK in ../.env')
type Sub = { id: string; status: string; cert: string | null }
const subs = async () => (await (await fetch(`${COLLECTOR}/api/submissions?grader=cgc-sim`)).json()) as Sub[]

const sealed = (await subs()).filter((s) => s.status === 'sealed')
if (!sealed.length) {
  console.log('no sealed CGC-Sim submissions to batch-issue')
  process.exit(0)
}
const browser = await launch()
const { page, errors } = await open(browser, `${GRADER}/intake`, graderKey)
await clickText(page, /Connect grader wallet/).catch(() => undefined)
await waitFor(page, /Signed in as CGC-Sim/)
await waitFor(page, /Issue all \d+ sealed/)
await clickText(page, /Issue all \d+ sealed/)
await waitFor(page, /Batch done|\d+\/\d+ #\d+: .*(revert|refused|Not|error)/i, 300_000)
check(/Batch done/.test(await text(page)) && !/text-bad/.test(await page.content()), `batch issued ${sealed.length} sealed submission(s)`)
const after = await subs()
check(sealed.every((s) => after.find((a) => a.id === s.id)?.status === 'issued'), 'every one is marked issued (checked against its transaction by the server)')
check(errors.length === 0, 'intake page without errors', errors[0])
await browser.close()
done()
