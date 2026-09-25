// Grader console (/grader/) for the simulated grader PSA-Sim: issue titles, list what was
// issued, and show the on-chain guarantees (what the grader can and cannot do).

import '../style.css'
import { el } from '../lib/dom.ts'
import { consumerHref, mountShell } from '../lib/layout.ts'
import { graderRoute } from '../lib/routes.ts'
import { viewRunner } from '../lib/view.ts'
import { issuePage } from './issue.ts'
import { issuedPage } from './issued.ts'
import { trustPage } from './trust.ts'

const shell = mountShell({
  side: 'grader',
  brand: 'PSA-Sim Grader Console',
  tagline: 'Simulated grader · issues Nafuda titles',
  nav: [
    { key: 'issue', label: 'Issue', hash: '#/issue' },
    { key: 'issued', label: 'Issued titles', hash: '#/issued' },
    { key: 'trust', label: 'Trust', hash: '#/trust' },
  ],
  cross: { label: '← Collector app', href: consumerHref() },
})
const nextView = viewRunner(shell.main)

function render() {
  const route = graderRoute(location.hash)
  const view = nextView()
  shell.setActive(route.view === 'not-found' ? null : route.view)
  switch (route.view) {
    case 'issue':
      void issuePage(view)
      return
    case 'issued':
      void issuedPage(view)
      return
    case 'trust':
      void trustPage(view)
      return
    case 'not-found':
      view.main.append(el('h1', { textContent: 'Page not found' }), el('p', {}, el('a', { href: '#/issue', textContent: 'Back to Issue' })))
  }
}

window.addEventListener('hashchange', render)
render()
