import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Address } from 'viem'
import { ACTIONS, ACTORS, callFor, explain, verdict, type Ctx } from './permissions.ts'
import { ROLE } from './roles.ts'

const a = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address
const ctx: Ctx = {
  graderRegistry: a(1),
  nafudaRegistry: a(2),
  userRegistryImpl: a(3),
  tokenId: 42n,
  graderNameId: 7n,
  addresses: { holder: a(10), grader: a(11), operator: a(12), stranger: a(13) },
}
const names = { holder: 'aiko.nafuda.eth', grader: 'PSA-Sim', operator: 'the operator', stranger: 'mallory' }

test('every actor × action has a call on the right contract', () => {
  for (const act of ACTIONS)
    for (const actor of ACTORS) {
      const c = callFor(act.id, actor.id, ctx)
      assert.equal(c.address, act.id === 'subtree' ? ctx.nafudaRegistry : ctx.graderRegistry)
    }
  // the holder sends; everyone else tries to pull it from the holder
  assert.deepEqual(callFor('transfer', 'holder', ctx).args.slice(0, 2), [a(10), a(13)])
  assert.deepEqual(callFor('transfer', 'grader', ctx).args.slice(0, 2), [a(10), a(11)])
})

test('verdicts: the holder transferring is expected; any other success is a remaining power', () => {
  assert.equal(verdict('transfer', 'holder', { allowed: true, error: null, args: [] }), 'expected')
  assert.equal(verdict('subtree', 'operator', { allowed: true, error: null, args: [] }), 'power')
  assert.equal(verdict('resolver', 'grader', { allowed: false, error: 'EACUnauthorizedAccountRoles', args: [] }), 'refused')
})

test('refusals are explained from the revert', () => {
  const eac = explain('resolver', 'grader', { allowed: false, error: 'EACUnauthorizedAccountRoles', args: [42n, ROLE.SET_RESOLVER, a(11)] }, names)
  assert.match(eac, /Enhanced Access Control: PSA-Sim lacks SET_RESOLVER on this name/)
  const root = explain('upgrade', 'grader', { allowed: false, error: 'EACUnauthorizedAccountRoles', args: [0n, ROLE.UPGRADE, a(11)] }, names)
  assert.match(root, /on the registry root/)
  assert.match(explain('transfer', 'stranger', { allowed: false, error: 'ERC1155MissingApprovalForAll', args: [] }, names), /only the holder/)
  assert.match(explain('subtree', 'operator', { allowed: true, error: null, args: [] }, names), /final lock removes this/)
})
