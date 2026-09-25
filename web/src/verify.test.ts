// Scenario tests for the buyer check (implementation plan P5, S1–S5), using the same demo
// chips and EIP-191 test vectors as the Solidity tests.
//
//   npm test

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SimulatedChip } from './chip.ts'
import { checkChip, classify, makeChallenge, type Challenge, type Title } from './verify.ts'

const demo = JSON.parse(readFileSync(new URL('../../demo/slabs.json', import.meta.url), 'utf8'))
const vectors = JSON.parse(readFileSync(new URL('../../demo/test-vectors.json', import.meta.url), 'utf8'))
const slab = demo.slabs['12345678']
const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const mallory: Address = '0xdc93F3229859dFA27F97608Bff83B53a1d39B477'
const title: Title = { status: 'ISSUED', holder: alice, chip: slab.genuine.address }
const genuine = new SimulatedChip(slab.genuine.privateKey as Hex)
const clone = new SimulatedChip(slab.clone.privateKey as Hex)

async function tap(chip: SimulatedChip, nowMs = Date.now()) {
  const challenge = makeChallenge('psa-sim', '12345678', nowMs)
  return { challenge, signature: await chip.sign(challenge.message) }
}

test('shared test vectors: genuine recovers to the chip, clone does not', async () => {
  const ch: Challenge = { grader: 'psa-sim', cert: '12345678', nonce: '0x', issuedAt: 1790000000, message: vectors.message }
  const now = 1790000000 * 1000
  assert.equal((await checkChip(ch, vectors.genuine.signature, slab.genuine.address, now)).ok, true)
  assert.equal((await checkChip(ch, vectors.clone.signature, slab.genuine.address, now)).ok, false)
})

test('simulated chip signs like the key it wraps', async () => {
  assert.equal(genuine.address, privateKeyToAccount(slab.genuine.privateKey).address)
})

test('S1 genuine slab, seller is the holder', async () => {
  const { challenge, signature } = await tap(genuine)
  const chip = await checkChip(challenge, signature, title.chip!)
  assert.equal(classify(title, chip, alice), 'GENUINE_AND_HOLDER')
})

test('S2 clone slab', async () => {
  const { challenge, signature } = await tap(clone)
  const chip = await checkChip(challenge, signature, title.chip!)
  assert.deepEqual([chip.ok, !chip.ok && chip.reason], [false, 'wrong-chip'])
  assert.equal(classify(title, chip, alice), 'NOT_SEALED_BY_GRADER')
})

test('S3 genuine slab, seller is not the holder', async () => {
  const { challenge, signature } = await tap(genuine)
  const chip = await checkChip(challenge, signature, title.chip!)
  assert.equal(classify(title, chip, mallory), 'GENUINE_NOT_HOLDER')
})

test('S4 no title for this cert', () => {
  assert.equal(classify({ status: 'NONE', holder: null, chip: null }, null, alice), 'NO_TITLE')
})

test('S5 replay: an old signature fails against a new challenge', async () => {
  const first = await tap(genuine)
  const second = makeChallenge('psa-sim', '12345678')
  const chip = await checkChip(second, first.signature, title.chip!)
  assert.deepEqual([chip.ok, !chip.ok && chip.reason], [false, 'wrong-chip'])
})

test('expired challenge is rejected even with the genuine chip', async () => {
  const t0 = Date.now()
  const { challenge, signature } = await tap(genuine, t0)
  const chip = await checkChip(challenge, signature, title.chip!, t0 + 61_000)
  assert.deepEqual([chip.ok, !chip.ok && chip.reason], [false, 'expired'])
})

test('malformed signature is reported, not thrown', async () => {
  const challenge = makeChallenge('psa-sim', '12345678')
  const chip = await checkChip(challenge, '0x1234', title.chip!)
  assert.deepEqual([chip.ok, !chip.ok && chip.reason], [false, 'bad-signature'])
})
