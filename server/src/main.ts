// Entry point: `node src/main.ts api` or `node src/main.ts indexer` (both run migrations first).

import { serve } from '@hono/node-server'
import { api } from './api.ts'
import { connect, migrate } from './db.ts'
import { env } from './env.ts'
import { runIndexer } from './indexer.ts'

const mode = process.argv[2]
const sql = connect()
await migrate(sql)

if (mode === 'api') {
  serve({ fetch: api(sql).fetch, port: env.port })
  console.log(`api on :${env.port}`)
} else if (mode === 'indexer') {
  await runIndexer(sql, { once: process.argv.includes('--once') })
  await sql.end()
} else {
  throw new Error('usage: main.ts api|indexer [--once]')
}
