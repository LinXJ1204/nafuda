// Read-only end-to-end checks against a deployment (default: the live site). Safe to run anytime.
//   cd e2e && npm run public          COLLECTOR_URL / GRADER_URL to point elsewhere

import { COLLECTOR, GRADER, check, clickText, done, launch, open, text, waitFor } from './lib.ts'

const browser = await launch()
const api = async <T>(path: string): Promise<T> => (await fetch(`${COLLECTOR}/api${path}`)).json() as Promise<T>

// Collector app pages load without errors
for (const path of ['/', '/explore', '/verify', '/activity', '/graders', '/graders/bgs-sim', '/collectors', '/map', '/developers', '/submit']) {
  const { page, errors } = await open(browser, COLLECTOR + path)
  await page.waitForSelector('h1', { timeout: 30_000 })
  check(errors.length === 0, `collector ${path} loads`, errors[0])
  await page.close()
}

// A title page: ENS and the index agree, the resolution path finds the grader's resolver
const { items } = await api<{ items: { grader: string; cert: string; holder: string; transferCount: number }[] }>('/titles?sort=traded&limit=1')
const t = items[0]
{
  const { page, errors } = await open(browser, `${COLLECTOR}/title/${t.grader}/${t.cert}`)
  await waitFor(page, /index matches ENS ✓|index is behind ENS/, 45_000)
  check(/index matches ENS ✓/.test(await text(page)), `title ${t.grader}/${t.cert}: index matches ENS`)
  await waitFor(page, /Resolver found here/, 45_000)
  check(true, 'resolution path: resolver found at the grader level')
  check(/Provenance/.test(await text(page)) && (await page.$$('.react-flow__node')).length >= 2 + t.transferCount, 'provenance flow has the grader and every holder')
  await page.waitForFunction(() => document.querySelectorAll('table button').length >= 24, { timeout: 60_000 })
  const rows = await page.$$eval('table tbody tr', (trs) => trs.map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent?.trim())))
  const holderRow = rows.find((r) => r.length === 6 && r[0] === '✓')
  const strangerRow = rows[rows.length - 1]
  check(!!holderRow && strangerRow.every((c) => c === '✕'), 'permissions (EAC, simulated live): holder can transfer; a stranger is refused everything')
  await waitFor(page, /All checks pass|Check failed/, 45_000)
  check(/All checks pass/.test(await text(page)), 'title integrity (EAC): resolver, controller record, holder roles, sole assignee, emancipated')

  // Buyer check S1, S2, S5
  await page.evaluate(() => document.querySelector('#verify, h2')?.scrollIntoView())
  await clickText(page, /\(holder\)/)
  await clickText(page, /Tap the slab and verify/)
  await waitFor(page, /Genuine slab, and the seller is the registered holder/, 15_000)
  check(true, 'S1 genuine slab, seller is the holder')
  await page.click('input[type=radio]:not(:checked)')
  await clickText(page, /Tap the slab and verify/)
  await waitFor(page, /This is not the slab the grader sealed/, 15_000)
  check(true, 'S2 clone slab is rejected')
  check(errors.length === 0, 'title page without errors', errors[0])
  await page.close()
}

// Card categories (card.* text records on controller v2): the filter and a categorized title
{
  const cats = await api<{ items: { kind: string | null; n: number }[] }>('/categories')
  const pokemon = await api<{ total: number; items: { cert: string; grader: string }[] }>('/titles?category=pokemon')
  check(pokemon.total > 0 && pokemon.total === cats.items.find((c) => c.kind === 'pokemon')?.n, 'categories: the Pokémon filter matches its count', `${pokemon.total} titles`)
  const first = pokemon.items[0]
  const { page, errors } = await open(browser, `${COLLECTOR}/title/${first.grader}/${first.cert}`)
  await waitFor(page, /Card records/, 45_000)
  check(/Game\s*Pokémon/.test(await text(page)), `categories: title ${first.cert} shows its card.game record, read through ENS`)
  check(errors.length === 0, 'categorized title page without errors', errors[0])
  await page.close()
}

// A title that was never issued
{
  const { page } = await open(browser, `${COLLECTOR}/title/psa-sim/99999999`)
  await waitFor(page, /NO TITLE/, 45_000)
  check(true, 'S4 unissued cert shows NO TITLE')
  await page.close()
}

// Grader console
for (const path of ['/', '/intake', '/issue', '/issued', '/trust', '/network', '/join']) {
  const { page, errors } = await open(browser, GRADER + path)
  await page.waitForSelector('h1', { timeout: 30_000 })
  check(errors.length === 0, `grader ${path} loads`, errors[0])
  if (path === '/trust') {
    await waitFor(page, /Raw on-chain data/, 45_000)
    const titleChecks = await page.$$eval('li', (lis) => lis.slice(0, 5).map((li) => li.textContent ?? ''))
    check(titleChecks.every((c) => c.startsWith('✓')), 'trust: all title guarantees pass (read live)')
  }
  await page.close()
}

// API: the index and ENS agree on holders (spot check through the API only)
const status = await api<{ titles: number; transfers: number }>('/status')
check(status.titles > 0 && status.transfers > 0, 'indexer has titles and transfers', `${status.titles} titles, ${status.transfers} transfers`)

// Second witness (Curvegrid MultiBaas): once connected, both indexes must agree both ways
type WitnessApi = { configured: boolean; summary: { witnessed: number; agreed: number; mismatch: number; missing: number; unwitnessed: number } }
const witness = await api<WitnessApi>('/witness')
if (!witness.configured) console.log('  (second witness not connected: skipped)')
else {
  const s = witness.summary
  check(s.mismatch === 0 && s.missing === 0, 'second witness: every event Curvegrid saw is in the index', `${s.agreed}/${s.witnessed} agree, ${s.mismatch} differ, ${s.missing} missing`)
  check(s.unwitnessed === 0, 'second witness: every indexed transfer in its window was seen by Curvegrid', `${s.unwitnessed} unwitnessed`)
  const hook = await fetch(`${COLLECTOR}/api/hooks/multibaas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' })
  check(hook.status === 401, 'second witness: an unsigned delivery is refused', `HTTP ${hook.status}`)
}

await browser.close()
done()
