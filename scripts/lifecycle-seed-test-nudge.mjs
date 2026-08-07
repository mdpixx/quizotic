// Make one throwaway account eligible for a real lifecycle email, now.
//
// The rollout has a hole in it: stage 2 says "allowlist yourself and check the
// rendering", but anyone who has hosted a session is Tier 3, and Tier 3 exits
// the sequence permanently — guard 8 refuses them with reason 'activated'. So
// the people most likely to run the test are precisely the ones who cannot
// receive the mail. A brand-new account cannot either: the campaign is gated
// to 48h after signup and the nudge then waits 48h unseen, so the first real
// send is four days out.
//
// This closes that gap by ageing a disposable account rather than faking a
// send: it backdates the signup and seeds a pending nudge with an old
// createdAt. Nothing else is bypassed. The next hourly tick picks it up and
// mails it through the genuine path — real templates, real Resend transport,
// real unsubscribe token, and every one of the ten guards still enforced. What
// lands in the inbox is exactly what a user would get.
//
//   railway run --service quizotic-beta \
//     node scripts/lifecycle-seed-test-nudge.mjs you+lctest@example.com
//
// Safety: refuses any address not in LIFECYCLE_TEST_EMAILS, and refuses any
// account that has hosted a session or is older than 30 days. Both exist to
// make it hard to point this at a real user's record, because backdating a
// signup date is not something to do by accident.

import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const HOURS = 60 * 60 * 1000
const DAYS = 24 * HOURS

const bad = s => `\x1b[31m${s}\x1b[0m`
const ok = s => `\x1b[32m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

const die = msg => {
  console.error(`\n${bad('refused:')} ${msg}\n`)
  process.exit(1)
}

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!email) die('pass the test account email as the first argument')
if (!process.env.DATABASE_URL) die('DATABASE_URL is not set — run this through `railway run`')

// The allowlist is the consent boundary. If the address is not already cleared
// for test sends, seeding a nudge for it would mail someone who never opted in.
const allowlist = (process.env.LIFECYCLE_TEST_EMAILS ?? '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

if (allowlist.length === 0) {
  die('LIFECYCLE_TEST_EMAILS is empty. Set it to the test address first, so a\n' +
      '          mistake here cannot reach anyone else.')
}
if (!allowlist.includes(email)) {
  die(`${email} is not in LIFECYCLE_TEST_EMAILS (${allowlist.join(', ')})`)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const now = Date.now()

const user = (
  await pool.query(
    `SELECT id, email, name, onboarded, "createdAt", "lastActiveAt", "lifecycleOptOutAt"
       FROM "User" WHERE lower(email) = $1`,
    [email],
  )
).rows[0]

if (!user) die(`no user with email ${email}. Sign up first, then re-run.`)

const [{ count: quizzes }] = (
  await pool.query('SELECT count(*)::int AS count FROM "Quiz" WHERE "userId" = $1', [user.id])
).rows
const [{ count: hosted }] = (
  await pool.query(
    'SELECT count(*)::int AS count FROM "GameSession" WHERE "userId" = $1 AND "participantCount" > 0',
    [user.id],
  )
).rows

// Tier 3 exits the sequence permanently. Seeding a nudge for one would waste a
// tick and teach nothing — the guard would refuse it with 'activated'.
if (hosted > 0) {
  die(
    `${email} has hosted ${hosted} real session(s), so it is Tier 3 (activated) and\n` +
    '          permanently out of the sequence. Use a fresh throwaway signup instead.',
  )
}
if (now - new Date(user.createdAt).getTime() > 30 * DAYS) {
  die(`${email} signed up more than 30 days ago — that does not look like a throwaway
          test account, and this script rewrites the signup date.`)
}
if (user.lifecycleOptOutAt) {
  die(`${email} has opted out of lifecycle mail. Re-subscribe first, or use another address.`)
}

const suppressed = (
  await pool.query('SELECT reason FROM "EmailSuppression" WHERE email = $1', [email])
).rows[0]
if (suppressed) die(`${email} is on the suppression list (${suppressed.reason}). Clear it first.`)

// Tier drives which campaign is applicable — guard 8 re-checks this at send
// time, so seeding the wrong one produces 'not-applicable' rather than mail.
const tier = quizzes > 0 ? 2 : user.onboarded ? 1 : 0
if (tier === 0) {
  die(
    `${email} is Tier 0 (never onboarded, no quiz) and Tier 0 is never nudged, by design.\n` +
    '          Finish onboarding on that account, or create one quiz to reach Tier 2.',
  )
}
const campaignKey = tier === 2 ? 'activation.host_first_session' : 'activation.create_first_quiz'
const priority = tier === 2 ? 1 : 2

// Old enough to clear the campaign gate (72h is the later of the two) with room
// to spare, and still inside the 30-day sequence window.
const backdatedSignup = new Date(now - 6 * DAYS)
// Past the 48h in-app grace. lastActiveAt must stay behind the nudge's
// createdAt or the worker reads it as "saw the card and ignored it".
const nudgeCreatedAt = new Date(now - 3 * DAYS)

console.log(`\nSeeding a real nudge for ${ok(email)} ${dim(`(user ${user.id})`)}`)
console.log(`  tier ${tier} · ${quizzes} quiz(zes) · ${hosted} hosted session(s)`)
console.log(`  campaign: ${campaignKey}`)

await pool.query('BEGIN')
try {
  await pool.query(
    `UPDATE "User" SET "createdAt" = $2, "lastActiveAt" = $2 WHERE id = $1`,
    [user.id, backdatedSignup],
  )

  // Clear any prior nudge for this campaign so the run is repeatable. Scoped to
  // this one test user, and this campaign only.
  await pool.query('DELETE FROM "Nudge" WHERE "userId" = $1 AND "campaignKey" = $2', [
    user.id,
    campaignKey,
  ])

  await pool.query(
    `INSERT INTO "Nudge" (id, "userId", "campaignKey", priority, state, "createdAt", "expiresAt")
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
    [
      randomUUID(),
      user.id,
      campaignKey,
      priority,
      nudgeCreatedAt,
      new Date(backdatedSignup.getTime() + 30 * DAYS),
    ],
  )
  await pool.query('COMMIT')
} catch (err) {
  await pool.query('ROLLBACK')
  throw err
}

// The remaining reasons this could still not send, so a quiet tick is
// diagnosable rather than mysterious.
const recent = (
  await pool.query(
    `SELECT count(*)::int AS count FROM "EmailLog"
      WHERE "userId" = $1 AND category = 'lifecycle' AND status = 'sent'
        AND "createdAt" >= $2`,
    [user.id, new Date(now - 30 * DAYS)],
  )
).rows[0].count

console.log(`\n${ok('seeded.')} The next hourly tick will send it, provided:`)
console.log(`  · the kill switch flag is on             ${dim('admin → Feature Flags')}`)
console.log(`  · LIFECYCLE_DRY_RUN=false                ${dim('Railway variables')}`)
console.log(`  · the clock is inside 09:00–19:00 local  ${dim('quiet hours')}`)
console.log(
  `  · budget: ${recent}/2 lifecycle mails in the last 30 days ${
    recent >= 2 ? bad('← exhausted, this will not send') : ok('← ok')
  }`,
)
console.log(`\n${dim('Then check the inbox, and click the unsubscribe link — that link is the one')}`)
console.log(`${dim('thing you cannot fix after a real send has gone out.')}\n`)

await pool.end()
