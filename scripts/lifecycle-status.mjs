// Read-only diagnostic for the lifecycle auto-mailer.
//
// "Railway is ticking every hour but no mail arrived" has nine possible
// causes, eight of which are deliberate blocks. This prints every one of them
// in the order the worker evaluates them, so the answer is a glance rather
// than an investigation.
//
// Read-only by construction: nothing here writes, so it is safe to run against
// production.
//
//   railway run --service quizotic-beta node scripts/lifecycle-status.mjs
//
// Requires DATABASE_URL. Uses `pg` directly rather than Prisma so it runs
// without a generated client.

import { Pool } from 'pg'

const KILL_SWITCH = 'lifecycle_emails_enabled'
const HOURS = 60 * 60 * 1000
const DAYS = 24 * HOURS
const IN_APP_GRACE_MS = 48 * HOURS
const SEQUENCE_WINDOW_MS = 30 * DAYS

const ok = s => `\x1b[32m${s}\x1b[0m`
const bad = s => `\x1b[31m${s}\x1b[0m`
const warn = s => `\x1b[33m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

const heading = title => console.log(`\n\x1b[1m${title}\x1b[0m`)

/** Mirrors guards.ts — unset or empty means dry run, only an explicit false disables it. */
function isDryRun(raw) {
  if (raw === undefined || raw === '') return true
  return raw.toLowerCase() !== 'false' && raw !== '0'
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run this through `railway run` or with the env loaded.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // ---- 1. Environment -----------------------------------------------------
  heading('Environment')
  const dry = isDryRun(process.env.LIFECYCLE_DRY_RUN)
  const allowlist = (process.env.LIFECYCLE_TEST_EMAILS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const row = (label, value, good) =>
    console.log(`  ${label.padEnd(24)} ${good ? ok(value) : bad(value)}`)

  row('CRON_SECRET', process.env.CRON_SECRET ? 'set' : 'MISSING → tick answers 503', !!process.env.CRON_SECRET)
  row('RESEND_API_KEY', process.env.RESEND_API_KEY ? 'set' : 'MISSING → lifecycle sends fail', !!process.env.RESEND_API_KEY)
  row(
    'LIFECYCLE_DRY_RUN',
    `${process.env.LIFECYCLE_DRY_RUN ?? '<unset>'} → ${dry ? 'DRY RUN, nothing is sent' : 'live'}`,
    !dry,
  )
  console.log(
    `  ${'LIFECYCLE_TEST_EMAILS'.padEnd(24)} ${
      allowlist.length ? warn(`${allowlist.length} allowlisted — everyone else is blocked`) : ok('empty (no restriction)')
    }`,
  )
  console.log(`  ${'EMAIL_FROM_LIFECYCLE'.padEnd(24)} ${process.env.EMAIL_FROM_LIFECYCLE ?? dim('<unset, using default>')}`)
  console.log(`  ${'NEXT_PUBLIC_APP_URL'.padEnd(24)} ${process.env.NEXT_PUBLIC_APP_URL ?? dim('<unset>')}`)

  // ---- 2. Kill switch -----------------------------------------------------
  heading('Kill switch (guard 1)')
  const flag = await pool.query(
    'SELECT enabled, "rolloutPercent", "updatedAt" FROM "FeatureFlag" WHERE key = $1',
    [KILL_SWITCH],
  )
  if (flag.rowCount === 0) {
    console.log(`  ${bad('no FeatureFlag row')} for "${KILL_SWITCH}" → every send is blocked`)
  } else {
    const f = flag.rows[0]
    const live = f.enabled && f.rolloutPercent > 0
    console.log(
      `  enabled=${f.enabled ? ok('true') : bad('false')}  rolloutPercent=${
        f.rolloutPercent > 0 ? ok(f.rolloutPercent) : bad(f.rolloutPercent)
      }  ${dim(`updated ${f.updatedAt.toISOString()}`)}`,
    )
    if (!live) console.log(`  → ${bad('blocked')}: every candidate is refused with reason "kill-switch"`)
  }

  const assignments = await pool.query(
    `SELECT a.enabled, count(*)::int AS n
       FROM "FeatureFlagAssignment" a JOIN "FeatureFlag" f ON f.id = a."flagId"
      WHERE f.key = $1 GROUP BY a.enabled`,
    [KILL_SWITCH],
  )
  if (assignments.rowCount) {
    for (const a of assignments.rows) console.log(`  per-user override enabled=${a.enabled}: ${a.n}`)
  } else {
    console.log(dim('  no per-user overrides'))
  }

  // ---- 3. The queue -------------------------------------------------------
  heading('Nudge queue')
  const states = await pool.query('SELECT state, count(*)::int AS n FROM "Nudge" GROUP BY state ORDER BY n DESC')
  if (states.rowCount === 0) {
    console.log(`  ${warn('empty')} — nothing has been enqueued yet, so there is nothing to send`)
  } else {
    for (const s of states.rows) console.log(`  ${String(s.state).padEnd(12)} ${s.n}`)
  }

  const dueCutoff = new Date(Date.now() - IN_APP_GRACE_MS)
  const due = await pool.query(
    `SELECT count(*)::int AS n FROM "Nudge"
      WHERE state = 'pending' AND "shownAt" IS NULL AND "createdAt" <= $1`,
    [dueCutoff],
  )
  console.log(
    `  ${'past the 48h grace'.padEnd(12)} ${due.rows[0].n} ${dim('(pending, card never seen — these are the email candidates)')}`,
  )

  const byCampaign = await pool.query(
    'SELECT "campaignKey", state, count(*)::int AS n FROM "Nudge" GROUP BY 1, 2 ORDER BY 1, 2',
  )
  for (const c of byCampaign.rows) console.log(dim(`    ${c.campaignKey} / ${c.state}: ${c.n}`))

  // ---- 4. What actually left the building ---------------------------------
  heading('Lifecycle email log')
  const logs = await pool.query(
    `SELECT status, count(*)::int AS n FROM "EmailLog"
      WHERE category = 'lifecycle' GROUP BY status ORDER BY n DESC`,
  )
  if (logs.rowCount === 0) {
    console.log(`  ${warn('no rows')} — no lifecycle email has ever been attempted`)
  } else {
    for (const l of logs.rows) console.log(`  ${String(l.status).padEnd(12)} ${l.n}`)
    const recent = await pool.query(
      `SELECT "createdAt", status, "toEmail", subject, "errorMessage" FROM "EmailLog"
        WHERE category = 'lifecycle' ORDER BY "createdAt" DESC LIMIT 5`,
    )
    console.log(dim('  most recent:'))
    for (const r of recent.rows) {
      console.log(
        dim(`    ${r.createdAt.toISOString()}  ${r.status}  ${r.toEmail}  ${r.subject}${r.errorMessage ? `  (${r.errorMessage})` : ''}`),
      )
    }
  }

  // ---- 5. The population --------------------------------------------------
  heading('Population in the 30-day sequence window')
  const windowStart = new Date(Date.now() - SEQUENCE_WINDOW_MS)
  const tiers = await pool.query(
    `WITH u AS (
       SELECT us.id, us.onboarded, us."createdAt", us."lastActiveAt",
              (SELECT count(*) FROM "Quiz" q WHERE q."userId" = us.id) AS quizzes,
              (SELECT count(*) FROM "GameSession" g WHERE g."userId" = us.id AND g."participantCount" > 0) AS hosted
         FROM "User" us WHERE us."createdAt" >= $1
     )
     SELECT CASE
              WHEN hosted > 0 THEN '3 host (activated, exits)'
              WHEN quizzes > 0 THEN '2 builder'
              WHEN onboarded OR ("lastActiveAt" IS NOT NULL
                   AND "lastActiveAt" - "createdAt" > interval '24 hours') THEN '1 explorer'
              ELSE '0 ghost (never nudged)'
            END AS tier,
            count(*)::int AS n
       FROM u GROUP BY 1 ORDER BY 1`,
    [windowStart],
  )
  const total = tiers.rows.reduce((a, r) => a + r.n, 0)
  console.log(`  ${total} signups since ${windowStart.toISOString().slice(0, 10)}`)
  for (const t of tiers.rows) console.log(`    ${String(t.tier).padEnd(26)} ${t.n}`)

  const optOuts = await pool.query('SELECT count(*)::int AS n FROM "User" WHERE "lifecycleOptOutAt" IS NOT NULL')
  const suppressed = await pool.query('SELECT count(*)::int AS n FROM "EmailSuppression"')
  console.log(`  opted out: ${optOuts.rows[0].n}    suppressed addresses: ${suppressed.rows[0].n}`)

  // ---- Verdict ------------------------------------------------------------
  heading('Verdict')
  const flagLive = flag.rowCount > 0 && flag.rows[0].enabled && flag.rows[0].rolloutPercent > 0
  const blockers = []
  if (!process.env.CRON_SECRET) blockers.push('CRON_SECRET unset — the tick endpoint answers 503 and never runs')
  if (!flagLive) blockers.push(`feature flag "${KILL_SWITCH}" is off — guard 1 blocks every send`)
  if (dry) blockers.push('LIFECYCLE_DRY_RUN is on — sends are logged, not delivered')
  if (allowlist.length) blockers.push(`LIFECYCLE_TEST_EMAILS restricts sending to ${allowlist.length} address(es)`)
  if (!process.env.RESEND_API_KEY) blockers.push('RESEND_API_KEY unset — the transport cannot deliver')

  if (blockers.length === 0) {
    console.log(`  ${ok('No configuration blockers.')} Any send that does not happen is a per-user guard`)
    console.log('  (quiet hours, budget, cooldown, seen-in-app, activated) doing its job.')
  } else {
    console.log(`  ${bad(`${blockers.length} blocker(s) — no lifecycle email can be delivered:`)}`)
    for (const b of blockers) console.log(`    • ${b}`)
  }
  console.log()

  await pool.end()
}

main().catch(err => {
  console.error('lifecycle-status failed:', err)
  process.exit(1)
})
