// One-off diagnostic: what does UsageLog actually contain for the user
// the admin panel is showing 15/30 for? Compares the typed column vs the
// JSON metadata to detect the backfill gap.
//
// Run with:  railway run --service quizotic-beta node scripts/_diagnose-user-usage.mjs <email>

import { Pool } from 'pg'

const email = process.argv[2] || 'saughag@gmail.com'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const userRes = await pool.query(`SELECT id, email, name, "lastActiveAt" FROM "User" WHERE email = $1`, [email.toLowerCase()])
  if (userRes.rowCount === 0) {
    console.log(`No user with email ${email}`)
    process.exit(0)
  }
  const user = userRes.rows[0]
  console.log('USER:', JSON.stringify(user, null, 2))

  // All UsageLog for this user this month, with both the typed column
  // and the JSON-shadow value side-by-side.
  const logsRes = await pool.query(`
    SELECT
      id,
      action,
      "questionCount" AS typed_count,
      (metadata->>'questionCount')::text AS json_count,
      model,
      metadata->>'mode' AS mode,
      "createdAt"
    FROM "UsageLog"
    WHERE "userId" = $1
      AND "createdAt" >= date_trunc('month', now())
    ORDER BY "createdAt" DESC
  `, [user.id])
  console.log(`\nUSAGE LOG (this month, ${logsRes.rowCount} rows):`)
  for (const r of logsRes.rows) {
    console.log(`  ${r.createdAt.toISOString()}  ${r.action.padEnd(13)}  typed=${String(r.typed_count).padStart(3)}  json=${String(r.json_count ?? 'null').padStart(4)}  mode=${r.mode ?? 'null'}  model=${r.model ?? 'null'}`)
  }

  // Aggregates as the quota library would compute them.
  const sumTyped = logsRes.rows.reduce((s, r) => s + (Number(r.typed_count) || 0), 0)
  const sumJson = logsRes.rows.reduce((s, r) => s + (Number(r.json_count) || 0), 0)
  const sumWithFallback = sumTyped === 0 && logsRes.rowCount > 0 ? logsRes.rowCount * 5 : sumTyped

  console.log(`\nAGGREGATES (this month):`)
  console.log(`  sum(typed questionCount):  ${sumTyped}    <- this is what the admin panel shows`)
  console.log(`  sum(json metadata.questionCount):  ${sumJson}    <- truth before backfill`)
  console.log(`  what the library would return: ${sumWithFallback}    (fallback fires when typed=0 but rows exist: rows*5)`)

  // Enhancement bucket — these are presentation AI enhancements. Each row
  // counts as 1 toward the user's enhancement quota. metadata.slideCount
  // tells us how many slides were generated in that single click.
  const enhanceRes = await pool.query(`
    SELECT
      "questionCount" AS typed_count,
      (metadata->>'slideCount')::text AS slide_count,
      metadata->>'level' AS level,
      model,
      "createdAt"
    FROM "UsageLog"
    WHERE "userId" = $1
      AND action = 'ai_enhance'
      AND "createdAt" >= date_trunc('month', now())
    ORDER BY "createdAt" DESC
  `, [user.id])
  console.log(`\nENHANCEMENT BUCKET (this month, ${enhanceRes.rowCount} rows = enhancement clicks):`)
  for (const r of enhanceRes.rows) {
    console.log(`  ${r.createdAt.toISOString()}  slideCount=${String(r.slide_count ?? '?').padStart(3)}  level=${r.level ?? 'null'}  model=${r.model ?? 'null'}`)
  }
  const slideCountSum = enhanceRes.rows.reduce((s, r) => s + (Number(r.slide_count) || 0), 0)
  console.log(`  Enhancement clicks: ${enhanceRes.rowCount}    (this is what counts toward the Enhancements quota)`)
  console.log(`  Total slides generated across those clicks: ${slideCountSum}`)

  // CreditGrant rows (for the bonus credit display)
  const grantsRes = await pool.query(`SELECT bucket, amount, reason, "createdAt" FROM "CreditGrant" WHERE "userId" = $1`, [user.id])
  console.log(`\nCREDIT GRANTS: ${grantsRes.rowCount} row(s)`)
  for (const g of grantsRes.rows) console.log(`  ${g.createdAt.toISOString()}  ${g.bucket}  ${g.amount}  "${g.reason}"`)

  await pool.end()
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
