import '../style.css'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { SimulatedChip } from '../lib/chip.ts'
import { DEMO_ACCOUNTS, DEMO_SLABS, GRADER_LABEL, GRADER_NAME, PSA_REGISTRY, TITLE_CONTROLLER, UNIVERSAL_RESOLVER } from '../lib/config.ts'
import { isCanonicalCert, lookupTitle, type TitleView } from '../lib/ens.ts'
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
import { sellerSigns, transferTitle } from '../lib/wallet.ts'

////////////////////////////////////////////////////////////////////////
// Helpers (all chain data goes into the DOM through textContent, never innerHTML)
////////////////////////////////////////////////////////////////////////

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const scan = (kind: 'address' | 'tx', v: string) => `https://sepolia.etherscan.io/${kind}/${v}`
const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node, props)
  node.append(...children)
  return node
}

function accountLabel(address: Address | null): string {
  if (!address) return '—'
  const who = Object.entries(DEMO_ACCOUNTS).find(([, a]) => a.toLowerCase() === address.toLowerCase())?.[0]
  return who ? `${short(address)} (${who})` : short(address)
}

function addressLink(address: Address | null) {
  if (!address) return el('span', { textContent: '—' })
  return el('a', { href: scan('address', address), target: '_blank', rel: 'noreferrer', className: 'mono', textContent: accountLabel(address) })
}

function kv(rows: [string, Node | string][]) {
  const dl = el('dl', { className: 'kv' })
  for (const [k, v] of rows) dl.append(el('dt', { textContent: k }), el('dd', {}, v))
  return dl
}

async function busy(button: HTMLButtonElement, fn: () => Promise<void>) {
  button.disabled = true
  try {
    await fn()
  } finally {
    button.disabled = false
  }
}

////////////////////////////////////////////////////////////////////////
// Skeleton (static text only)
////////////////////////////////////////////////////////////////////////

$('app').innerHTML = `
<main>
  <header>
    <div class="seal" aria-hidden="true">名札</div>
    <div>
      <h1>Nafuda</h1>
      <p class="tagline">Every slab wears its name.</p>
    </div>
    <span class="network">Sepolia · ENSv2 Beta</span>
  </header>
  <p class="notice">
    Demo on Sepolia. <strong>PSA-Sim</strong> is a simulated grader modeled after PSA's cert format and flow; it is not
    affiliated with or endorsed by PSA. Slab chips are <strong>simulated</strong> in this page; in production the grader
    seals an NFC chip (such as Arx HaLo) inside the slab.
  </p>

  <section class="grid">
    <div class="card">
      <h2><span class="step">1</span> Look up the cert on the slab</h2>
      <div class="row">
        <input id="cert" type="text" inputmode="numeric" value="12345678" aria-label="Cert number" />
        <button id="lookup">Look up</button>
      </div>
      <div id="title-view"><p class="muted">Loading…</p></div>
    </div>

    <div class="card">
      <h2><span class="step">2</span> The slab in the seller's hand <span class="sim-badge">SIMULATED</span></h2>
      <div id="slab-choices" class="choices"></div>
    </div>

    <div class="card">
      <h2><span class="step">3</span> Who is selling?</h2>
      <div class="row" id="seller-picks"></div>
      <label for="seller">Seller address</label>
      <input id="seller" type="text" placeholder="0x…" />
      <div class="row" style="margin-top: 8px">
        <button id="seller-sign">Seller proves it with their wallet</button>
      </div>
      <p id="seller-note" class="muted"></p>
    </div>
  </section>

  <button id="tap" class="primary tap">Tap the slab and verify</button>
  <div id="result"></div>

  <section class="grid" style="margin-top: 16px">
    <div class="card">
      <h2><span class="step">4</span> Transfer the title (seller)</h2>
      <p class="muted">A sale is a transfer of the ENS name: the seller signs <span class="mono">safeTransferFrom</span> on the grader registry.</p>
      <label for="to">Buyer address</label>
      <div class="row">
        <input id="to" type="text" />
        <button id="transfer">Connect wallet &amp; transfer</button>
      </div>
      <p id="transfer-note" class="muted"></p>
    </div>

    <div class="card">
      <h2>Any ENS client can read it</h2>
      <p class="muted">No Nafuda API. This page does exactly this:</p>
      <pre id="snippet"></pre>
    </div>
  </section>

  <footer id="footer"></footer>
</main>`

$<HTMLInputElement>('to').value = DEMO_ACCOUNTS.bob

