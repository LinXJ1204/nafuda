// Who the grader is, read from the chain (TitleController.GRADER), and how the connected
// wallet compares to it.

import { isAddressEqual, type Address } from 'viem'
import { TITLE_CONTROLLER } from '../lib/config.ts'
import { controllerAbi } from '../lib/contracts.ts'
import { addressLink, busy, el, firstLine } from '../lib/dom.ts'
import { client } from '../lib/ens.ts'
import { connect } from '../lib/wallet.ts'

let cached: Promise<Address> | null = null

export function graderAddress(): Promise<Address> {
  if (!cached) {
    cached = client.readContract({ address: TITLE_CONTROLLER, abi: controllerAbi, functionName: 'GRADER' })
    cached.catch(() => (cached = null))
  }
  return cached
}

export function graderStatus(account: Address | null, grader: Address): HTMLElement {
  if (!account) {
    const b = el('button', { textContent: 'Connect the grader wallet' })
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
    return el('div', { className: 'status-box none' }, el('span', {}, 'Not connected. The grader is ', addressLink(grader), '.'), b, note)
  }
  if (isAddressEqual(account, grader)) {
    return el('div', { className: 'status-box ok' }, el('span', {}, '✓ Connected as the PSA-Sim grader ', addressLink(account)))
  }
  return el(
    'div',
    { className: 'status-box bad' },
    el('span', {}, '✗ Connected as ', addressLink(account), ', which is not the grader (', addressLink(grader), '). Issuing is blocked.'),
  )
}
