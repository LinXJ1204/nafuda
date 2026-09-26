// Images for the ETHGlobal submission form, from the live site: a square logo, a 16:9 cover and
// screenshots of the key screens. Read-only (the buyer check and the attacks are simulations).
//   cd e2e && node submission-images.ts        → docs/submission/*.png

import { mkdirSync } from 'node:fs'
import type { Page } from 'puppeteer-core'
import { COLLECTOR, GRADER, clickText, launch, waitFor } from './lib.ts'

const OUT = new URL('../docs/submission/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await launch()
// Single quotes only: these go inside style="…" attributes.
const SERIF = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"

async function page(url: string, width = 1440, height = 900): Promise<Page> {
  const p = await browser.newPage()
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await p.setViewport({ width, height, deviceScaleFactor: 2 })
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
  return p
}

/// Screenshot the card (or section) that holds a heading, in page coordinates.
async function shotOf(p: Page, heading: RegExp, file: string, pad = 16) {
  const r = await p.evaluate((src) => {
    const h = [...document.querySelectorAll('h1, h2, h3')].find((e) => new RegExp(src).test(e.textContent ?? ''))
    const box = (h?.closest('.rounded-2xl, section') ?? h) as HTMLElement | null
    if (!box) return null
    const b = box.getBoundingClientRect()
    return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }
  }, heading.source)
  if (!r) throw new Error(`no heading ${heading}`)
  await p.screenshot({ path: OUT + file, captureBeyondViewport: true, clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + 2 * pad, height: r.height + 2 * pad } })
  console.log('wrote', file)
}

// --- logo ------------------------------------------------------------------------------------
{
  const p = await browser.newPage()
  await p.setViewport({ width: 512, height: 512 })
  await p.setContent(`<html><body style="margin:0"><div style="width:512px;height:512px;background:#c8352b;display:grid;place-items:center;
    font-family:${SERIF};font-weight:600;color:#fff;font-size:212px;letter-spacing:-6px">名札</div></body></html>`)
  await p.screenshot({ path: OUT + 'logo.png' })
  console.log('wrote logo.png')
  await p.close()
}

// --- cover: three live slabs (their SVG as the site draws it) and the pitch --------------------
{
  const slabs: string[] = []
  for (const [g, c] of [['psa-sim', '81234520'], ['bgs-sim', '1004827401'], ['cgc-sim', '4000317218']]) {
    const p = await page(`${COLLECTOR}/title/${g}/${c}`)
    await p.waitForSelector('svg[role=img]')
    slabs.push(await p.$eval('svg[role=img]', (s) => s.outerHTML))
    await p.close()
  }
  const p = await browser.newPage()
  await p.setViewport({ width: 1920, height: 1080 })
  const slab = (svg: string, left: number, rot: number, dy: number, z: number) =>
    `<div style="position:absolute;top:${170 + dy}px;left:${left}px;width:330px;transform:rotate(${rot}deg);z-index:${z};filter:drop-shadow(0 24px 40px rgba(0,0,0,.55))">${svg}</div>`
  await p.setContent(`<html><body style="margin:0;background:#15130f;color:#f3efe7;font-family:${SANS}">
    <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:radial-gradient(1200px 700px at 78% 50%, #2a221b 0%, #15130f 70%)">
      <div style="position:absolute;left:130px;top:150px;width:900px">
        <div style="display:flex;align-items:center;gap:26px">
          <div style="width:112px;height:112px;border-radius:20px;background:#c8352b;display:grid;place-items:center;font-family:${SERIF};font-weight:600;font-size:48px;color:#fff">名札</div>
          <div style="font-size:64px;font-weight:700;letter-spacing:-1px">Nafuda</div>
        </div>
        <div style="margin-top:70px;font-family:${SERIF};font-size:104px;line-height:1.08;font-weight:600">Every slab<br>wears its name.</div>
        <div style="margin-top:40px;font-size:36px;line-height:1.4;color:#c9c2b6;max-width:820px">ENSv2 titles for graded trading cards: tap the slab to verify it and its owner, and sell it by transferring the name.</div>
        <div style="margin-top:56px;display:flex;flex-wrap:wrap;gap:16px;font-size:26px;font-weight:600">
          <span style="border:2px solid #e0584c;color:#f08a80;border-radius:999px;padding:10px 24px">ENSv2 · Enhanced Access Control</span>
          <span style="border:2px solid #5cb884;color:#7fd1a1;border-radius:999px;padding:10px 24px">Curvegrid MultiBaas witness</span>
          <span style="border:2px solid #6b645a;color:#c9c2b6;border-radius:999px;padding:10px 24px">Live on Sepolia</span>
        </div>
      </div>
      ${slab(slabs[0], 1080, -9, 60, 1)}${slab(slabs[2], 1480, 9, 60, 1)}${slab(slabs[1], 1280, 0, 0, 2)}
    </div></body></html>`)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: OUT + 'cover.png' })
  console.log('wrote cover.png')
  await p.close()
}

