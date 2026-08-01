/**
 * Playwright global teardown — removes the throwaway accounts the suite creates.
 *
 * Without this, every E2E run leaves a fresh batch of "E2E Host" users behind.
 * They accumulated to the point of dominating the admin Users list and made the
 * headline user count meaningless.
 *
 * Only touches emails ending in "@e2e.test" — an RFC 2606 reserved TLD that can
 * never belong to a real signup. Quiz / Presentation / GameSession are SetNull
 * on user delete, so they are removed first or they survive as orphans and keep
 * inflating the quiz and session counts.
 *
 * Never throws: a cleanup failure must not turn a green E2E run red. It warns
 * and leaves the rows for scripts/cleanup-e2e-users.mjs to sweep up later.
 */

import * as nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Playwright runs in its own process, separate from the dev server, so .env has
// not been read here and DATABASE_URL would be undefined. Load it the way Next
// does rather than adding a dotenv dependency.
//
// The import has to tolerate two different interops. @next/env is CJS that sets
// `__esModule: true` but exports no `default`, so:
//   - Node's ESM loader (scripts/*.mjs) hands back module.exports as `default`
//   - Playwright transpiles this file to CJS, where the `__esModule` marker
//     tells the interop to skip wrapping, so `.default` is undefined
//
// A plain `import nextEnv from '@next/env'` therefore works in the .mjs sibling
// script and throws here, at module scope — which meant globalTeardown was never
// even registered and the throwaway accounts this file exists to delete were
// silently accumulating in the production database.
const loadEnvConfig =
  (nextEnv as { loadEnvConfig?: typeof import('@next/env').loadEnvConfig }).loadEnvConfig ??
  (nextEnv as unknown as { default?: typeof import('@next/env') }).default?.loadEnvConfig

loadEnvConfig?.(process.cwd())

const EMAIL_SUFFIX = '@e2e.test'

export default async function globalTeardown() {
  // Opt-out for the rare case where you want to inspect what a run produced.
  if (process.env.KEEP_E2E_USERS === '1') {
    console.log('[e2e-teardown] KEEP_E2E_USERS=1 — leaving test accounts in place')
    return
  }

  // Prisma 7 requires a driver adapter at construction time — a bare
  // `new PrismaClient()` throws. Mirrors src/lib/prisma.ts.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] })
  try {
    const ids = (
      await prisma.user.findMany({
        where: { email: { endsWith: EMAIL_SUFFIX } },
        select: { id: true },
      })
    ).map(u => u.id)

    if (ids.length === 0) return

    await prisma.$transaction(async tx => {
      await tx.gameSession.deleteMany({ where: { userId: { in: ids } } })
      await tx.presentation.deleteMany({ where: { userId: { in: ids } } })
      await tx.quiz.deleteMany({ where: { userId: { in: ids } } })
      await tx.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
    })

    console.log(`[e2e-teardown] removed ${ids.length} test account(s)`)
  } catch (err) {
    console.warn(
      `[e2e-teardown] cleanup failed (test result unaffected): ${err instanceof Error ? err.message : String(err)}`
    )
    console.warn('[e2e-teardown] run `node scripts/cleanup-e2e-users.mjs --commit` to sweep manually')
  } finally {
    await prisma.$disconnect()
  }
}
