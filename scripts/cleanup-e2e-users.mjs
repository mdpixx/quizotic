#!/usr/bin/env node
/**
 * cleanup-e2e-users.mjs
 *
 * Removes the throwaway accounts the Playwright E2E suite creates, which
 * otherwise accumulate in the admin Users list and inflate the user count
 * (279 shown in admin, mostly "E2E Host" rows with "never" as last-active).
 *
 * SAFETY
 * ------
 * The only rows touched are users whose email ends in "@e2e.test". `.test` is
 * an RFC 2606 reserved TLD — it can never be delivered to and can never belong
 * to a real signup — so this filter cannot match a genuine user. Every email
 * the E2E suite generates uses it (verified against tests/e2e: e2e-http-*,
 * e2e-ui-*, e2e-fit-*, e2e-match-*, e2e-sched-*, e2e-shortq-*, e2e-test-host-*,
 * e2e-testimonial-*).
 *
 * Dry-run is the default. The deletes genuinely execute inside a transaction
 * that is then rolled back, so the preview exercises real foreign-key
 * constraints rather than guessing at them. Pass --commit to keep the changes.
 *
 * Quiz / Presentation / GameSession are optional relations on User and default
 * to SetNull, so deleting the user alone would orphan those rows and leave the
 * quiz and session counts wrong. They are deleted explicitly first.
 *
 *   node scripts/cleanup-e2e-users.mjs            # preview, changes nothing
 *   node scripts/cleanup-e2e-users.mjs --commit   # actually delete
 */

import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// `node scripts/...` is not `next`, so nothing has read .env yet and
// DATABASE_URL would be undefined. Reuse Next's own loader rather than adding a
// dotenv dependency. Imports are hoisted, so this runs before the client below.
nextEnv.loadEnvConfig(process.cwd())

// Prisma 7 requires a driver adapter at construction time — a bare
// `new PrismaClient()` throws. Mirrors src/lib/prisma.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] })

const EMAIL_SUFFIX = '@e2e.test'
const COMMIT = process.argv.includes('--commit')

/** Abort if the filter somehow matches an implausible share of the table. */
const MAX_SHARE = 0.9

class Rollback extends Error {}

function line() {
  console.log('─'.repeat(64))
}

async function main() {
  const totalUsers = await prisma.user.count()
  const targets = await prisma.user.findMany({
    where: { email: { endsWith: EMAIL_SUFFIX } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  line()
  console.log(`Mode              : ${COMMIT ? 'COMMIT (destructive)' : 'DRY RUN (rolled back)'}`)
  console.log(`Filter            : email ends with "${EMAIL_SUFFIX}"`)
  console.log(`Users in database : ${totalUsers}`)
  console.log(`Matched for delete: ${targets.length}`)
  console.log(`Real users kept   : ${totalUsers - targets.length}`)
  line()

  if (targets.length === 0) {
    console.log('Nothing to do — no E2E users found.')
    return
  }

  // Guard against a filter bug wiping the table.
  if (targets.length / Math.max(totalUsers, 1) > MAX_SHARE) {
    throw new Error(
      `Refusing to run: ${targets.length}/${totalUsers} users matched, above the ${MAX_SHARE * 100}% safety ceiling.`
    )
  }

  // Anything that merely *looks* like a test account but is not @e2e.test is
  // reported and deliberately left alone — the operator decides on those.
  const suspicious = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: { endsWith: EMAIL_SUFFIX } } },
        { OR: [{ email: { startsWith: 'e2e-' } }, { name: { equals: 'E2E Host' } }] },
      ],
    },
    select: { email: true },
    take: 20,
  })
  if (suspicious.length > 0) {
    console.log(`\n⚠  ${suspicious.length} account(s) look like tests but are NOT ${EMAIL_SUFFIX} — NOT touched:`)
    for (const s of suspicious) console.log(`     ${s.email}`)
    console.log('   Review these by hand if they should also go.\n')
  }

  const ids = targets.map(u => u.id)
  const first = targets[0]
  const last = targets[targets.length - 1]
  console.log(`Oldest match      : ${first.email}  (${first.createdAt.toISOString().slice(0, 10)})`)
  console.log(`Newest match      : ${last.email}  (${last.createdAt.toISOString().slice(0, 10)})`)

  const counts = {
    gameSessions: await prisma.gameSession.count({ where: { userId: { in: ids } } }),
    presentations: await prisma.presentation.count({ where: { userId: { in: ids } } }),
    quizzes: await prisma.quiz.count({ where: { userId: { in: ids } } }),
  }
  console.log(`\nOwned rows that would also be removed:`)
  console.log(`  game sessions   : ${counts.gameSessions}`)
  console.log(`  presentations   : ${counts.presentations}`)
  console.log(`  quizzes         : ${counts.quizzes}`)
  line()

  let deleted
  try {
    await prisma.$transaction(async tx => {
      // Order matters: these three are SetNull on user delete, so they must go
      // before the users or they survive as orphans.
      const gs = await tx.gameSession.deleteMany({ where: { userId: { in: ids } } })
      const pr = await tx.presentation.deleteMany({ where: { userId: { in: ids } } })
      const qz = await tx.quiz.deleteMany({ where: { userId: { in: ids } } })
      // Cascades handle accounts, sessions, subscription, payments, usageLogs,
      // creditGrants, testimonialInvites and flagAssignments.
      const us = await tx.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })

      deleted = { gameSessions: gs.count, presentations: pr.count, quizzes: qz.count, users: us.count }

      if (!COMMIT) throw new Rollback()
    }, { timeout: 120_000 })
  } catch (err) {
    if (!(err instanceof Rollback)) throw err
  }

  console.log('Deleted:')
  console.log(`  game sessions   : ${deleted.gameSessions}`)
  console.log(`  presentations   : ${deleted.presentations}`)
  console.log(`  quizzes         : ${deleted.quizzes}`)
  console.log(`  users           : ${deleted.users}`)
  line()

  if (COMMIT) {
    const remaining = await prisma.user.count()
    console.log(`✓ Committed. Users now: ${remaining} (was ${totalUsers}).`)
  } else {
    console.log('DRY RUN — transaction rolled back, nothing changed.')
    console.log('Re-run with --commit to apply.')
  }
}

main()
  .catch(err => {
    console.error('\n✗ Failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
