// Consumer app (/): browse titles, open a title page (verify the slab, see its history,
// transfer it), and list the titles an address holds. Hash routes, see lib/routes.ts.

import '../style.css'
import { el, muted } from '../lib/dom.ts'
import { graderHref, mountShell } from '../lib/layout.ts'
import { consumerRoute } from '../lib/routes.ts'

const shell = mountShell({
  side: 'consumer',
  brand: 'Nafuda',
  tagline: 'Every slab wears its name.',
  nav: [
    { key: 'explore', label: 'Explore', hash: '#/' },
    { key: 'me', label: 'My titles', hash: '#/me' },
  ],
  cross: { label: 'Grader console →', href: graderHref() },
})

function render() {
  const route = consumerRoute(location.hash)
  shell.setActive(route.view === 'explore' || route.view === 'me' ? route.view : null)
  window.scrollTo(0, 0)
  switch (route.view) {
    case 'explore':
    case 'title':
    case 'holder':
    case 'me':
      shell.main.replaceChildren(el('h1', { textContent: route.view }), muted('Coming next.'))
      return
    case 'not-found':
      shell.main.replaceChildren(el('h1', { textContent: 'Page not found' }), el('p', {}, el('a', { href: '#/', textContent: 'Back to Explore' })))
  }
}

window.addEventListener('hashchange', render)
render()
