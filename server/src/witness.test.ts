import assert from 'node:assert/strict'
import { test } from 'node:test'
import { labelhash, type Address, type Hash } from 'viem'
import { PSA_REGISTRY, webhookItem } from './witness.fixtures.ts'
import { checkSignature, parseDelivery, reconcile, signBody, type IndexIssue, type IndexTransfer, type WitnessRow } from './witness.ts'

const REGISTRY = PSA_REGISTRY
const graderOf = (a: string) => (a.toLowerCase() === REGISTRY ? 'psa-sim' : null)
const alice: Address = '0x92785192bb6a16be1ac305ab419e0f36f0216370'
const bob: Address = '0x3565a2f62c8283d8d7f7261f969c893c566740e2'
const ZERO: Address = '0x0000000000000000000000000000000000000000'
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash
const id = (cert: string) => BigInt(labelhash(cert))

// --- signature -------------------------------------------------------------------------------

test('signature: MultiBaas scheme (hex HMAC-SHA256 over body then timestamp) is accepted', () => {
  const body = new TextEncoder().encode('[{"id":"x"}]')
  const signature = signBody(body, '1790000000', 'secret')
  assert.equal(checkSignature({ body, signature, timestamp: '1790000000', secret: 'secret', nowSec: 1790000010 }), 'ok')
})

test('signature: tampered body, wrong secret, stale or missing headers are refused', () => {
  const body = new TextEncoder().encode('[{"id":"x"}]')
  const signature = signBody(body, '1790000000', 'secret')
  const base = { body, signature, timestamp: '1790000000', secret: 'secret', nowSec: 1790000000 }
  assert.equal(checkSignature({ ...base, body: new TextEncoder().encode('[{"id":"y"}]') }), 'bad-signature')
  assert.equal(checkSignature({ ...base, secret: 'other' }), 'bad-signature')
  assert.equal(checkSignature({ ...base, timestamp: '1790000001' }), 'bad-signature', 'the timestamp is signed too')
  assert.equal(checkSignature({ ...base, nowSec: 1790000000 + 301 }), 'stale')
  assert.equal(checkSignature({ ...base, signature: undefined }), 'missing')
  assert.equal(checkSignature({ ...base, signature: 'zz' }), 'missing')
})

// --- parsing ---------------------------------------------------------------------------------

test('parse: decodes the raw log, not MultiBaas display values; batches become one row per name', () => {
  const { rows, ignored } = parseDelivery(
    [webhookItem({ n: 1, from: alice, to: bob, ids: [id('81234501')], block: 100, logIndex: 3 }), webhookItem({ n: 2, from: bob, to: alice, ids: [id('81234502'), id('81234503')], block: 101, logIndex: 0 })],
    graderOf,
  )
  assert.equal(ignored, 0)
  assert.deepEqual(
    rows.map((r) => [r.tx, r.logIndex, r.batchIndex, r.kind, r.from, r.to, r.tokenId, r.block]),
    [
      [tx(1), 3, 0, 'transfer', alice, bob, id('81234501'), 100n],
      [tx(2), 0, 0, 'transfer', bob, alice, id('81234502'), 101n],
      [tx(2), 0, 1, 'transfer', bob, alice, id('81234503'), 101n],
    ],
  )
})

test('parse: other contracts, other event types and malformed items are ignored', () => {
  const good = webhookItem({ n: 1, from: alice, to: bob, ids: [id('1')], block: 1, logIndex: 0 })
  const { rows, ignored } = parseDelivery(
    [
      webhookItem({ n: 2, from: alice, to: bob, ids: [id('1')], block: 1, logIndex: 1, address: '0x000000000000000000000000000000000000dead' }),
      { id: 'tx', event: 'transaction.included', data: {} },
      { ...good, data: { event: { rawFields: 'not json' } } },
      { ...good, data: { event: { rawFields: JSON.stringify({ ...JSON.parse(good.data.event.rawFields), topics: [tx(9)] }) } } },
      'junk',
    ],
    graderOf,
  )
  assert.equal(rows.length, 0)
  assert.equal(ignored, 5)
  assert.deepEqual(parseDelivery({ not: 'an array' }, graderOf), { rows: [], ignored: 1 })
})

// --- reconciliation --------------------------------------------------------------------------

const w = (o: Partial<WitnessRow> & Pick<WitnessRow, 'tx' | 'logIndex' | 'block' | 'kind' | 'from' | 'to' | 'tokenId'>): WitnessRow => ({
  deliveryId: 'd',
  grader: 'psa-sim',
  registry: REGISTRY,
  batchIndex: 0,
  blockHash: tx(0),
  removed: false,
  triggeredAt: null,
  ...o,
})
const issue = (cert: string, n: number, block: bigint): IndexIssue => ({ grader: 'psa-sim', cert, labelId: id(cert), tx: tx(n), block, holder: alice })
const transfer = (cert: string, n: number, block: bigint, logIndex = 1, from: string = alice, to: string = bob): IndexTransfer => ({
  grader: 'psa-sim',
  cert,
  tx: tx(n),
  logIndex,
  batchIndex: 0,
  block,
  from,
  to,
})

