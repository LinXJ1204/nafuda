import assert from 'node:assert/strict'
import { test } from 'node:test'
import { labelhash, type Address, type Hash } from 'viem'
import { applyBatch, expandBatch, type IssuedLog, type TransferLog } from './apply.ts'

const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const bob: Address = '0x3565a2f62c8283d8d7F7261f969C893C566740e2'
const ZERO: Address = '0x0000000000000000000000000000000000000000'
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash
const id = (cert: string) => BigInt(labelhash(cert))
const issued = (grader: string, cert: string, block: number): IssuedLog => ({
  grader,
  blockNumber: BigInt(block),
  logIndex: 0,
  transactionHash: tx(block),
  args: { labelId: id(cert), cert, holder: alice, chip: alice, card: 'Koi Ascending - Rare #013 (demo card)', grade: 'GEM MINT 9.5' },
})
const transfer = (grader: string, cert: string, block: number, from: Address, to: Address, version = 0n): TransferLog => ({
  grader,
  blockNumber: BigInt(block),
  logIndex: 1,
  transactionHash: tx(block * 10),
  args: { from, to, id: id(cert) | version },
})
const base = { attributes: [], knownCerts: new Map<string, string>(), blockTime: (b: bigint) => new Date(Number(b) * 1000), priceOf: () => null }

test('issuance becomes a title row with a numeric grade score', () => {
  const { titles } = applyBatch({ ...base, issued: [issued('bgs-sim', '1004827301', 5)], transfers: [] })
  assert.equal(titles.length, 1)
  assert.equal(titles[0].gradeScore, 9.5)
  assert.equal(titles[0].holder, alice.toLowerCase())
})

test('transfers map to their title across token id versions; mints and burns are skipped', () => {
  const { transfers } = applyBatch({
    ...base,
    issued: [issued('psa-sim', '81234501', 5)],
    transfers: [transfer('psa-sim', '81234501', 5, ZERO, alice), transfer('psa-sim', '81234501', 7, alice, bob, 3n), transfer('psa-sim', '81234501', 8, bob, ZERO)],
    priceOf: (h) => (h === tx(70) ? 42000 : null),
  })
  assert.deepEqual(transfers.map((t) => [t.cert, t.from, t.to, t.priceJpy]), [['81234501', alice.toLowerCase(), bob.toLowerCase(), 42000]])
})

test('the same cert under two graders are two different titles', () => {
  const { transfers } = applyBatch({
    ...base,
    issued: [issued('psa-sim', '1004827301', 5)],
    transfers: [transfer('bgs-sim', '1004827301', 6, alice, bob)],
  })
  assert.equal(transfers.length, 0, 'a bgs-sim transfer does not move the psa-sim title')
})

test('titles indexed in an earlier batch are still found', () => {
  const knownCerts = new Map([[`cgc-sim:${id('4000317201') & ~0xffffffffn}`, '4000317201']])
  const { transfers, attributes } = applyBatch({
    ...base,
    knownCerts,
    issued: [],
    attributes: [{ grader: 'cgc-sim', blockNumber: 9n, logIndex: 0, transactionHash: tx(9), args: { labelId: id('4000317201'), key: 'subgrade.edges', value: '10' } }],
    transfers: [transfer('cgc-sim', '4000317201', 9, alice, bob)],
  })
  assert.equal(transfers.length, 1)
  assert.deepEqual(attributes, [{ grader: 'cgc-sim', cert: '4000317201', key: 'subgrade.edges', value: '10' }])
})

test('a TransferBatch becomes one transfer per name, keyed by its position in the batch', () => {
  const batchLog = {
    grader: 'psa-sim',
    blockNumber: 9n,
    logIndex: 4,
    transactionHash: tx(99),
    args: { from: alice, to: bob, ids: [id('81234501'), id('81234502') | 2n] },
  }
  const { transfers } = applyBatch({
    ...base,
    issued: [issued('psa-sim', '81234501', 5), issued('psa-sim', '81234502', 6)],
    transfers: expandBatch(batchLog),
  })
  assert.deepEqual(
    transfers.map((t) => [t.cert, t.logIndex, t.batchIndex, t.to]),
    [
      ['81234501', 4, 0, bob.toLowerCase()],
      ['81234502', 4, 1, bob.toLowerCase()],
    ],
  )
})
