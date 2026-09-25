// Live end-to-end run on Sepolia, through both apps, with real signatures and transactions:
// submit → grade → seal → issue → the title resolves via ENS → ask and bid → transfer with a
// declared price. Uses the demo keys in ../.env. Spends a little Sepolia ETH and uses up one
// bench slab of CGC-Sim. Pause the market simulator first (it signs with the same keys).
//
//   cd e2e && npm run live

import { mnemonicToAccount } from 'viem/accounts'
import { bytesToHex, type Hex } from 'viem'
import { COLLECTOR, GRADER, chain, check, clickText, done, launch, open, text, waitFor } from './lib.ts'

const mnemonic = process.env.DEMO_MNEMONIC
const graderKey = process.env.GRADER_CGC_SIM_PK as Hex | undefined
if (!mnemonic || !graderKey) throw new Error('needs DEMO_MNEMONIC and GRADER_CGC_SIM_PK in ../.env')
const keyOf = (i: number) => bytesToHex(mnemonicToAccount(mnemonic, { addressIndex: i }).getHdKey().privateKey!)
const kenji = { key: keyOf(1), address: mnemonicToAccount(mnemonic, { addressIndex: 1 }).address }
const yuki = { key: keyOf(2), address: mnemonicToAccount(mnemonic, { addressIndex: 2 }).address }

const browser = await launch()
const api = async <T>(path: string): Promise<T> => (await fetch(`${COLLECTOR}/api${path}`)).json() as Promise<T>
const card = `E2E Kappa Ronin ${new Date().toISOString().slice(11, 19)} - Rare #088`

