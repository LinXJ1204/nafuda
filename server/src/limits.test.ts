import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Hono } from 'hono'
import { writeLimits } from './limits.ts'

const app = new Hono().use('*', writeLimits).post('/x', (c) => c.json({ ok: true })).get('/x', (c) => c.json({ ok: true }))
const post = (ip: string, body = '{}') => app.request('/x', { method: 'POST', body, headers: { 'cf-connecting-ip': ip, 'content-length': String(body.length) } })

test('writes are rate limited per client; reads are not', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await post('1.1.1.1')).status, 200)
  assert.equal((await post('1.1.1.1')).status, 429)
  assert.equal((await post('2.2.2.2')).status, 200, 'another client is not affected')
  assert.equal((await app.request('/x', { headers: { 'cf-connecting-ip': '1.1.1.1' } })).status, 200)
})

test('large bodies are refused', async () => {
  assert.equal((await post('3.3.3.3', 'x'.repeat(9000))).status, 413)
})
