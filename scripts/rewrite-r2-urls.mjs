#!/usr/bin/env node
// One-shot DB URL rewrite.
//
// When we switch R2_PUBLIC_URL from Cloudflare's dev domain (pub-*.r2.dev) to
// the custom domain (cdn.quizotic.live), existing Presentation.slides and
// Quiz.questions JSON blobs still point at the old host. Same bucket, same
// keys — only the hostname changes. This script rewrites those embedded URLs
// in place.
//
// Usage:
//   FROM_URL='https://pub-xxxx.r2.dev' \
//   TO_URL='https://cdn.quizotic.live' \
//   DATABASE_URL='...' \
//   node scripts/rewrite-r2-urls.mjs --dry
//
// Drop --dry to actually write. Safe to re-run (idempotent — once all URLs
// are switched, subsequent runs match zero rows).
//
// This touches only the TEXT form of two JSON columns. It does not move or
// re-encode any objects in R2.

import { Pool } from 'pg'

const fromUrl = process.env.FROM_URL
const toUrl = process.env.TO_URL
const dryRun = process.argv.includes('--dry')

if (!fromUrl || !toUrl) {
  console.error('FROM_URL and TO_URL must be set')
  console.error('Example: FROM_URL=https://pub-xxx.r2.dev TO_URL=https://cdn.quizotic.live node scripts/rewrite-r2-urls.mjs --dry')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set')
  process.exit(1)
}

if (fromUrl === toUrl) {
  console.error('FROM_URL and TO_URL are identical — nothing to do')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function rewriteTable(table, column) {
  const countSql = `
    SELECT COUNT(*) AS n
    FROM "${table}"
    WHERE ${column}::text LIKE '%' || $1 || '%'
  `
  const countRes = await pool.query(countSql, [fromUrl])
  const n = Number(countRes.rows[0].n)
  console.log(`[rewrite] ${table}.${column}: ${n} row(s) contain ${fromUrl}`)
  if (n === 0) return 0

  if (dryRun) {
    const sampleSql = `
      SELECT id
      FROM "${table}"
      WHERE ${column}::text LIKE '%' || $1 || '%'
      LIMIT 5
    `
    const sample = await pool.query(sampleSql, [fromUrl])
    console.log(`[rewrite] ${table} sample ids:`, sample.rows.map(r => r.id).join(', '))
    return n
  }

  const updateSql = `
    UPDATE "${table}"
    SET ${column} = REPLACE(${column}::text, $1, $2)::jsonb
    WHERE ${column}::text LIKE '%' || $1 || '%'
  `
  const res = await pool.query(updateSql, [fromUrl, toUrl])
  console.log(`[rewrite] ${table}.${column}: updated ${res.rowCount} row(s)`)
  return res.rowCount
}

async function main() {
  console.log(`[rewrite] FROM ${fromUrl}`)
  console.log(`[rewrite] TO   ${toUrl}`)
  console.log(`[rewrite] mode: ${dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`)
  console.log('')

  try {
    const p = await rewriteTable('Presentation', 'slides')
    const q = await rewriteTable('Quiz', 'questions')
    console.log('')
    console.log(`[rewrite] done — matched Presentation: ${p}, Quiz: ${q}`)
    if (dryRun) console.log('[rewrite] DRY — drop --dry to apply')
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('[rewrite] fatal', err)
  process.exit(1)
})
