import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consumerRoute, graderRoute, segments, titleHash } from './routes.ts'

const alice = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'

test('segments tolerates missing hash, trailing slashes and bad escapes', () => {
  assert.deepEqual(segments(''), [])
  assert.deepEqual(segments('#/'), [])
  assert.deepEqual(segments('#/title/12345678/'), ['title', '12345678'])
  assert.deepEqual(segments('#/title/%E0%A4%A'), ['title', '%E0%A4%A'])
})

test('consumer routes', () => {
  assert.deepEqual(consumerRoute(''), { view: 'explore' })
  assert.deepEqual(consumerRoute('#/title/12345678'), { view: 'title', cert: '12345678' })
  assert.deepEqual(consumerRoute(titleHash('0123')), { view: 'title', cert: '0123' }) // page explains the rule
  assert.deepEqual(consumerRoute(`#/holder/${alice.toLowerCase()}`), { view: 'holder', address: alice })
  assert.deepEqual(consumerRoute('#/holder/not-an-address'), { view: 'not-found' })
  assert.deepEqual(consumerRoute('#/me'), { view: 'me' })
  assert.deepEqual(consumerRoute('#/title/1/extra'), { view: 'not-found' })
})

test('grader routes default to issue', () => {
  assert.deepEqual(graderRoute(''), { view: 'issue' })
  assert.deepEqual(graderRoute('#/issued'), { view: 'issued' })
  assert.deepEqual(graderRoute('#/trust'), { view: 'trust' })
  assert.deepEqual(graderRoute('#/nope'), { view: 'not-found' })
})
