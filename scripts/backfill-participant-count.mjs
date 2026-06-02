// One-off backfill: GameSession.participantCount historically stored the
// connected-at-end count, undercounting sessions with churn (e.g. showed 50
// when 53 actually joined). Recompute from the authoritative Attendee table.
// Only ever INCREASES a count (never lowers a value), so it's safe to re-run.
//
// Run with:  railway run --service quizotic-beta node scripts/backfill-participant-count.mjs

import { Pool } from 'pg'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const res = await pool.query(`
    UPDATE "GameSession" g
    SET "participantCount" = sub.c
    FROM (
      SELECT "sessionId", COUNT(*)::int AS c
      FROM "Attendee"
      GROUP BY "sessionId"
    ) sub
    WHERE g.id = sub."sessionId"
      AND sub.c > g."participantCount"
    RETURNING g.id, g.code, g."participantCount"
  `)

  console.log(`Backfilled ${res.rowCount} session(s):`)
  for (const r of res.rows) {
    console.log(`  code=${r.code} -> participantCount=${r.participantCount}`)
  }

  await pool.end()
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
