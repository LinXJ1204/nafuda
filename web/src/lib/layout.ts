// Page shell shared by the consumer page (/) and the grader console (/grader/):
// header with navigation and wallet, the demo notice, and the footer.

import { GRADER_NAME, PSA_REGISTRY, TITLE_CONTROLLER } from './config.ts'
import { $, accountLabel, addressLink, busy, el, external, firstLine } from './dom.ts'
import { connect, restoreAccount, watchAccount } from './wallet.ts'

const BASE: string = import.meta.env.BASE_URL
export const consumerHref = (hash = '#/') => `${BASE}${hash}`
export const graderHref = (hash = '#/') => `${BASE}grader/${hash}`

function seal() {
  const s = el('span', { className: 'seal', textContent: '名札' })
  s.setAttribute('aria-hidden', 'true')
  return s
}

export type NavItem = { key: string; label: string; hash: string }

export type Shell = {
  main: HTMLElement
  setActive(key: string | null): void
}

export function mountShell(opts: {
  side: 'consumer' | 'grader'
  brand: string
  tagline: string
  nav: NavItem[]
  cross: { label: string; href: string }
}): Shell {
  document.body.classList.add(opts.side)

  const links = opts.nav.map((item) => {
    const a = el('a', { href: item.hash, textContent: item.label })
    a.dataset.key = item.key
    return a
  })
  const walletButton = el('button', { className: 'wallet', textContent: 'Connect wallet' })
  walletButton.addEventListener('click', () =>
    busy(walletButton, async () => {
      try {
        await connect()
      } catch (e) {
        walletButton.title = firstLine(e)
      }
    }),
  )
  watchAccount((a) => {
    walletButton.textContent = a ? accountLabel(a) : 'Connect wallet'
    walletButton.classList.toggle('connected', !!a)
  })

  const header = el(
    'header',
    { className: 'topbar' },
    el(
      'a',
      { className: 'brand', href: '#/' },
      seal(),
      el('span', {}, el('strong', { textContent: opts.brand }), el('small', { textContent: opts.tagline })),
    ),
    el('nav', {}, ...links, el('a', { className: 'cross', href: opts.cross.href, textContent: opts.cross.label })),
    el('div', { className: 'topbar-end' }, el('span', { className: 'network', textContent: 'Sepolia · ENSv2 Beta' }), walletButton),
  )

  const notice = el(
    'p',
    { className: 'notice' },
    'Demo on Sepolia. ',
    el('strong', { textContent: 'PSA-Sim' }),
    " is a simulated grader modeled after PSA's cert format and flow; it is not affiliated with or endorsed by PSA. Slab chips are ",
    el('strong', { textContent: 'simulated' }),
    ' in the browser; in production the grader seals an NFC chip (such as Arx HaLo) inside the slab. Card names are original placeholders.',
  )

  const main = el('main', { id: 'view' })
  const footer = el(
    'footer',
    {},
    el(
      'p',
      {},
      'Names: ',
      el('span', { className: 'mono', textContent: `<cert>.${GRADER_NAME}` }),
      ' · grader registry (emancipated) ',
      addressLink(PSA_REGISTRY),
      ' · TitleController ',
      addressLink(TITLE_CONTROLLER),
    ),
    el('p', {}, 'Source: ', external('https://github.com/LinXJ1204/nafuda', 'github.com/LinXJ1204/nafuda'), ' · Built at ETHGlobal Tokyo 2026.'),
  )

  $('app').replaceChildren(header, el('div', { className: 'page' }, notice, main, footer))
  void restoreAccount()

  return {
    main,
    setActive(key) {
      for (const a of links) {
        if (a.dataset.key === key) a.setAttribute('aria-current', 'page')
        else a.removeAttribute('aria-current')
      }
    },
  }
}