// Set CERT=<an issued cgc-sim cert held by kenji> to skip steps 1–3 (resume a run).
let cert = process.env.CERT ?? ''
if (!cert) {
// 1. kenji submits a card to CGC-Sim from the collector app
{
  const { page, errors } = await open(browser, `${COLLECTOR}/submit`, kenji.key)
  await clickText(page, /Connect wallet/).catch(() => undefined)
  await clickText(page, /CGC-Sim/)
  await page.type('input[placeholder^="Card"]', card)
  await page.type('input[placeholder^="Declared value"]', '42000')
  await clickText(page, /Sign and submit/)
  await waitFor(page, /Submission #\d+ sent to CGC-Sim/)
  check(true, 'collector signs a grading submission')
  check(errors.length === 0, 'submit page without errors', errors[0])
  await page.close()
}
{
  const subs = await api<{ id: string; card: string; status: string }[]>('/submissions?grader=cgc-sim')
  const sub = subs.find((s) => s.card === card)!
  check(sub?.status === 'received', 'submission is on the grader board as received', sub?.id)
}

// 2. CGC-Sim moves it along the intake board, then issues on chain
{
  const { page, errors } = await open(browser, `${GRADER}/intake`, graderKey)
  await clickText(page, /Connect grader wallet/).catch(() => undefined)
  await waitFor(page, /Signed in as CGC-Sim/)
  await waitFor(page, new RegExp(card.slice(0, 20)))
  const cardBox = async (re: RegExp) =>
    page.evaluate(
      (c, src) => {
        const box = [...document.querySelectorAll('div.rounded-2xl')].find((d) => d.textContent?.includes(c) && d.querySelector('button'))
        const btn = box && [...box.querySelectorAll('button')].find((b) => new RegExp(src).test(b.textContent ?? ''))
        if (btn) (btn as HTMLButtonElement).click()
        return !!btn
      },
      card.slice(0, 20),
      re.source,
    )
  check(await cardBox(/Start grading/), 'grader: start grading (signed action)')
  await page.waitForFunction((c) => [...document.querySelectorAll('div.rounded-2xl')].some((d) => d.textContent?.includes(c) && /Seal as cert/.test(d.textContent ?? '')), { timeout: 30_000 }, card.slice(0, 20))
  check(await cardBox(/Seal as cert/), 'grader: seal with a cert from the bench (signed action)')
  await page.waitForFunction((c) => [...document.querySelectorAll('a')].some((a) => /Issue the title/.test(a.textContent ?? '') && a.closest('div')?.textContent?.includes(c)), { timeout: 30_000 }, card.slice(0, 20))
  const href = await page.evaluate((c) => [...document.querySelectorAll('a')].find((a) => /Issue the title/.test(a.textContent ?? '') && a.closest('div')?.textContent?.includes(c))?.getAttribute('href'), card.slice(0, 20))
  cert = new URL(href!, GRADER).searchParams.get('cert')!
  await page.goto(`${GRADER}${href}`, { waitUntil: 'networkidle2' })
  await waitFor(page, /Review and sign/)
  await clickText(page, /^Issue title$/)
  await waitFor(page, /Title issued/, 120_000)
  check(/marked issued/.test(await text(page)), `grader: title issued on Sepolia for cert ${cert}, submission marked issued`)
  check(errors.length === 0, 'grader console without errors', errors[0])
  await page.close()
}

}
// 3. The new title resolves through ENS to kenji
const name = `${cert}.cgc-sim.nafuda.eth`
const holder = await chain.getEnsAddress({ name, universalResolverAddress: '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' })
check(holder === kenji.address, `ENS: ${name} resolves to the submitter`)

// 4. kenji asks, yuki bids
{
  const { page } = await open(browser, `${COLLECTOR}/title/cgc-sim/${cert}`, kenji.key)
  await clickText(page, /Connect wallet/).catch(() => undefined)
  await waitFor(page, /Set your asking price/, 45_000)
  await page.type('input[placeholder="¥ price"]', '88000')
  await clickText(page, /Publish ask/)
  await waitFor(page, /Holder asks/)
  check(/¥88,000/.test(await text(page)), 'holder publishes a signed ask')
  await page.close()
}
{
  const { page } = await open(browser, `${COLLECTOR}/title/cgc-sim/${cert}`, yuki.key)
  await clickText(page, /Connect wallet/).catch(() => undefined)
  await waitFor(page, /Make an offer/, 45_000)
  await page.type('input[placeholder="¥ price"]', '80000')
  await clickText(page, /Sign offer/)
  await waitFor(page, /Offer sent to the holder/)
  await waitFor(page, /Offers \(\d+\)[\s\S]*¥80,000/, 30_000).catch(() => undefined)
  check(/¥80,000/.test(await text(page)), 'another collector signs an offer (listed on the title)')
  await page.close()
}

// 5. kenji transfers to yuki with a declared price
{
  const { page, errors } = await open(browser, `${COLLECTOR}/title/cgc-sim/${cert}`, kenji.key)
  await clickText(page, /Connect wallet/).catch(() => undefined)
  await waitFor(page, /You hold this title/, 45_000)
  await page.type('input[placeholder^="Buyer address"]', yuki.address)
  await page.type('input[placeholder^="Declared price"]', '84000')
  await clickText(page, /Transfer title/)
  await waitFor(page, /Transferred to/, 120_000)
  check(true, 'holder transfers the title with a declared price')
  check(errors.length === 0, 'title page without errors', errors[0])
  await page.close()
}
const after = await chain.getEnsAddress({ name, universalResolverAddress: '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' })
check(after === yuki.address, 'ENS: the name now resolves to the buyer')

// 6. A wallet that is not the grader is stopped before anything is sent
{
  const { page } = await open(browser, `${GRADER}/issue?as=cgc-sim`, yuki.key)
  await clickText(page, /Connect grader wallet/).catch(() => undefined)
  await waitFor(page, /not a grader/)
  await clickText(page, /Awaiting title/)
  await clickText(page, /Next: submitter/)
  await clickText(page, /aiko/)
  await clickText(page, /Next: review/)
  await clickText(page, /Check and issue/)
  await waitFor(page, /Not sent/, 30_000)
  check(/not CGC-Sim/.test(await text(page)), 'non-grader wallet: refused before sending')
  await page.close()
}

// 7. The indexer catches up: declared price in the history
let indexed: { history: { priceJpy: number | null }[]; holder: string } | null = null
for (let i = 0; i < 20 && !indexed?.history.length; i++) {
  await new Promise((r) => setTimeout(r, 6000))
  indexed = await api(`/titles/cgc-sim/${cert}`).catch(() => null)
}
check(indexed?.history[0]?.priceJpy === 84000 && indexed.holder === yuki.address.toLowerCase(), 'index: transfer with declared ¥84,000, holder is the buyer')

await browser.close()
done()
