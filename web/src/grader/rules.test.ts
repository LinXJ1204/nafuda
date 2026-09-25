import assert from 'node:assert/strict'
import { test } from 'node:test'
import { zeroAddress, type Address } from 'viem'
import { precheck, type IssueForm } from './rules.ts'

const grader: Address = '0x1111111111111111111111111111111111111111'
const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const chip: Address = '0x3ef4724aB3750dDfAA0f98078D6F281d57864f59'
const ok: IssueForm = { cert: '12345680', card: 'Tanuki Drummer - Common #107 (demo card)', grade: 'NM-MT 8', holder: alice, chip }

test('a valid issue by the grader passes', () => {
  assert.equal(precheck(ok, grader, grader, zeroAddress), null)
})

test('A5: blocked before sending when the wallet is not the grader', () => {
  assert.match(precheck(ok, alice, grader, zeroAddress) ?? '', /not the grader/)
  assert.match(precheck(ok, null, grader, zeroAddress) ?? '', /Connect/)
})

test('A5: a cert that already has a title is reported as issued', () => {
  assert.match(precheck(ok, grader, grader, alice) ?? '', /already has a title/)
})

test('form problems are reported instead of reverting', () => {
  assert.match(precheck({ ...ok, cert: '0123' }, grader, grader, zeroAddress) ?? '', /no leading zero/)
  assert.match(precheck({ ...ok, holder: 'bob' }, grader, grader, zeroAddress) ?? '', /holder/)
  assert.match(precheck({ ...ok, holder: zeroAddress }, grader, grader, zeroAddress) ?? '', /holder/)
  assert.match(precheck({ ...ok, card: '   ' }, grader, grader, zeroAddress) ?? '', /card name/)
  assert.match(precheck({ ...ok, grade: 'PERFECT 11' }, grader, grader, zeroAddress) ?? '', /grade/)
})
