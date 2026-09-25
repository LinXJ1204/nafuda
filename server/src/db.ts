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

export async function migrate(sql: Sql) {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  const dir = new URL('../migrations/', import.meta.url)
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name))
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(new URL(file, dir), 'utf8'))
      await tx`insert into schema_migrations (name) values (${file})`
    })
    console.log(`migrated ${file}`)
  }
}
