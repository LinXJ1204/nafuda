// Explore (#/): every title PSA-Sim has issued, from on-chain events, plus a cert lookup.

import { GRADER_NAME } from '../lib/config.ts'
import { el, errorText, firstLine, muted } from '../lib/dom.ts'
import { titleIndex } from '../lib/index-store.ts'
import type { View } from '../lib/view.ts'
import { titleGrid } from './gallery.ts'
import { certSearch } from './search.ts'

export async function explorePage(view: View) {
  const stats = el('p', { className: 'stats' }, 'Reading titles from Sepolia…')
  const grid = el('div', {})
  view.main.append(
    el(
      'section',
      { className: 'hero' },
      el('h1', { textContent: 'Every slab wears its name.' }),
      el(
        'p',
        { className: 'lede' },
        'Each graded slab carries a chip, and its title is an ENS name, ',
        el('span', { className: 'mono', textContent: `<cert>.${GRADER_NAME}` }),
        ', that records the chip and resolves to the owner. Tap the slab to prove it is the one the grader sealed; check the name to see who owns it; transfer the name when you sell it.',
      ),
      certSearch(),
      el(
        'ol',
        { className: 'how' },
        el('li', {}, el('strong', { textContent: 'Graded' }), ' PSA-Sim seals a chip into the slab and issues the title to the submitter.'),
        el('li', {}, el('strong', { textContent: 'Checked' }), ' At a card show, the buyer taps the slab and checks the seller against the title holder.'),
        el('li', {}, el('strong', { textContent: 'Sold' }), ' The seller transfers the title. The name now resolves to the buyer.'),
      ),
    ),
    el('div', { className: 'section-head' }, el('h2', { textContent: 'All titles' }), stats),
    grid,
  )

  try {
    const titles = await titleIndex()
    if (!view.alive()) return
    const transfers = titles.reduce((n, t) => n + t.history.length - 1, 0)
    const holders = new Set(titles.map((t) => t.holder.toLowerCase())).size
    stats.textContent = `${titles.length} titles · ${holders} holders · ${transfers} transfers · 1 grader · newest first`
    grid.replaceChildren(titles.length ? titleGrid(titles) : muted('No titles yet.'))
  } catch (e) {
    if (!view.alive()) return
    stats.textContent = ''
    grid.replaceChildren(errorText(`Could not read titles: ${firstLine(e)}`))
  }
}
