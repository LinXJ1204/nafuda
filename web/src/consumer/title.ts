// Title page (#/title/<cert>): the slab, its title as resolved through ENS (the authoritative
// read), the buyer check, the transfer history from on-chain events, and a transfer form for
// the holder.

import { getAddress, isAddress, isAddressEqual, type Address } from 'viem'
import { DEMO_ACCOUNTS, GRADER_NAME, PSA_REGISTRY, UNIVERSAL_RESOLVER } from '../lib/config.ts'
import { accountLabel, addressLink, busy, el, errorText, external, firstLine, formatTime, kv, muted, scan, txLink } from '../lib/dom.ts'
import { isCanonicalCert, lookupTitle, type TitleView } from '../lib/ens.ts'
import { blockTime, type IndexedTitle } from '../lib/events.ts'
import { client } from '../lib/ens.ts'
import { titleIndex } from '../lib/index-store.ts'
import { holderHash } from '../lib/routes.ts'
import { slabArt, splitCard } from '../lib/slab-art.ts'
import type { View } from '../lib/view.ts'
import { connect, transferTitle, watchAccount } from '../lib/wallet.ts'
import { certSearch } from './search.ts'
import { verifierPanel } from './verifier.ts'

export async function titlePage(view: View, cert: string, rerender: () => void) {
  const back = el('p', { className: 'crumbs' }, el('a', { href: '#/', textContent: '← Explore' }))
  if (!isCanonicalCert(cert)) {
    view.main.append(
      back,
      el('h1', { textContent: 'Not a cert number' }),
      muted('A PSA-Sim cert number is 1–10 digits with no leading zero, the same rule the TitleController enforces on chain.'),
      certSearch(),
    )
    return
  }

  view.main.append(back, muted(`Resolving ${cert}.${GRADER_NAME} through the ENSv2 Universal Resolver…`))
  let title: TitleView
  try {
    title = await lookupTitle(cert)
  } catch (e) {
    if (!view.alive()) return
    view.main.replaceChildren(back, errorText(`Lookup failed: ${firstLine(e)}`))
    return
  }
  if (!view.alive()) return

  const history = el('div', {}, muted('Reading events…'))
  view.main.replaceChildren(
    back,
    hero(view, cert, title, rerender),
    verifierPanel(cert, title),
    el('section', { className: 'card' }, el('h2', { textContent: 'History' }), history),
    snippetCard(cert),
  )

  try {
    const entry = (await titleIndex()).find((t) => t.cert === cert)
    if (view.alive()) history.replaceChildren(historyTable(entry, title))
  } catch (e) {
    if (view.alive()) history.replaceChildren(errorText(`Could not read events: ${firstLine(e)}`))
  }
}

function hero(view: View, cert: string, title: TitleView, rerender: () => void) {
  const issued = title.status === 'ISSUED'
  const card = splitCard(title.card ?? '')
  const art = issued
    ? slabArt({ cert, card: title.card ?? '', grade: title.grade ?? '' })
    : el('div', { className: 'slab-empty', textContent: 'No title on ENS' })

  const facts = el(
    'div',
    { className: 'facts' },
    el(
      'p',
      { className: 'badges' },
      el('span', { className: `status ${title.status}`, textContent: issued ? 'ISSUED' : 'NO TITLE' }),
      el('span', { className: 'badge', textContent: 'resolved via ENS' }),
    ),
    el('p', { className: 'ens-name mono', textContent: title.name }),
    el('h1', { textContent: issued ? card.name : `Cert #${cert}` }),
  )

  if (!issued) {
    facts.append(
      muted('PSA-Sim has not issued a title for this cert. It could be a slab from a grader that does not take part, or an older slab without a chip. Nafuda cannot tell either way.'),
      kv([['Grader', title.grader ?? '—']]),
    )
    return el('section', { className: 'title-hero' }, el('div', { className: 'art' }, art), facts)
  }

  facts.append(
    el('p', { className: 'lede', textContent: [card.detail, title.grade].filter(Boolean).join(' · ') }),
    kv([
      ['Holder', el('span', {}, addressLink(title.holder), ' ', title.holder ? el('a', { href: holderHash(title.holder), className: 'small', textContent: 'all titles' }) : '')],
      ['Slab chip', addressLink(title.chip)],
      ['Grade', title.grade ?? '—'],
      ['Issued', formatTime(title.issuedAt)],
      ['Grader', title.grader ?? '—'],
      ['Registry', external(scan('address', PSA_REGISTRY), `${GRADER_NAME} (ERC-1155)`, 'mono')],
    ]),
    transferPanel(view, cert, title, rerender),
  )
  return el('section', { className: 'title-hero' }, el('div', { className: 'art' }, art), facts)
}

