// API integration tests against a real Postgres: indexer writes → read endpoints, and the
// signed-intent rules. Skipped unless TEST_DATABASE_URL points at a disposable database
// (the schema is dropped and recreated). CI runs it with a Postgres service.
//
//   TEST_DATABASE_URL=postgres://postgres:dev@127.0.0.1:55432/nafuda_test npm test

import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import postgres from 'postgres'
import { labelhash, type Address, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { DOMAIN, TYPES, type Offer } from '../../packages/core/src/signed.ts'
import { api } from './api.ts'
import { applyBatch } from './apply.ts'
import { migrate, type Sql } from './db.ts'
import { syncGraders, writeBatch } from './indexer.ts'

const url = process.env.TEST_DATABASE_URL
const opts = { skip: url ? false : 'TEST_DATABASE_URL not set' }

// Well-known public test keys (anvil accounts 0–2)
const A = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const B = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const C = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdbc365a')
const ZERO: Address = '0x0000000000000000000000000000000000000000'
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash

let sql: Sql
let app: ReturnType<typeof api>
const get = async (path: string) => (await app.request(`/api${path}`)).json()
const post = async (path: string, body: unknown) =>
  app.request(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  })

before(async () => {
  if (!url) return
  sql = postgres(url, { max: 3, onnotice: () => {}, types: { bigint: postgres.BigInt } })
  await sql`drop schema public cascade`
  await sql`create schema public`
  await migrate(sql)
  await syncGraders(sql)
  // Fixture: psa-sim issues #1 to A and #2 to B; #1 goes A → B (declared ¥42,000) → C
  const issued = (cert: string, block: number, holder: Address) => ({
    grader: 'psa-sim',
    blockNumber: BigInt(block),
    logIndex: 0,
    transactionHash: tx(block),
    args: { labelId: BigInt(labelhash(cert)), cert, holder, chip: holder, card: `Card ${cert} - Rare #00${cert} (demo card)`, grade: 'GEM MT 10' },
  })
  const transfer = (cert: string, block: number, from: Address, to: Address) => ({
    grader: 'psa-sim',
    blockNumber: BigInt(block),
    logIndex: 1,
    transactionHash: tx(block * 10),
    args: { from, to, id: BigInt(labelhash(cert)) },
  })
  const batch = applyBatch({
    issued: [issued('1', 100, A.address), issued('2', 101, B.address)],
    attributes: [],
    transfers: [transfer('1', 100, ZERO, A.address), transfer('1', 110, A.address, B.address), transfer('1', 120, B.address, C.address)],
    knownCerts: new Map(),
    blockTime: (b) => new Date(Number(b) * 60_000),
    priceOf: (h) => (h === tx(1100) ? 42000 : null),
  })
  const times = new Map([100n, 101n, 110n, 120n].map((b) => [b, new Date(Number(b) * 60_000)]))
  await sql.begin((t) => writeBatch(t as unknown as Sql, batch, times))
  app = api(sql)
})

after(async () => {
  await sql?.end()
})

test('titles: holder, transfer count and last declared price follow the transfers', opts, async () => {
  const { total, items } = await get('/titles?sort=newest')
  assert.equal(total, 2)
  const one = items.find((t: { cert: string }) => t.cert === '1')
  assert.equal(one.holder, C.address.toLowerCase())
  assert.equal(one.transferCount, 2)
  assert.equal(one.lastPriceJpy, 42000)
  assert.equal(one.gradeScore, 10)
})

test('title detail: history in chain order with declared prices', opts, async () => {
  const t = await get('/titles/psa-sim/1')
  assert.deepEqual(
    t.history.map((h: { from: string; to: string; priceJpy: number | null }) => [h.from, h.to, h.priceJpy]),
    [
      [A.address.toLowerCase(), B.address.toLowerCase(), 42000],
      [B.address.toLowerCase(), C.address.toLowerCase(), null],
    ],
  )
  assert.equal((await app.request('/api/titles/psa-sim/999')).status, 404)
})