$('footer').append(
  el('p', {}, 'Names: ', el('span', { className: 'mono', textContent: `<cert>.${GRADER_NAME}` }), ' · grader registry (emancipated) ', addressLink(PSA_REGISTRY), ' · TitleController ', addressLink(TITLE_CONTROLLER)),
  el('p', {}, 'Source: ', el('a', { href: 'https://github.com/LinXJ1204/nafuda', target: '_blank', rel: 'noreferrer', textContent: 'github.com/LinXJ1204/nafuda' }), ' · Built at ETHGlobal Tokyo 2026.'),
)

////////////////////////////////////////////////////////////////////////
// State
////////////////////////////////////////////////////////////////////////

let cert = '12345678'
let title: TitleView | null = null
let slabVariant: 'genuine' | 'clone' = 'genuine'
let lastTap: { challenge: Challenge; signature: Hex } | null = null

function seller(): Address | null {
  const v = $<HTMLInputElement>('seller').value.trim()
  return isAddress(v) ? getAddress(v) : null
}

////////////////////////////////////////////////////////////////////////
// Step 1: look up the title
////////////////////////////////////////////////////////////////////////

function renderTitle(t: TitleView) {
  const status = el('span', { className: `status ${t.status}`, textContent: t.status === 'ISSUED' ? 'ISSUED' : 'NO TITLE' })
  const rows: [string, Node | string][] = [
    ['Name', el('span', { className: 'mono', textContent: t.name })],
    ['Title', status],
  ]
  if (t.status === 'ISSUED') {
    rows.push(
      ['Holder', addressLink(t.holder)],
      ['Card', t.card ?? '—'],
      ['Grade', t.grade ?? '—'],
      ['Slab chip', addressLink(t.chip)],
      ['Issued', t.issuedAt?.toLocaleString() ?? '—'],
    )
  }
  rows.push(['Grader', t.grader ?? '—'])
  $('title-view').replaceChildren(kv(rows))
}