/// The holder transfers the title (ERC-1155 safeTransferFrom). Only shown as a form to the holder.
function transferPanel(view: View, cert: string, title: TitleView, rerender: () => void) {
  const box = el('div', { className: 'transfer' })
  const holder = title.holder

  const render = (account: Address | null) => {
    if (!holder) {
      box.replaceChildren()
      return
    }
    if (!account) {
      const b = el('button', { textContent: 'Connect wallet' })
      b.addEventListener('click', () => busy(b, async () => void (await connect().catch(() => undefined))))
      box.replaceChildren(el('h3', { textContent: 'Transfer this title' }), muted('Holder? Connect your wallet to transfer the title to the buyer.'), b)
      return
    }
    if (!isAddressEqual(account, holder)) {
      box.replaceChildren(
        el('h3', { textContent: 'Transfer this title' }),
        muted(`Connected as ${accountLabel(account)}. Only the holder, ${accountLabel(holder)}, can transfer this title.`),
      )
      return
    }
    const input = el('input', { type: 'text', id: 'transfer-to', value: isAddressEqual(holder, DEMO_ACCOUNTS.alice) ? DEMO_ACCOUNTS.bob : DEMO_ACCOUNTS.alice })
    const note = el('p', { className: 'muted' })
    const send = el('button', { className: 'primary', textContent: 'Transfer title' })
    send.addEventListener('click', () =>
      busy(send, async () => {
        const to = input.value.trim()
        if (!isAddress(to)) {
          note.textContent = 'Enter the buyer address.'
          return
        }
        if (isAddressEqual(to, holder)) {
          note.textContent = 'That is already the holder.'
          return
        }
        try {
          note.textContent = 'Confirm in your wallet…'
          const hash = await transferTitle(cert, getAddress(to))
          note.replaceChildren('Transferred: ', txLink(hash), '. Reloading…')
          await titleIndex(true)
          if (view.alive()) rerender()
        } catch (e) {
          note.textContent = `Transfer failed: ${firstLine(e)}`
        }
      }),
    )
    box.replaceChildren(
      el('h3', { textContent: 'Transfer this title' }),
      muted('You hold this title. After the buyer has checked the slab and paid, send the title to them. It is an ERC-1155 safeTransferFrom on the grader registry.'),
      el('label', { textContent: 'Buyer address', htmlFor: 'transfer-to' }),
      el('div', { className: 'row' }, input, send),
      note,
    )
  }

  view.onLeave(watchAccount(render))
  return box
}

function historyTable(entry: IndexedTitle | undefined, title: TitleView) {
  if (!entry) {
    return muted(title.status === 'ISSUED' ? 'No events found yet (the RPC may be a few blocks behind). Reload in a moment.' : 'No events: this cert was never issued.')
  }
  const rows = [...entry.history].reverse().map((h) => {
    const when = el('td', { textContent: '…' })
    blockTime(client, h.blockNumber)
      .then((d) => (when.textContent = formatTime(d)))
      .catch(() => (when.textContent = `block ${h.blockNumber}`))
    return el(
      'tr',
      {},
      el('td', {}, el('span', { className: `event ${h.kind}`, textContent: h.kind === 'issued' ? 'Issued' : 'Transfer' })),
      el('td', {}, h.from ? addressLink(h.from) : el('span', { className: 'muted', textContent: 'PSA-Sim' })),
      el('td', {}, addressLink(h.to)),
      when,
      el('td', {}, txLink(h.transactionHash)),
    )
  })
  const table = el(
    'table',
    { className: 'history' },
    el('thead', {}, el('tr', {}, ...['Event', 'From', 'To', 'When', 'Tx'].map((t) => el('th', { textContent: t })))),
    el('tbody', {}, ...rows),
  )
  const parts: Node[] = [el('div', { className: 'table-wrap' }, table)]
  if (title.holder && !isAddressEqual(entry.holder, title.holder)) {
    parts.push(muted('The event history is a few blocks behind ENS resolution. ENS is the authoritative answer; reload in a moment.'))
  }
  parts.push(muted(`From on-chain events (TitleIssued, TransferSingle) read with getLogs. No indexer, no database. ${entry.history.length - 1} transfer(s).`))
  return el('div', {}, ...parts)
}

function snippetCard(cert: string) {
  const code = [
    `import { createPublicClient, http } from 'viem'`,
    `import { sepolia } from 'viem/chains'`,
    ``,
    `const client = createPublicClient({ chain: sepolia, transport: http() })`,
    `const name = '${cert}.${GRADER_NAME}'`,
    `const universalResolverAddress = '${UNIVERSAL_RESOLVER}' // ENSv2 Beta`,
    ``,
    `await client.getEnsAddress({ name, universalResolverAddress })               // current holder`,
    `await client.getEnsText({ name, key: 'slab.chip', universalResolverAddress })  // chip address`,
  ].join('\n')
  return el(
    'section',
    { className: 'card' },
    el('h2', { textContent: 'Any ENS client can read it' }),
    muted('No Nafuda API. The facts above come from exactly this:'),
    el('pre', { textContent: code }),
  )
}
