import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { zeroAddress, type Address } from 'viem'
import { bench, precheck, type IssueForm } from './issue-rules.ts'

const graderAddr: Address = '0x1111111111111111111111111111111111111111'
const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const psa = { grader: graderAddr, scale: ['GEM MT 10', 'MINT 9'], subgrades: [] as string[], short: 'PSA-Sim' }
const bgs = { ...psa, short: 'BGS-Sim', scale: ['GEM MINT 9.5'], subgrades: ['centering', 'corners'] }
const ok: IssueForm = { cert: '12345680', card: 'Tanuki Drummer - Common #107 (demo card)', grade: 'MINT 9', holder: alice, chip: alice, subgrades: {} }

test('a valid issue by the grader passes', () => {
  assert.equal(precheck(ok, psa, graderAddr, zeroAddress), null)
})

test('blocked before sending: wrong wallet, already issued', () => {
  assert.match(precheck(ok, psa, alice, zeroAddress) ?? '', /not PSA-Sim/)
  assert.match(precheck(ok, psa, null, zeroAddress) ?? '', /Connect/)
  assert.match(precheck(ok, psa, graderAddr, alice) ?? '', /already has a title/)
})

test('grade must be on this grader’s scale; v2 graders need every subgrade', () => {
  assert.match(precheck({ ...ok, grade: 'PRISTINE 10' }, psa, graderAddr, zeroAddress) ?? '', /scale/)
  const b = { ...ok, grade: 'GEM MINT 9.5' }
  assert.match(precheck({ ...b, subgrades: { centering: '9.5' } }, bgs, graderAddr, zeroAddress) ?? '', /corners/)
  assert.equal(precheck({ ...b, subgrades: { centering: '9.5', corners: '10' } }, bgs, graderAddr, zeroAddress), null)
})

test('form problems are reported instead of reverting', () => {
  assert.match(precheck({ ...ok, cert: '0123' }, psa, graderAddr, zeroAddress) ?? '', /no leading zero/)
  assert.match(precheck({ ...ok, holder: 'bob' }, psa, graderAddr, zeroAddress) ?? '', /holder/)
  assert.match(precheck({ ...ok, card: ' ' }, psa, graderAddr, zeroAddress) ?? '', /card name/)
})

test('bench: psa-sim keeps the demo pool, others continue after the seed range', () => {
  assert.equal(bench({ label: 'psa-sim', seedCertStart: 81234501 })[0].cert, '12345680')
  assert.equal(bench({ label: 'cgc-sim', seedCertStart: 4000317201 })[0].cert, '4000317221')
  const pool = JSON.parse(readFileSync(new URL('../../../demo/slabs.json', import.meta.url), 'utf8')).pool
  assert.equal(bench({ label: 'psa-sim', seedCertStart: 1 })[0].chip, pool['12345680'].genuine.address, 'same chip as demo/slabs.json')
})