function renderSnippet() {
  $('snippet').textContent = [
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
}

async function lookup() {
  const input = $<HTMLInputElement>('cert').value.trim()
  $('result').replaceChildren()
  lastTap = null
  if (!isCanonicalCert(input)) {
    title = null
    $('title-view').replaceChildren(el('p', { className: 'error', textContent: 'A cert number is 1–10 digits with no leading zero.' }))
    return
  }
  cert = input
  $('title-view').replaceChildren(el('p', { className: 'muted', textContent: 'Resolving through the ENSv2 Universal Resolver…' }))
  try {
    title = await lookupTitle(cert)
    renderTitle(title)
  } catch (e) {
    title = null
    $('title-view').replaceChildren(el('p', { className: 'error', textContent: `Lookup failed: ${(e as Error).message}` }))
  }
  renderSlabChoices()
  renderSnippet()
}

////////////////////////////////////////////////////////////////////////
// Step 2: which physical slab is in the seller's hand (simulated)
////////////////////////////////////////////////////////////////////////

function renderSlabChoices() {
  const slab = DEMO_SLABS[cert]
  if (!slab) {
    $('slab-choices').replaceChildren(el('p', { className: 'muted', textContent: 'No simulated slab for this cert. Try 12345678 or 12345679.' }))
    return
  }
  const option = (variant: 'genuine' | 'clone', heading: string, detail: string) => {
    const input = el('input', { type: 'radio', name: 'slab', value: variant, checked: slabVariant === variant })
    input.addEventListener('change', () => (slabVariant = variant))
    return el('label', { className: 'choice' }, input, el('span', {}, el('strong', { textContent: heading }), el('small', { textContent: detail })))
  }
  $('slab-choices').replaceChildren(
    option('genuine', 'Genuine slab', `The slab PSA-Sim sealed for #${cert}. Its chip key: ${short(slab.genuine.address)}.`),
    option('clone', 'Clone slab', `A counterfeit with the same cert #${cert} printed on the label. Its chip is a different key: ${short(slab.clone.address)}.`),
  )
}

////////////////////////////////////////////////////////////////////////
// Step 3: seller
////////////////////////////////////////////////////////////////////////

for (const [name, address] of Object.entries(DEMO_ACCOUNTS)) {
  const b = el('button', { className: 'chip', textContent: name })
  b.addEventListener('click', () => {
    $<HTMLInputElement>('seller').value = address
    $('seller-note').textContent = `Typed in: ${name}. Anyone can claim an address; the wallet button proves it.`
  })
  $('seller-picks').append(b)
}

$('seller-sign').addEventListener('click', () =>
  busy($<HTMLButtonElement>('seller-sign'), async () => {
    try {
      const challenge = makeSellerChallenge(GRADER_LABEL, cert)
      const signer = await sellerSigns(challenge.message)
      $<HTMLInputElement>('seller').value = signer
      $('seller-note').textContent = `Verified: ${accountLabel(signer)} signed a fresh challenge with their wallet.`
    } catch (e) {
      $('seller-note').textContent = `Wallet: ${(e as Error).message}`
    }
  }),
)

////////////////////////////////////////////////////////////////////////
// Tap and verify
////////////////////////////////////////////////////////////////////////

function renderOutcome(outcome: Outcome, check: ChipCheck | null, detail: { challenge: Challenge; signature: Hex } | null, note?: string) {
  const text = OUTCOME_TEXT[outcome]
  const s = seller()
  const box = el('div', { className: `outcome ${text.tone}` }, el('h3', { textContent: text.title }), el('p', { textContent: text.body }))
  if (note) box.append(el('p', { className: 'muted', textContent: note }))

  if (title?.status === 'ISSUED' && check) {
    const chipLine = check.ok ? '✓ Chip matches the ENS record' : `✗ Chip check failed (${check.reason})`
    const holderLine = !s
      ? '? No seller address given'
      : title.holder && s.toLowerCase() === title.holder.toLowerCase()
        ? '✓ Seller is the title holder'
        : '✗ Seller is not the title holder'
    box.append(el('div', { className: 'checks' }, el('span', { textContent: chipLine }), el('span', { textContent: holderLine })))
  }

  if (detail && title) {
    const rows: [string, Node | string][] = [
      ['Challenge', el('span', { className: 'mono', textContent: detail.challenge.message })],
      ['Signature', el('span', { className: 'mono', textContent: short(detail.signature) })],
      ['Signed by', check && 'signer' in check && check.signer ? addressLink(check.signer) : '—'],
      ['Chip on ENS', addressLink(title.chip)],
      ['Holder on ENS', addressLink(title.holder)],
      ['Seller', addressLink(s)],
    ]
    box.append(el('details', {}, el('summary', { textContent: 'What was checked' }), kv(rows)))
  }

  const actions = el('div', { className: 'row actions' })
  if (lastTap) {
    const replay = el('button', { textContent: 'Attack: replay this signature against a new challenge' })
    replay.addEventListener('click', () => busy(replay, replayLastTap))
    actions.append(replay)
  }
  if (actions.childElementCount) box.append(actions)
  $('result').replaceChildren(box)
}

async function tap() {
  if (!title) return
  if (title.status !== 'ISSUED' || !title.chip) {
    lastTap = null
    renderOutcome(classify(title, null, seller()), null, null)
    return
  }
  const slab = DEMO_SLABS[cert]
  if (!slab) {
    $('result').replaceChildren(el('p', { className: 'error', textContent: 'No simulated slab to tap for this cert.' }))
    return
  }
  const chip = new SimulatedChip(slab[slabVariant].privateKey)
  const challenge = makeChallenge(GRADER_LABEL, cert)
  const signature = await chip.sign(challenge.message)
  const check = await checkChip(challenge, signature, title.chip)
  lastTap = { challenge, signature }
  renderOutcome(classify(title, check, seller()), check, lastTap)
}

async function replayLastTap() {
  if (!title?.chip || !lastTap) return
  const fresh = makeChallenge(GRADER_LABEL, cert)
  const check = await checkChip(fresh, lastTap.signature, title.chip)
  renderOutcome(classify(title, check, seller()), check, { challenge: fresh, signature: lastTap.signature }, 'Replayed an earlier chip signature against a new challenge: it no longer proves anything.')
}

////////////////////////////////////////////////////////////////////////
// Step 4: transfer
////////////////////////////////////////////////////////////////////////

$('transfer').addEventListener('click', () =>
  busy($<HTMLButtonElement>('transfer'), async () => {
    const to = $<HTMLInputElement>('to').value.trim()
    if (!isAddress(to)) {
      $('transfer-note').textContent = 'Enter the buyer address.'
      return
    }
    try {
      $('transfer-note').textContent = 'Confirm in your wallet…'
      const hash = await transferTitle(cert, getAddress(to))
      $('transfer-note').replaceChildren('Transferred: ', el('a', { href: scan('tx', hash), target: '_blank', rel: 'noreferrer', className: 'mono', textContent: short(hash) }))
      await lookup()
    } catch (e) {
      $('transfer-note').textContent = `Transfer failed: ${(e as Error).message.split('\n')[0]}`
    }
  }),
)

////////////////////////////////////////////////////////////////////////
// Wire up
////////////////////////////////////////////////////////////////////////

$('lookup').addEventListener('click', () => busy($<HTMLButtonElement>('lookup'), lookup))
$('cert').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') $<HTMLButtonElement>('lookup').click()
})
$('tap').addEventListener('click', () => busy($<HTMLButtonElement>('tap'), tap))

renderSnippet()
void lookup()
