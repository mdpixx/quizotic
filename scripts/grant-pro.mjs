// Grant Pro to a user by email, or pre-provision Pro for an email that has no
// account yet (--pending). Mirrors the upsert in src/app/api/admin/grant-pro.
//
// Run with:
//   railway run --service quizotic-beta node scripts/grant-pro.mjs <email> [months=12]
//   railway run --service quizotic-beta node scripts/grant-pro.mjs <email> <months> --pending
//
// --pending stores a PendingProGrant that NextAuth events.createUser applies
// automatically when the person first signs up. If the user already exists,
// the grant is applied directly regardless of the flag.

import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const email = (process.argv[2] || '').trim().toLowerCase()
const months = Number.parseInt(process.argv[3] || '12', 10)
const pending = process.argv.includes('--pending')

async function main() {
  if (!email) {
    console.error('Usage: node scripts/grant-pro.mjs <email> [months] [--pending]')
    process.exit(1)
  }
  if (!Number.isFinite(months) || months <= 0) {
    console.error(`Invalid months: ${process.argv[3]}`)
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setMonth(expiresAt.getMonth() + months)

  const userRes = await pool.query(`SELECT id FROM "User" WHERE lower(email) = $1`, [email])

  if (userRes.rowCount > 0) {
    const userId = userRes.rows[0].id
    await pool.query(
      `INSERT INTO "Subscription" (id, "userId", plan, status, provider, "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
       VALUES ($1, $2, 'pro_monthly', 'active', 'manual', $3, $4, now(), now())
       ON CONFLICT ("userId") DO UPDATE SET
         plan = 'pro_monthly', status = 'active', provider = 'manual',
         "currentPeriodStart" = $3, "currentPeriodEnd" = $4, "updatedAt" = now()`,
      [randomUUID(), userId, now, expiresAt]
    )
    // If a pending grant existed for this email, mark it applied so it won't re-fire.
    await pool.query(
      `UPDATE "PendingProGrant" SET "appliedAt" = now() WHERE email = $1 AND "appliedAt" IS NULL`,
      [email]
    )
    const check = await pool.query(
      `SELECT plan, status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1`,
      [userId]
    )
    const s = check.rows[0]
    console.log(`GRANTED: ${email} -> plan=${s.plan} status=${s.status} expires=${s.currentPeriodEnd.toISOString()} (${months}mo)`)
  } else if (pending) {
    await pool.query(
      `INSERT INTO "PendingProGrant" (id, email, months, "createdAt")
       VALUES ($1, $2, $3, now())
       ON CONFLICT (email) DO UPDATE SET months = $3, "appliedAt" = NULL`,
      [randomUUID(), email, months]
    )
    console.log(`PENDING: stored ${months}mo Pro for ${email} — applies automatically on signup`)
  } else {
    console.error(`No user found with email: ${email}. Pass --pending to pre-provision before signup.`)
    await pool.end()
    process.exit(2)
  }

  await pool.end()
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
