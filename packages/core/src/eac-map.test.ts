import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describe, projectLock, riskOf, type MapNode } from './eac-map.ts'
import { ALL_ROLES, GRADER_FINAL_ROOT_ROLES, GRADER_NAME_TOKEN_ROLES, ROLE, TITLE_ROLES } from './roles.ts'

const today: MapNode[] = [
  { id: 'eth', title: 'nafuda.eth', subtitle: '', kind: 'root-name', holdings: [{ who: 'operator', bitmap: ROLE.SET_SUBREGISTRY | ROLE.admin(ROLE.SET_SUBREGISTRY) | ROLE.SET_RESOLVER | TITLE_ROLES }] },
  { id: 'root', title: 'nafudaRegistry root', subtitle: '', kind: 'registry-root', holdings: [{ who: 'operator', bitmap: ALL_ROLES }] },
  { id: 'gn', title: 'psa-sim.nafuda.eth', subtitle: '', kind: 'grader-name', holdings: [{ who: 'grader', bitmap: GRADER_NAME_TOKEN_ROLES }] },
  { id: 'gr', title: 'psa-sim registry root', subtitle: '', kind: 'grader-registry', holdings: [{ who: 'grader', bitmap: GRADER_FINAL_ROOT_ROLES }, { who: 'controller', bitmap: ROLE.REGISTRAR }] },
  { id: 't', title: 'title', subtitle: '', kind: 'title', holdings: [{ who: 'holder', bitmap: TITLE_ROLES }] },
  { id: 'id', title: 'aiko.nafuda.eth', subtitle: '', kind: 'identity', holdings: [{ who: 'aiko', bitmap: TITLE_ROLES | ROLE.SET_RESOLVER }] },
]

test('today (before the lock): the operator and the grader still hold powers over the tree', () => {
  assert.deepEqual(today.map(riskOf), ['power', 'power', 'power', 'fixed', 'fixed', 'owner'])
})

test('after the lock: nothing that titles depend on can be changed', () => {
  const after = projectLock(today)
  assert.deepEqual(after.map(riskOf), ['fixed', 'fixed', 'fixed', 'fixed', 'fixed', 'owner'])
  // the operator keeps REGISTRAR on nafudaRegistry (adds graders) and SET_RESOLVER on nafuda.eth
  assert.ok((after[1].holdings[0].bitmap & ROLE.REGISTRAR) !== 0n)
  assert.ok((after[0].holdings[0].bitmap & ROLE.SET_RESOLVER) !== 0n)
})

test('describe', () => {
  assert.equal(describe(ALL_ROLES), 'all roles')
  assert.equal(describe(TITLE_ROLES), 'CAN_TRANSFER admin')
  assert.equal(describe(0n), 'none')
})
