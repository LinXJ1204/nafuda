// "Look up a cert" box: goes to the title page, which resolves the name through ENS.

import { el } from '../lib/dom.ts'
import { titleHash } from '../lib/routes.ts'

export function certSearch(placeholder = 'Cert number on the slab, e.g. 12345678') {
  const input = el('input', { type: 'text', inputMode: 'numeric', placeholder, id: 'cert-search' })
  const go = el('button', { className: 'primary', textContent: 'Look up' })
  const submit = () => {
    const cert = input.value.trim()
    if (cert) location.hash = titleHash(cert)
  }
  go.addEventListener('click', submit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit()
  })
  return el('div', { className: 'row search' }, input, go)
}
