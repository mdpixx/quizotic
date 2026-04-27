// One-off: backfill UsageLog.questionCount from metadata->>'questionCount'.
// Should have run as part of migration 20260427_user_geo_usage_typed_columns
// but Prisma's ledger drift skipped it. Idempotent — only updates rows where
// the typed column is still 0 and the JSON metadata has a usable value.
//
// Run with:  railway run node scripts/_backfill-usage-questioncount.mjs

import { Pool } from 'pg'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Counts before
  const before = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE action IN ('ai_generate', 'ai_translate'))::int AS question_rows,
      COUNT(*) FILTER (WHERE action IN ('ai_generate', 'ai_translate') AND "questionCount" = 0 AND metadata->>'questionCount' IS NOT NULL)::int AS needs_backfill,
      SUM("questionCount") FILTER (WHERE action IN ('ai_generate', 'ai_translate'))::int AS typed_sum
    FROM "UsageLog"
  `)
  console.log('BEFORE:', before.rows[0])

  // Backfill questionCount from JSON metadata where typed column is still 0.
  // Default to 5 (the legacy DEFAULT_QUESTION_COST) only when the JSON value
  // is also missing — matches the original library behaviour exactly.
  const updRes = await pool.query(`
    UPDATE "UsageLog"
    SET "questionCount" = COALESCE(NULLIF(metadata->>'questionCount', '')::int, 5)
    WHERE "questionCount" = 0
      AND action IN ('ai_generate', 'ai_translate')
      AND metadata IS NOT NULL
  `)
  console.log(`ROWS UPDATED: ${updRes.rowCount}`)

  // Backfill model column likewise (best-effort).
  const modelRes = await pool.query(`
    UPDATE "UsageLog"
    SET model = NULLIF(metadata->>'model', '')
    WHERE model IS NULL
      AND metadata IS NOT NULL
      AND metadata ? 'model'
  `)
  console.log(`MODEL ROWS UPDATED: ${modelRes.rowCount}`)

  const after = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE action IN ('ai_generate', 'ai_translate'))::int AS question_rows,
      SUM("questionCount") FILTER (WHERE action IN ('ai_generate', 'ai_translate'))::int AS typed_sum
    FROM "UsageLog"
  `)
  console.log('AFTER:', after.rows[0])

  await pool.end()
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
