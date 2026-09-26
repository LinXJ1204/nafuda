import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Address } from 'viem'
import { checkIntegrity, type IntegrityFacts } from './integrity.ts'
import { ROLE, TITLE_ROLES } from './roles.ts'

const controller: Address = '0xf0F17d40df37257b3433ACC273373F16D8D06C50'
const holder: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const one = (role: bigint) => role // a count of 1 sits at the role's own bit (nybble packing)
const good: IntegrityFacts = {
  resolver: controller,
  resolverAtGraderLevel: true,
  controller,
  controllerHolder: holder,
  holder,
  holderRoles: TITLE_ROLES,
  assigneeCounts: one(TITLE_ROLES),
  emancipated: true,
}
const failing = (f: IntegrityFacts) => checkIntegrity(f).filter((c) => !c.ok).map((c) => c.id)

test('a title issued by the controller passes every check', () => {
  assert.deepEqual(failing(good), [])
})

test('a cert registered outside the controller (grader re-granted itself REGISTRAR) is caught', () => {
  // its own resolver at the cert level, no controller record, holder with extra roles
  assert.deepEqual(
    failing({
      ...good,
      resolver: holder,
      resolverAtGraderLevel: false,
      controllerHolder: null,
      holderRoles: TITLE_ROLES | ROLE.SET_RESOLVER,
      assigneeCounts: one(TITLE_ROLES) | one(ROLE.SET_RESOLVER),
    }),
    ['resolver', 'issued', 'holder-roles', 'sole-assignee'],
  )
})

test('a hidden co-assignee is caught', () => {
  assert.deepEqual(failing({ ...good, assigneeCounts: 2n * one(TITLE_ROLES) }), ['sole-assignee'])
})

test('a registry that is not emancipated is caught', () => {
  assert.deepEqual(failing({ ...good, emancipated: false }), ['emancipated'])
})
