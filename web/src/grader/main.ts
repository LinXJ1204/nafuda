// Grader console (/grader/) for the simulated grader PSA-Sim: issue titles, list what was
// issued, and show the on-chain guarantees (what the grader can and cannot do).

import '../style.css'
import { el, muted } from '../lib/dom.ts'
import { consumerHref, mountShell } from '../lib/layout.ts'
import { graderRoute } from '../lib/routes.ts'

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

function render() {
  const route = graderRoute(location.hash)
  shell.setActive(route.view === 'not-found' ? null : route.view)
  window.scrollTo(0, 0)
  if (route.view === 'not-found') {
    shell.main.replaceChildren(el('h1', { textContent: 'Page not found' }), el('p', {}, el('a', { href: '#/issue', textContent: 'Back to Issue' })))
    return
  }
  shell.main.replaceChildren(el('h1', { textContent: route.view }), muted('Coming next.'))
}

window.addEventListener('hashchange', render)
render()
