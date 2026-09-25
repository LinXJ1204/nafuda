// The buyer check on a title page: which physical slab is in the seller's hand (simulated),
// who the seller is, then tap: the chip signs a fresh challenge and the page checks it against
// the chip address on ENS, and the seller against the holder on ENS.
//
// A chip signature is proof, never authorization: nothing here changes any state.

import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { SimulatedChip } from '../lib/chip.ts'
import { DEMO_ACCOUNTS, DEMO_SLABS, GRADER_LABEL } from '../lib/config.ts'
import { accountLabel, addressLink, busy, el, firstLine, kv, muted, short } from '../lib/dom.ts'
import type { TitleView } from '../lib/ens.ts'
import {
  OUTCOME_TEXT,
  checkChip,
  classify,
  makeChallenge,
  makeSellerChallenge,
  type Challenge,
  type ChipCheck,
  type Outcome,
} from '../lib/verify.ts'
import { sellerSigns } from '../lib/wallet.ts'

type Tap = { challenge: Challenge; signature: Hex }

export function verifierPanel(cert: string, title: TitleView): HTMLElement {
  const slab = DEMO_SLABS[cert]
  let variant: 'genuine' | 'clone' = 'genuine'
  let lastTap: Tap | null = null

  // Step 1: the slab in the seller's hand (simulated)
  const choices = el('div', { className: 'choices' })
  const option = (v: 'genuine' | 'clone', heading: string, detail: string) => {
    const input = el('input', { type: 'radio', name: `slab-${cert}`, value: v, checked: variant === v })
    input.addEventListener('change', () => (variant = v))
    return el('label', { className: 'choice' }, input, el('span', {}, el('strong', { textContent: heading }), el('small', { textContent: detail })))
  }
  if (slab) {
    choices.append(
      option('genuine', 'Genuine slab', `The slab PSA-Sim sealed for #${cert}. Its chip key: ${short(slab.genuine.address)}.`),
      option('clone', 'Clone slab', `A counterfeit with the same cert #${cert} printed on the label. Its chip is a different key: ${short(slab.clone.address)}.`),
    )
  } else {
    choices.append(muted('No simulated slab exists for this cert, so there is nothing to tap. Try a cert issued from the grader console.'))
  }

  // Step 2: who is selling
  const sellerInput = el('input', { type: 'text', placeholder: '0x…', id: `seller-${cert}` })
  const sellerNote = el('p', { className: 'muted' })
  const picks = el('div', { className: 'row' })
  for (const [name, address] of Object.entries(DEMO_ACCOUNTS)) {
    const b = el('button', { className: 'chip', textContent: name })
    b.addEventListener('click', () => {
      sellerInput.value = address
      sellerNote.textContent = `Typed in: ${name}. Anyone can claim an address; the wallet button proves it.`
    })
    picks.append(b)
  }
  const proveButton = el('button', { textContent: 'Seller proves it with their wallet' })
  proveButton.addEventListener('click', () =>
    busy(proveButton, async () => {
      try {
        const signer = await sellerSigns(makeSellerChallenge(GRADER_LABEL, cert).message)
        sellerInput.value = signer
        sellerNote.textContent = `Verified: ${accountLabel(signer)} signed a fresh challenge with their wallet.`
      } catch (e) {
        sellerNote.textContent = `Wallet: ${firstLine(e)}`
      }
    }),
  )
  const seller = (): Address | null => {
    const v = sellerInput.value.trim()
    return isAddress(v) ? getAddress(v) : null
  }

  // Tap and result
  const result = el('div', {})
  const tapButton = el('button', { className: 'primary tap', textContent: 'Tap the slab and verify' })

  function renderOutcome(outcome: Outcome, check: ChipCheck | null, detail: Tap | null, note?: string) {
    const text = OUTCOME_TEXT[outcome]
    const s = seller()
    const box = el('div', { className: `outcome ${text.tone}` }, el('h3', { textContent: text.title }), el('p', { textContent: text.body }))
    if (note) box.append(muted(note))

    if (title.status === 'ISSUED' && check) {
      const chipLine = check.ok ? '✓ Chip matches the ENS record' : `✗ Chip check failed (${check.reason})`
      const holderLine = !s
        ? '? No seller address given'
        : title.holder && s.toLowerCase() === title.holder.toLowerCase()
          ? '✓ Seller is the title holder'
          : '✗ Seller is not the title holder'
      box.append(el('div', { className: 'checks' }, el('span', { textContent: chipLine }), el('span', { textContent: holderLine })))
    }

    if (detail) {
      box.append(
        el(
          'details',
          {},
          el('summary', { textContent: 'What was checked' }),
          kv([
            ['Challenge', el('span', { className: 'mono', textContent: detail.challenge.message })],
            ['Signature', el('span', { className: 'mono', textContent: short(detail.signature) })],
            ['Signed by', check && 'signer' in check && check.signer ? addressLink(check.signer) : '—'],
            ['Chip on ENS', addressLink(title.chip)],
            ['Holder on ENS', addressLink(title.holder)],
            ['Seller', addressLink(s)],
          ]),
        ),
      )
    }

    if (lastTap) {
      const replay = el('button', { textContent: 'Attack: replay this signature against a new challenge' })
      replay.addEventListener('click', () => busy(replay, replayLastTap))
      box.append(el('div', { className: 'row actions' }, replay))
    }
    result.replaceChildren(box)
  }

  async function tap() {
    if (title.status !== 'ISSUED' || !title.chip) {
      lastTap = null
      renderOutcome(classify(title, null, seller()), null, null)
      return
    }
    if (!slab) {
      result.replaceChildren(el('p', { className: 'error', textContent: 'No simulated slab to tap for this cert.' }))
      return
    }
    const chip = new SimulatedChip(slab[variant].privateKey)
    const challenge = makeChallenge(GRADER_LABEL, cert)
    const signature = await chip.sign(challenge.message)
    const check = await checkChip(challenge, signature, title.chip)
    lastTap = { challenge, signature }
    renderOutcome(classify(title, check, seller()), check, lastTap)
  }

  async function replayLastTap() {
    if (!title.chip || !lastTap) return
    const fresh = makeChallenge(GRADER_LABEL, cert)
    const check = await checkChip(fresh, lastTap.signature, title.chip)
    renderOutcome(
      classify(title, check, seller()),
      check,
      { challenge: fresh, signature: lastTap.signature },
      'Replayed an earlier chip signature against a new challenge: it no longer proves anything.',
    )
  }

  tapButton.addEventListener('click', () => busy(tapButton, tap))

  return el(
    'section',
    { className: 'card verifier', id: 'verify' },
    el('h2', { textContent: 'Check this slab before you buy' }),
    muted('At a card show: tap the slab with your phone, and check the seller against the title holder on ENS.'),
    el(
      'div',
      { className: 'grid' },
      el(
        'div',
        {},
        el('h3', {}, el('span', { className: 'step', textContent: '1' }), ' The slab in the seller’s hand ', el('span', { className: 'sim-badge', textContent: 'SIMULATED' })),
        choices,
      ),
      el(
        'div',
        {},
        el('h3', {}, el('span', { className: 'step', textContent: '2' }), ' Who is selling?'),
        picks,
        el('label', { textContent: 'Seller address', htmlFor: `seller-${cert}` }),
        sellerInput,
        el('div', { className: 'row actions' }, proveButton),
        sellerNote,
      ),
    ),
    tapButton,
    result,
  )
}