// --- screenshots ------------------------------------------------------------------------------
// 1. A title: the ENS name, the grader's records (category, subgrades), witness and index pills
{
  const p = await page(`${COLLECTOR}/title/bgs-sim/1004827401`)
  await waitFor(p, /index matches ENS ✓/, 60_000)
  await new Promise((r) => setTimeout(r, 1500))
  await p.screenshot({ path: OUT + '1-title.png' })
  console.log('wrote 1-title.png')
  await p.close()
}

// 2–3. The buyer check (tap the slab), then "who can do what" with an attack answered by the contract
{
  const { items } = (await (await fetch(`${COLLECTOR}/api/titles?sort=traded&limit=1`)).json()) as { items: { grader: string; cert: string }[] }
  const p = await page(`${COLLECTOR}/title/${items[0].grader}/${items[0].cert}`, 1440, 1000)
  await waitFor(p, /index matches ENS ✓/, 60_000)
  await clickText(p, /\(holder\)/)
  await clickText(p, /Tap the slab and verify/)
  await waitFor(p, /All checks pass/, 60_000)
  // The steps are revealed one by one; the verdict is in the DOM from the start, only faded out.
  await p.waitForFunction(
    () => [...document.querySelectorAll('div.opacity-100')].some((d) => /Genuine slab, and the seller is the registered holder/.test(d.textContent ?? '')),
    { timeout: 30_000 },
  )
  await new Promise((r) => setTimeout(r, 800))
  await shotOf(p, /Tap the slab|Check this slab|Buyer check|Verify/, '2-verify.png')
  await p.waitForFunction(() => document.querySelectorAll('table button').length >= 24, { timeout: 90_000 })
  await clickText(p, /The grader tries to take it back/)
  await waitFor(p, /EACUnauthorizedAccountRoles|reverted/, 60_000)
  await new Promise((r) => setTimeout(r, 4000))
  await shotOf(p, /Who can do what/, '3-permissions.png')
  await p.close()
}

// 4. Grader console: live access-control map, final lock applied
{
  const p = await page(`${GRADER}/trust`, 1440, 1100)
  await waitFor(p, /with powers left/, 60_000)
  await new Promise((r) => setTimeout(r, 2500))
  await p.screenshot({ path: OUT + '4-trust.png' })
  console.log('wrote 4-trust.png')
  await p.close()
}

// 5–6. Second witness (Curvegrid MultiBaas) and the market dashboard
for (const [path, file] of [['/witness', '5-witness.png'], ['/market', '6-market.png']]) {
  const p = await page(`${COLLECTOR}${path}`, 1440, 1000)
  await new Promise((r) => setTimeout(r, 3500))
  await p.screenshot({ path: OUT + file })
  console.log('wrote', file)
  await p.close()
}

// 7. Grader console: the intake board
{
  const p = await page(`${GRADER}/intake?as=bgs-sim`, 1440, 900)
  await new Promise((r) => setTimeout(r, 3000))
  await p.screenshot({ path: OUT + '7-intake.png' })
  console.log('wrote 7-intake.png')
  await p.close()
}

await browser.close()
