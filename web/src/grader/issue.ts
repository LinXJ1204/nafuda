// Issue view (#/issue): the grader picks a sealed slab from the bench, fills in the card and grade,
// names the submitter as holder, and issues the title. Every precondition the contract enforces
// is checked before the wallet is asked to sign, so a doomed transaction is never sent.

import { isAddressEqual, zeroAddress, type Address, type Hash } from 'viem'
import { CHIP_POOL, DEMO_ACCOUNTS, DEMO_SLABS, GRADER_NAME, TITLE_CONTROLLER } from '../lib/config.ts'
import { controllerAbi, revertName } from '../lib/contracts.ts'
import { addressLink, busy, el, errorText, firstLine, muted, txLink } from '../lib/dom.ts'
import { client } from '../lib/ens.ts'
import { titleIndex } from '../lib/index-store.ts'
import { consumerHref } from '../lib/layout.ts'
import { titleHash } from '../lib/routes.ts'
import { slabArt } from '../lib/slab-art.ts'
import type { View } from '../lib/view.ts'
import { connect, watchAccount } from '../lib/wallet.ts'
import { graderAddress, graderStatus } from './grader.ts'
import { GRADES, MAX_CARD_LENGTH, precheck, type IssueForm } from './rules.ts'

export async function issuePage(view: View) {
  view.main.append(
    el('h1', { textContent: 'Issue a title' }),
    muted(
      `After grading, the slab is sealed with its NFC chip. Issuing writes the title <cert>.${GRADER_NAME} on ENS: the holder is the submitter, and slab.chip is the chip's address. Once issued, nobody can change or revoke it, including PSA-Sim.`,
    ),
  )
  const status = el('div', { className: 'grader-status' }, muted('Checking the grader account…'))
  const body = el('div', { className: 'issue-layout' })
  view.main.append(status, body)

  let grader: Address
  try {
    grader = await graderAddress()
  } catch (e) {
    if (view.alive()) status.replaceChildren(errorText(`Could not read TitleController.GRADER(): ${firstLine(e)}`))
    return
  }
  if (!view.alive()) return

  let account: Address | null = null
  view.onLeave(
    watchAccount((a) => {
      account = a
      status.replaceChildren(graderStatus(a, grader))
    }),
  )

  // Which bench slabs already have a title (from events; re-checked on chain before sending)
  let issued = new Set<string>()
  try {
    issued = new Set((await titleIndex()).map((t) => t.cert))
  } catch {
    // the per-cert holderOf check before sending still protects against duplicates
  }
  if (!view.alive()) return

  const certs = Object.keys(DEMO_SLABS).sort()
  let selected = certs.find((c) => CHIP_POOL[c] && !issued.has(c)) ?? certs[0]

  const bench = el('div', { className: 'bench' })
  const preview = el('div', { className: 'preview' })
  const cardInput = el('input', { type: 'text', id: 'issue-card', maxLength: MAX_CARD_LENGTH })
  const gradeSelect = el('select', { id: 'issue-grade' }, ...GRADES.map((g) => el('option', { value: g, textContent: g })))
  const holderInput = el('input', { type: 'text', id: 'issue-holder', value: DEMO_ACCOUNTS.alice })
  const chipLine = el('p', { className: 'mono chip-line' })
  const certLine = el('p', { className: 'cert-line' })
  const issueButton = el('button', { className: 'primary tap', textContent: 'Issue title' })
  const result = el('div', { className: 'issue-result' })

  const picks = el('div', { className: 'row' })
  for (const [name, address] of Object.entries(DEMO_ACCOUNTS)) {
    const b = el('button', { className: 'chip', textContent: name })
    b.addEventListener('click', () => (holderInput.value = address))
    picks.append(b)
  }

  const form = (): IssueForm => ({
    cert: selected,
    card: cardInput.value,
    grade: gradeSelect.value,
    holder: holderInput.value.trim(),
    chip: DEMO_SLABS[selected].genuine.address,
  })

  function renderPreview() {
    const f = form()
    preview.replaceChildren(slabArt({ cert: f.cert, card: f.card || ' ', grade: f.grade, size: 'small' }))
  }

  function select(cert: string) {
    selected = cert
    const slab = DEMO_SLABS[cert]
    cardInput.value = slab.card
    gradeSelect.value = slab.grade
    certLine.replaceChildren(el('strong', { textContent: `#${cert}` }), ` → ${cert}.${GRADER_NAME}`)
    chipLine.textContent = `${slab.genuine.address}`
    result.replaceChildren()
    renderBench()
    renderPreview()
  }

  function renderBench() {
    bench.replaceChildren(
      ...certs.map((cert) => {
        const done = issued.has(cert)
        const item = el(
          'button',
          { className: `bench-item${cert === selected ? ' selected' : ''}${done ? ' done' : ''}` },
          el('span', { className: 'mono', textContent: `#${cert}` }),
          el('span', { className: 'bench-card', textContent: DEMO_SLABS[cert].card.replace(/\s*\(demo card\)$/, '') }),
          el('span', { className: `pill ${done ? 'issued' : 'waiting'}`, textContent: done ? 'Issued' : 'Awaiting title' }),
        )
        item.addEventListener('click', () => select(cert))
        return item
      }),
    )
  }

  cardInput.addEventListener('input', renderPreview)
  gradeSelect.addEventListener('change', renderPreview)

  issueButton.addEventListener('click', () =>
    busy(issueButton, async () => {
      const f = form()
      result.replaceChildren(muted('Checking on chain…'))
      try {
        const heldBy = await client.readContract({ address: TITLE_CONTROLLER, abi: controllerAbi, functionName: 'holderOf', args: [f.cert] })
        const reason = precheck(f, account, grader, heldBy)
        if (reason) {
          const box = el('div', { className: 'outcome bad' }, el('h3', { textContent: 'Not sent' }), el('p', { textContent: reason }))
          if (!isAddressEqual(heldBy, zeroAddress)) box.append(el('p', {}, el('a', { href: consumerHref(titleHash(f.cert)), textContent: 'See the existing title →' })))
          result.replaceChildren(box)
          return
        }
        const args = [f.cert, f.holder as Address, f.chip, f.card.trim(), f.grade] as const
        await client.simulateContract({ account: account!, address: TITLE_CONTROLLER, abi: controllerAbi, functionName: 'issue', args })
        result.replaceChildren(muted('Confirm in your wallet…'))
        const { wallet, account: from } = await connect()
        const hash: Hash = await wallet.writeContract({ account: from, address: TITLE_CONTROLLER, abi: controllerAbi, functionName: 'issue', args })
        result.replaceChildren(el('p', { className: 'muted' }, 'Sent ', txLink(hash), '. Waiting for the block…'))
        const receipt = await client.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error(`issue reverted: ${hash}`)
        issued.add(f.cert)
        void titleIndex(true)
        renderBench()
        result.replaceChildren(
          el(
            'div',
            { className: 'outcome ok' },
            el('h3', { textContent: `Title issued: ${f.cert}.${GRADER_NAME}` }),
            el('p', {}, 'Holder ', addressLink(f.holder as Address), ', chip ', addressLink(f.chip), '. Transaction ', txLink(hash), '.'),
            el('p', {}, el('a', { href: consumerHref(titleHash(f.cert)), textContent: 'Open it in the collector app and tap the slab →' })),
          ),
        )
      } catch (e) {
        const name = revertName(e)
        result.replaceChildren(errorText(name ? `The contract would revert with ${name}.` : `Failed: ${firstLine(e)}`))
      }
    }),
  )

  body.append(
    el(
      'section',
      { className: 'card' },
      el('h2', { textContent: 'Slabs on the bench' }),
      muted('Graded and sealed, chip inside. Simulated: in production the console reads the chip address by tapping the slab.'),
      bench,
    ),
    el(
      'section',
      { className: 'card issue-form' },
      el('h2', { textContent: 'Title' }),
      el('div', { className: 'issue-grid' }, preview,
        el(
          'div',
          {},
          certLine,
          el('label', { textContent: 'Slab chip (read from the sealed chip)' }),
          chipLine,
          el('label', { textContent: 'Card', htmlFor: 'issue-card' }),
          cardInput,
          el('label', { textContent: 'Grade', htmlFor: 'issue-grade' }),
          gradeSelect,
          el('label', { textContent: 'Holder (the submitter)', htmlFor: 'issue-holder' }),
          holderInput,
          picks,
        ),
      ),
      issueButton,
      result,
    ),
  )
  select(selected)
}
