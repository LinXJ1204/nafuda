import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DANGEROUS_ROOT_ROLES, GRADER_FINAL_ROOT_ROLES, ROLE, TITLE_ROLES, decodeRoles } from './roles.ts'

test('decodes role bitmaps, admins included', () => {
  assert.deepEqual(decodeRoles(GRADER_FINAL_ROOT_ROLES), ['REGISTRAR admin', 'SET_PARENT', 'SET_PARENT admin', 'CAN_NAME', 'CAN_NAME admin'])
  assert.deepEqual(decodeRoles(TITLE_ROLES), ['CAN_TRANSFER admin'])
  assert.deepEqual(decodeRoles(0n), [])
})

test('unknown bits are not hidden', () => {
  assert.deepEqual(decodeRoles(ROLE.REGISTRAR | (1n << 2n)), ['REGISTRAR', 'bit 2'])
})

test("the grader's final roles include nothing that touches issued titles", () => {
  assert.equal(GRADER_FINAL_ROOT_ROLES & DANGEROUS_ROOT_ROLES, 0n)
})
