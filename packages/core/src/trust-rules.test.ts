import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Address } from 'viem'
import { GRADER_FINAL_ROOT_ROLES, GRADER_NAME_TOKEN_ROLES, ROLE, TITLE_ROLES } from './roles.ts'
import { evaluateTrust, type TrustFacts } from './trust-rules.ts'

const nafuda: Address = '0xE82fa5f595C2EF9f5bf8BF779EC1f58E39Db4B43'
const eth: Address = '0x657eA849311d3D5823348ddEd7C2AaAFb3EDE09E'

// The live Sepolia state before the final lock.
const beforeLock: TrustFacts = {
  psaEmancipated: true,
  controllerIsRegistrar: true,
  graderRootRoles: GRADER_FINAL_ROOT_ROLES,
  holderRoles: [{ cert: '12345678', roles: TITLE_ROLES }, { cert: '12345679', roles: TITLE_ROLES }],
  psaParent: { parent: nafuda, label: 'psa-sim' },
  nafudaParent: { parent: eth, label: 'nafuda' },
  expected: { nafudaRegistry: nafuda, ethRegistry: eth, graderLabel: 'psa-sim', nameLabel: 'nafuda' },
  nafudaEmancipated: false,
  graderNameTokenRoles: GRADER_NAME_TOKEN_ROLES,
  operatorNameTokenRoles: 0n,
  operatorRootNameRoles: ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY) | ROLE.SET_RESOLVER,
}
const afterLock: TrustFacts = { ...beforeLock, nafudaEmancipated: true, graderNameTokenRoles: 0n, operatorRootNameRoles: ROLE.SET_RESOLVER }

const failing = (f: TrustFacts) => evaluateTrust(f).filter((c) => !c.ok).map((c) => c.id)

test('before the final lock: title guarantees hold, lock checks are open', () => {
  assert.deepEqual(failing(beforeLock), ['lock-registry', 'lock-subtree', 'lock-root'])
})

test('after the final lock: everything holds', () => {
  assert.deepEqual(failing(afterLock), [])
})

test('a grader that kept REGISTRAR is flagged (it could bypass the controller)', () => {
  assert.deepEqual(failing({ ...afterLock, graderRootRoles: GRADER_FINAL_ROOT_ROLES | ROLE.REGISTRAR }), ['issuer', 'grader'])
})

test('a holder with extra roles is flagged', () => {
  const holderRoles = [{ cert: '1', roles: TITLE_ROLES | ROLE.SET_RESOLVER }]
  assert.deepEqual(failing({ ...afterLock, holderRoles }), ['holders'])
})

test('a registry that is not emancipated is flagged', () => {
  assert.deepEqual(failing({ ...afterLock, psaEmancipated: false }), ['emancipated'])
})