test('reconcile: matching issuance and transfer agree; token versions do not matter', () => {
  const { summary, events } = reconcile({
    witnessed: [
      w({ tx: tx(1), logIndex: 0, block: 10n, kind: 'mint', from: ZERO, to: alice, tokenId: id('A') }),
      w({ tx: tx(2), logIndex: 1, block: 11n, kind: 'transfer', from: alice, to: bob, tokenId: id('A') | 5n }),
    ],
    issues: [issue('A', 1, 10n)],
    transfers: [transfer('A', 2, 11n)],
    indexedThrough: 20n,
  })
  assert.deepEqual(events.map((e) => [e.verdict, e.cert]), [['agreed', 'A'], ['agreed', 'A']])
  assert.equal(summary.agreed, 2)
  assert.equal(summary.unwitnessed, 0)
})

test('reconcile: a different recipient is a mismatch; an unindexed transfer is missing, or pending if the indexer is behind', () => {
  const carol = '0x5de4111afa1a4b94908f83103eb1f1706367c2e6'
  const { events } = reconcile({
    witnessed: [
      w({ tx: tx(2), logIndex: 1, block: 11n, kind: 'transfer', from: alice, to: carol, tokenId: id('A') }),
      w({ tx: tx(3), logIndex: 1, block: 12n, kind: 'transfer', from: bob, to: alice, tokenId: id('A') }),
      w({ tx: tx(4), logIndex: 1, block: 30n, kind: 'transfer', from: alice, to: bob, tokenId: id('A') }),
    ],
    issues: [issue('A', 1, 10n)],
    transfers: [transfer('A', 2, 11n)],
    indexedThrough: 20n,
  })
  assert.deepEqual(events.map((e) => e.verdict), ['mismatch', 'missing', 'pending'])
  assert.match(events[0].detail!, /^to /)
})

test('reconcile: a mint without a TitleIssued (outside the controller) is flagged', () => {
  const { events } = reconcile({
    witnessed: [w({ tx: tx(7), logIndex: 0, block: 11n, kind: 'mint', from: ZERO, to: alice, tokenId: id('B') })],
    issues: [],
    transfers: [],
    indexedThrough: 20n,
  })
  assert.equal(events[0].verdict, 'missing')
  assert.match(events[0].detail!, /TitleIssued/)
})

test('reconcile: burn + re-mint of the same name in one transaction is a regeneration, not a finding', () => {
  const { summary } = reconcile({
    witnessed: [
      w({ tx: tx(8), logIndex: 0, block: 11n, kind: 'burn', from: alice, to: ZERO, tokenId: id('A') }),
      w({ tx: tx(8), logIndex: 1, block: 11n, kind: 'mint', from: ZERO, to: alice, tokenId: id('A') | 1n }),
    ],
    issues: [issue('A', 1, 5n)],
    transfers: [],
    indexedThrough: 20n,
  })
  assert.equal(summary.regeneration, 2)
  assert.equal(summary.missing + summary.mismatch, 0)
})

test('reconcile, other direction: an indexed transfer Curvegrid never saw is unwitnessed (inside its window only)', () => {
  const { unwitnessed, summary } = reconcile({
    witnessed: [
      w({ tx: tx(2), logIndex: 1, block: 11n, kind: 'transfer', from: alice, to: bob, tokenId: id('A') }),
      w({ tx: tx(9), logIndex: 1, block: 15n, kind: 'transfer', from: bob, to: alice, tokenId: id('A') }),
    ],
    issues: [issue('A', 1, 10n), issue('C', 5, 13n)],
    transfers: [transfer('A', 2, 11n), transfer('A', 3, 12n, 1, bob, alice), transfer('A', 9, 15n, 1, bob, alice), transfer('A', 4, 16n)],
    indexedThrough: 20n,
  })
  // block 10 is before the window, 15 is its latest block and 16 is after it
  assert.deepEqual(unwitnessed.map((u) => [u.kind, u.tx]), [['transfer', tx(3)], ['issue', tx(5)]])
  assert.equal(summary.unwitnessed, 2)
  assert.equal(summary.fromBlock, 11n)
  assert.equal(summary.toBlock, 15n)
})

test('reconcile: reorged events are left out', () => {
  const { summary } = reconcile({
    witnessed: [w({ tx: tx(2), logIndex: 1, block: 11n, kind: 'transfer', from: alice, to: bob, tokenId: id('A'), removed: true })],
    issues: [],
    transfers: [],
    indexedThrough: 20n,
  })
  assert.equal(summary.witnessed, 0)
  assert.equal(summary.reorged, 1)
})
