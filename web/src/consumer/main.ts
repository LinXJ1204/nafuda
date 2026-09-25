// Consumer app (/): browse titles, open a title page (verify the slab, see its history,
// transfer it), and list the titles an address holds. Hash routes, see lib/routes.ts.

import '../style.css'
import { el, muted } from '../lib/dom.ts'
import { graderHref, mountShell } from '../lib/layout.ts'
import { consumerRoute } from '../lib/routes.ts'
import { viewRunner } from '../lib/view.ts'
import { certSearch } from './search.ts'
import { titlePage } from './title.ts'

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
const nextView = viewRunner(shell.main)

function render() {
  const route = consumerRoute(location.hash)
  const view = nextView()
  shell.setActive(route.view === 'explore' || route.view === 'me' ? route.view : null)
  switch (route.view) {
    case 'title':
      void titlePage(view, route.cert, render)
      return
    case 'explore':
    case 'holder':
    case 'me':
      view.main.append(el('h1', { textContent: 'Look up a slab' }), certSearch(), muted('The gallery is coming next.'))
      return
    case 'not-found':
      view.main.append(el('h1', { textContent: 'Page not found' }), el('p', {}, el('a', { href: '#/', textContent: 'Back to Explore' })))
  }
}

window.addEventListener('hashchange', render)
render()
