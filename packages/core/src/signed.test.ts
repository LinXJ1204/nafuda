import assert from 'node:assert/strict'
import { test } from 'node:test'
import { privateKeyToAccount } from 'viem/accounts'
import { DOMAIN, TYPES, checkGraderAction, checkOffer, checkSubmission, nextStatus, recoverOffer, type GraderAction, type Offer } from './signed.ts'

const now = 1_790_000_000_000
const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const offer: Offer = { grader: 'psa-sim', cert: '12345678', kind: 'bid', priceJpy: 50000n, note: 'Meet at the Tokyo show?', nonce: BigInt(now), expiry: BigInt(now / 1000 + 86400) }

test('an offer signature recovers to its signer', async () => {
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'Offer', message: offer })
  assert.equal(await recoverOffer(offer, signature), account.address)
  assert.notEqual(await recoverOffer({ ...offer, priceJpy: 1n }, signature), account.address, 'a changed price does not verify')
})

test('offer rules', () => {
  assert.equal(checkOffer(offer, now), null)
  assert.match(checkOffer({ ...offer, cert: '0123' }, now) ?? '', /cert/)
  assert.match(checkOffer({ ...offer, priceJpy: 0n }, now) ?? '', /price/)
  assert.match(checkOffer({ ...offer, note: 'x'.repeat(141) }, now) ?? '', /note/)
  assert.match(checkOffer({ ...offer, nonce: BigInt(now - 3_600_000) }, now) ?? '', /stale/)
  assert.match(checkOffer({ ...offer, expiry: BigInt(now / 1000 - 1) }, now) ?? '', /expiry/)
})

test('submission rules', () => {
  const s = { grader: 'bgs-sim', card: 'Koi Ascending', declaredValueJpy: 30000n, service: 'Regular', nonce: BigInt(now) }
  assert.equal(checkSubmission(s, ['bgs-sim'], now), null)
  assert.match(checkSubmission({ ...s, grader: 'x' }, ['bgs-sim'], now) ?? '', /grader/)
  assert.match(checkSubmission({ ...s, service: 'Overnight' }, ['bgs-sim'], now) ?? '', /service/)
})

test('grader actions follow the flow received → grading → sealed → issued', () => {
  const a = (action: GraderAction['action'], extra: Partial<GraderAction> = {}): GraderAction => ({ submissionId: 1n, action, grade: '', cert: '', txHash: '', nonce: BigInt(now), ...extra })
  assert.equal(nextStatus('received'), 'grading')
  assert.equal(checkGraderAction(a('grading'), 'received', now), null)
  assert.match(checkGraderAction(a('sealed'), 'received', now) ?? '', /cannot go/)
  assert.match(checkGraderAction(a('sealed'), 'grading', now) ?? '', /grade and a cert/)
  assert.equal(checkGraderAction(a('sealed', { grade: 'GEM MT 10', cert: '12345680' }), 'grading', now), null)
  assert.match(checkGraderAction(a('issued'), 'sealed', now) ?? '', /transaction hash/)
  assert.equal(checkGraderAction(a('issued', { txHash: `0x${'a'.repeat(64)}` }), 'sealed', now), null)
  assert.equal(checkGraderAction(a('rejected'), 'grading', now), null)
  assert.match(checkGraderAction(a('rejected'), 'issued', now) ?? '', /already issued/)
})