test('activity, holder, graph and stats', opts, async () => {
  const activity = await get('/activity?limit=10')
  assert.equal(activity[0].kind, 'transfer')
  assert.equal(activity.length, 4) // 2 issues + 2 transfers
  const b = await get(`/holders/${B.address}`)
  assert.deepEqual(b.held.map((t: { cert: string }) => t.cert), ['2'])
  assert.deepEqual(b.past.map((t: { cert: string }) => t.cert), ['1'])
  assert.deepEqual(b.stats, { bought: 1, sold: 1, spentJpy: 42000, earnedJpy: 0 })
  const graph = await get('/graph')
  assert.equal(graph.edges.length, 2)
  const stats = await get('/stats')
  assert.equal(stats.titles, 2)
  assert.equal(stats.volumeJpy, 42000)
})

async function signedOffer(signer: typeof A, o: Partial<Offer> = {}) {
  const message: Offer = {
    grader: 'psa-sim',
    cert: '1',
    kind: 'ask',
    priceJpy: 50000n,
    note: 'Tokyo show',
    nonce: BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000)),
    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
    ...o,
  }
  const signature = await signer.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Offer', message })
  return { message, signature }
}

test('offers: only the holder asks; no self-bids; no replays; withdraw', opts, async () => {
  assert.equal((await get('/titles?forTrade=1')).total, 0)
  const ask = await signedOffer(C)
  const res = await post('/offers', ask)
  assert.equal(res.status, 201)
  const { id } = await res.json()
  assert.equal((await get('/titles?forTrade=1')).total, 1, 'the title is now for trade')
  assert.equal((await post('/offers', ask)).status, 409, 'the same signature cannot be used twice')
  assert.equal((await post('/offers', await signedOffer(A))).status, 403, 'a former holder cannot ask')
  assert.equal((await post('/offers', await signedOffer(C, { kind: 'bid' }))).status, 400, 'no bids on your own title')
  assert.equal((await post('/offers', await signedOffer(B, { kind: 'bid', priceJpy: 45000n }))).status, 201)
  // A tampered message recovers to some other address: never to the original signer. For an
  // ask that address is not the holder (refused); for a bid it is just an unknown bidder, the
  // same as a fresh key, and never attributed to B.
  const tamperedAsk = await signedOffer(C)
  assert.equal((await post('/offers', { ...tamperedAsk, message: { ...tamperedAsk.message, priceJpy: 1n } })).status, 403, 'a tampered ask is refused')
  const tamperedBid = await signedOffer(B, { kind: 'bid' })
  const r = await post('/offers', { ...tamperedBid, message: { ...tamperedBid.message, priceJpy: 1n } })
  assert.notEqual((await r.json()).from, B.address.toLowerCase(), 'a tampered bid is never attributed to its original signer')
  const bids = (await get('/titles/psa-sim/1/offers')).filter((o: { kind: string }) => o.kind === 'bid')
  assert.deepEqual(bids.filter((o: { from: string }) => o.from === B.address.toLowerCase()).map((o: { priceJpy: number }) => o.priceJpy), [45000])

  const nonce = BigInt(Date.now())
  const wrong = await B.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Withdraw', message: { offerId: BigInt(id), nonce } })
  assert.equal((await post(`/offers/${id}/withdraw`, { nonce, signature: wrong })).status, 403, 'only the signer withdraws')
  const right = await C.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Withdraw', message: { offerId: BigInt(id), nonce } })
  assert.equal((await post(`/offers/${id}/withdraw`, { nonce, signature: right })).status, 200)
  assert.equal((await get('/titles?forTrade=1')).total, 0)
})

test('submissions: anyone submits; only the grader moves them', opts, async () => {
  const message = { grader: 'psa-sim', card: 'Koi Ascending', declaredValueJpy: 30000n, service: 'Regular', nonce: BigInt(Date.now()) }
  const signature = await A.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Submission', message })
  const res = await post('/submissions', { message, signature })
  assert.equal(res.status, 201)
  const { id, submitter, status } = await res.json()
  assert.equal(submitter, A.address.toLowerCase())
  assert.equal(status, 'received')
  const action = { submissionId: BigInt(id), action: 'grading', grade: '', cert: '', txHash: '', nonce: BigInt(Date.now()) }
  const notGrader = await A.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'GraderAction', message: action })
  assert.equal((await post(`/submissions/${id}/actions`, { message: action, signature: notGrader })).status, 403)
  assert.equal((await get(`/submissions?submitter=${A.address}`)).length, 1)
})
