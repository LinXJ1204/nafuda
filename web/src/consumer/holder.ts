// My titles (#/me) and any address's titles (#/holder/<address>), from the event index:
// what the address holds now, and what it held before and sold on.

import { isAddressEqual, type Address } from 'viem'
import { DEMO_ACCOUNTS } from '../lib/config.ts'
import { accountLabel, addressLink, busy, el, errorText, firstLine, muted } from '../lib/dom.ts'
import { titleIndex } from '../lib/index-store.ts'
import { holderHash } from '../lib/routes.ts'
import type { View } from '../lib/view.ts'
import { connect, watchAccount } from '../lib/wallet.ts'
import { titleGrid } from './gallery.ts'

async function holdings(view: View, target: HTMLElement, address: Address) {
  target.replaceChildren(muted('Reading titles…'))
  try {
    const titles = await titleIndex()
    if (!view.alive()) return
    const held = titles.filter((t) => isAddressEqual(t.holder, address))
    const past = titles.filter((t) => !isAddressEqual(t.holder, address) && t.history.some((h) => isAddressEqual(h.to, address)))
    target.replaceChildren(
      el('div', { className: 'section-head' }, el('h2', { textContent: 'Holds now' }), el('p', { className: 'stats', textContent: String(held.length) })),
      held.length ? titleGrid(held) : muted('No titles.'),
    )
    if (past.length) {
      target.append(
        el('div', { className: 'section-head' }, el('h2', { textContent: 'Held before' }), el('p', { className: 'stats', textContent: 'transferred to someone else since' })),
        titleGrid(past),
      )
    }
  } catch (e) {
    if (view.alive()) target.replaceChildren(errorText(`Could not read titles: ${firstLine(e)}`))
  }
}

export function holderPage(view: View, address: Address) {
  const body = el('div', {})
  view.main.append(
    el('p', { className: 'crumbs' }, el('a', { href: '#/', textContent: '← Explore' })),
    el('h1', { textContent: `Titles of ${accountLabel(address)}` }),
    el('p', { className: 'muted' }, addressLink(address)),
    body,
  )
  void holdings(view, body, address)
}

export function myTitlesPage(view: View) {
  const head = el('div', {})
  const body = el('div', {})
  view.main.append(el('h1', { textContent: 'My titles' }), head, body)
  view.onLeave(
    watchAccount((account) => {
      if (account) {
        head.replaceChildren(el('p', { className: 'muted' }, 'Connected as ', addressLink(account), '. ', el('a', { href: holderHash(account), textContent: 'Shareable link' })))
        void holdings(view, body, account)
        return
      }
      const b = el('button', { className: 'primary', textContent: 'Connect wallet' })
      const note = el('span', { className: 'muted' })
      b.addEventListener('click', () =>
        busy(b, async () => {
          try {
            await connect()
          } catch (e) {
            note.textContent = firstLine(e)
          }
        }),
      )
      head.replaceChildren(
        muted('Connect your wallet to see the titles you hold.'),
        el('div', { className: 'row' }, b, note),
        el(
          'p',
          { className: 'muted' },
          'Or look at a demo collector: ',
          ...Object.entries(DEMO_ACCOUNTS).flatMap(([name, a], i) => [i ? ' · ' : '', el('a', { href: holderHash(a), textContent: name })]),
        ),
      )
      body.replaceChildren()
    }),
  )
}
