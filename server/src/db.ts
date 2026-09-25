// Postgres connection and migrations (plain SQL files in server/migrations, applied in order).

import { readdirSync, readFileSync } from 'node:fs'
import postgres from 'postgres'
import { env } from './env.ts'

export type Sql = ReturnType<typeof postgres>

export function connect(): Sql {
  return postgres(env.databaseUrl(), {
    max: 5,
    onnotice: () => {},
    types: { bigint: postgres.BigInt },
  })
}

const LOCK = 20260926

/// The api and the indexer both start by migrating. Each step takes a transaction-level
/// advisory lock (released at commit, whichever pooled connection runs it) and re-checks
/// whether the step was already applied, so two processes never apply the same file.
export async function migrate(sql: Sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK})`
    await tx`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  })
  const dir = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK})`
      const [done] = await tx`select 1 from schema_migrations where name = ${file}`
      if (done) return
      await tx.unsafe(readFileSync(new URL(file, dir), 'utf8'))
      await tx`insert into schema_migrations (name) values (${file})`
      console.log(`migrated ${file}`)
    })
  }
}
