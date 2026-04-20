#!/usr/bin/env node
// Idempotent schema-repair shim, runs BEFORE `prisma migrate deploy` on boot.
//
// Why this exists: Prisma tracks applied migrations in `_prisma_migrations`.
// If a migration gets recorded there but the actual DDL didn't land (shadow
// DB drift, interrupted deploy, manual DB surgery) Prisma will refuse to
// re-run it and the app crashes with "column X does not exist" at runtime.
//
// This script runs plain idempotent `ALTER TABLE IF NOT EXISTS` against the
// live DB so critical columns are always present regardless of Prisma's
// record. It is safe to run on every boot — no-op when everything is fine.
//
// Add new entries to CRITICAL_COLUMNS when introducing a column that users
// depend on immediately (save paths, auth paths, etc.) — that way even a
// partially-applied migration can't strand users.

import { Pool } from 'pg'

const CRITICAL_COLUMNS = [
  { table: 'Quiz', column: 'theme', type: 'TEXT' },
  { table: 'Presentation', column: 'theme', type: 'TEXT' },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[ensure-columns] DATABASE_URL not set — skipping (build-time stub)')
    return
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    for (const { table, column, type } of CRITICAL_COLUMNS) {
      const sql = `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`
      try {
        await pool.query(sql)
        console.log(`[ensure-columns] OK — ${table}.${column}`)
      } catch (err) {
        // `ALTER TABLE ... IF NOT EXISTS` is idempotent. Any error here means
        // the table itself doesn't exist yet — Prisma's migrate deploy will
        // create it. Log and continue.
        console.warn(`[ensure-columns] skipped ${table}.${column}: ${err.message}`)
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('[ensure-columns] fatal', err)
  // Never block boot on this — it's a belt-and-suspenders guard. If the DB
  // is unreachable, prisma migrate deploy will fail loudly next and Railway
  // will surface that instead.
  process.exit(0)
})
