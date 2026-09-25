// Issued titles (#/issued): every title PSA-Sim has issued, its current holder and how often it
// changed hands, from on-chain events.

import { client } from '../lib/ens.ts'
import { addressLink, el, errorText, firstLine, formatTime, muted, txLink } from '../lib/dom.ts'
import { blockTime } from '../lib/events.ts'
import { titleIndex } from '../lib/index-store.ts'
import { consumerHref } from '../lib/layout.ts'
import { titleHash } from '../lib/routes.ts'
import { splitCard } from '../lib/slab-art.ts'
import type { View } from '../lib/view.ts'

export async function issuedPage(view: View) {
  const stats = el('p', { className: 'stats' }, 'Reading events…')
  const body = el('div', {})
  view.main.append(el('div', { className: 'section-head' }, el('h1', { textContent: 'Issued titles' }), stats), body)

  try {
    const titles = await titleIndex(true)
    if (!view.alive()) return
    const transfers = titles.reduce((n, t) => n + t.history.length - 1, 0)
    stats.textContent = `${titles.length} issued · ${transfers} transfers since issue`
    if (!titles.length) {
      body.replaceChildren(muted('Nothing issued yet.'))
      return
    }
    const rows = titles.map((t) => {
      const when = el('td', { textContent: '…' })
      blockTime(client, t.issuedBlock)
        .then((d) => (when.textContent = formatTime(d)))
        .catch(() => (when.textContent = `block ${t.issuedBlock}`))
      const card = splitCard(t.card)
      const n = t.history.length - 1
      return el(
        'tr',
        {},
        el('td', {}, el('a', { href: consumerHref(titleHash(t.cert)), className: 'mono', textContent: t.cert })),
        el('td', {}, el('span', { textContent: card.name }), el('br'), el('small', { className: 'muted', textContent: card.detail })),
        el('td', { textContent: t.grade }),
        el('td', {}, addressLink(t.holder)),
        when,
        el('td', { className: 'num', textContent: String(n) }),
        el('td', {}, txLink(t.history[0].transactionHash)),
      )
    })
    body.replaceChildren(
      el(
        'div',
        { className: 'card table-wrap' },
        el(
          'table',
          { className: 'history' },
          el('thead', {}, el('tr', {}, ...['Cert', 'Card', 'Grade', 'Current holder', 'Issued', 'Transfers', 'Issue tx'].map((h) => el('th', { textContent: h })))),
          el('tbody', {}, ...rows),
        ),
      ),
      muted('From TitleIssued and TransferSingle events (getLogs). The cert links open the collector app, which resolves each title through ENS.'),
    )
  } catch (e) {
    if (!view.alive()) return
    stats.textContent = ''
    body.replaceChildren(errorText(`Could not read events: ${firstLine(e)}`))
  }
}
