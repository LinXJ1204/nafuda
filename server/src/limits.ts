// Abuse limits for the write endpoints: small bodies, and a per-client rate limit. The client IP
// comes from Cloudflare (the tunnel is the only way in), falling back to the proxy's header.

import type { MiddlewareHandler } from 'hono'

const WINDOW_MS = 60_000
const MAX_WRITES = Number(process.env.MAX_WRITES_PER_MIN ?? 30)
const MAX_BODY = 8 * 1024
const hits = new Map<string, number[]>()

export const clientIp = (h: (name: string) => string | undefined) => h('cf-connecting-ip') ?? h('x-forwarded-for')?.split(',')[0].trim() ?? 'local'

export const writeLimits: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'POST') return next()
  const length = Number(c.req.header('content-length') ?? 0)
  if (length > MAX_BODY) return c.json({ error: 'request too large' }, 413)
  const ip = clientIp((n) => c.req.header(n))
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_WRITES) return c.json({ error: 'too many requests, try again in a minute' }, 429)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return next()
}
