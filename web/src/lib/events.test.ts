import assert from 'node:assert/strict'
import { test } from 'node:test'
import { labelhash, type Address, type Hash } from 'viem'
import { buildIndex, canonicalId, type IssuedLog, type TransferLog } from './events.ts'

const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const bob: Address = '0x3565a2f62c8283d8d7F7261f969C893C566740e2'
const carol: Address = '0x00000000000000000000000000000000000000c0'
const chip: Address = '0x3ef4724aB3750dDfAA0f98078D6F281d57864f59'
const ZERO: Address = '0x0000000000000000000000000000000000000000'
const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hash

const id = (cert: string) => BigInt(labelhash(cert))
const issued = (cert: string, block: number, holder = alice): IssuedLog => ({
  blockNumber: BigInt(block),
  logIndex: 0,
  transactionHash: tx(block),
  args: { labelId: id(cert), cert, holder, chip, card: `card ${cert}`, grade: 'GEM MT 10' },
})
const transfer = (cert: string, block: number, from: Address, to: Address, version = 0n, logIndex = 1): TransferLog => ({
  blockNumber: BigInt(block),
  logIndex,
  transactionHash: tx(block * 10 + logIndex),
  args: { from, to, id: canonicalId(id(cert)) | version },
})

test('issuance creates a title held by the first holder', () => {
  const [t] = buildIndex([issued('12345678', 100)], [transfer('12345678', 100, ZERO, alice)])
  assert.equal(t.holder, alice)
  assert.deepEqual(t.history.map((h) => h.kind), ['issued'])
})

test('transfers update the holder and history in chain order', () => {
  const [t] = buildIndex(
    [issued('12345678', 100)],
    [transfer('12345678', 120, bob, carol), transfer('12345678', 110, alice, bob)], // out of order on purpose
  )
  assert.equal(t.holder, carol)
  assert.deepEqual(t.history.map((h) => [h.kind, h.from, h.to]), [
    ['issued', null, alice],
    ['transfer', alice, bob],
    ['transfer', bob, carol],
  ])
})

test('a regenerated token id (new version) still maps to the same title', () => {
  const [t] = buildIndex(
    [issued('12345678', 100)],
    [
      transfer('12345678', 105, alice, ZERO, 0n, 1), // regeneration burn
      transfer('12345678', 105, ZERO, alice, 1n, 2), // regeneration mint, version 1
      transfer('12345678', 110, alice, bob, 1n),
    ],
  )
  assert.equal(t.holder, bob)
  assert.equal(t.history.length, 2)
})

test('transfers of unknown ids are ignored; newest issued comes first', () => {
  const titles = buildIndex([issued('1', 100), issued('2', 200)], [transfer('3', 150, alice, bob)])
  assert.deepEqual(titles.map((t) => t.cert), ['2', '1'])
  assert.ok(titles.every((t) => t.holder === alice))
})
