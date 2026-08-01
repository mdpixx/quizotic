import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('Railway deployment safety', () => {
  it('does not expose the retired monorepo rsync deployment command', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> }

    expect(packageJson.scripts).not.toHaveProperty('deploy')
    expect(packageJson.scripts).not.toHaveProperty('deploy:force')
    expect(existsSync(join(ROOT, 'scripts/deploy-to-railway.sh'))).toBe(false)
  })
})

// A Railway `deploy.startCommand` REPLACES the image CMD, so anything the
// Dockerfile chains before `node server.mjs` simply never runs in production.
// That is how `SessionFeedback` stayed absent from the live database for weeks
// while its migration sat committed in the repo: the schema shim only ever ran
// via the CMD, which Railway had overridden. These tests pin the real boot path.
describe('production schema bootstrap', () => {
  const SHIM = 'scripts/ensure-critical-columns.mjs'

  const scripts = () =>
    (JSON.parse(read('package.json')) as { scripts?: Record<string, string> }).scripts ?? {}

  const startCommand = () =>
    (JSON.parse(read('railway.json')) as { deploy?: { startCommand?: string } }).deploy?.startCommand ?? ''

  /**
   * The command Railway runs, with `npm run <script>` expanded to completion —
   * scripts chain into each other (start → repair-schema), so one pass is not
   * enough. Bounded so a self-referential script can't spin.
   */
  const effectiveBootChain = (): string => {
    const table = scripts()
    let chain = startCommand()
    for (let depth = 0; depth < 10 && /npm run [\w:-]+/.test(chain); depth++) {
      chain = chain.replace(/npm run ([\w:-]+)/g, (whole, name: string) => table[name] ?? whole)
    }
    return chain
  }

  it('does not put shell operators in the Railway start command', () => {
    // Railway does NOT run startCommand through a shell. A `&&` there is passed
    // to the first binary as bare argv: `node shim.mjs && npm run start` ran the
    // shim, ignored the rest, exited 0, and the container stopped — deploy
    // FAILED with the shim's output as the last thing in the log and no npm
    // banner at all. Chain steps inside an npm script instead; npm runs script
    // bodies through sh, so operators work there.
    expect(startCommand()).not.toMatch(/&&|\|\||[;|]|\$\(/)
  })

  it('runs the idempotent schema shim before the server on the real boot path', () => {
    const chain = effectiveBootChain()

    expect(chain).toContain(SHIM)
    // The shim must precede the server, or the first queries race the DDL.
    expect(chain.indexOf(SHIM)).toBeLessThan(chain.indexOf('server.mjs'))
  })

  it('boots the Dockerfile through the same npm script, so it cannot drift', () => {
    // The image CMD is not the production path (Railway's startCommand replaces
    // it), but a local `docker run` or any non-Railway host uses it. Both must
    // delegate to package.json's `start` so there is one boot chain, not two
    // that can silently diverge — which is how the shim came to be skipped in
    // production in the first place.
    expect(read('Dockerfile')).toMatch(/CMD \["npm", "run", "start"\]/)
    expect(startCommand()).toBe('npm run start')
  })

  it('mirrors every migration-created table into the shim', () => {
    // The shim is the ONLY thing creating tables in production right now (the
    // live _prisma_migrations ledger holds a handful of rows against ~30
    // migration directories). So a migration that adds a table and is not
    // mirrored here ships code that 500s against a table that does not exist.
    const shim = read(SHIM)
    const mirrored = new Set(
      [...shim.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/g)].map(m => m[1]),
    )

    const migrationsDir = join(ROOT, 'prisma/migrations')
    const declared = new Set<string>()
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const sqlPath = join(migrationsDir, dir.name, 'migration.sql')
      if (!existsSync(sqlPath)) continue
      for (const m of readFileSync(sqlPath, 'utf8').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/g)) {
        declared.add(m[1]!)
      }
    }

    // 0_init builds the baseline schema every environment already has; the
    // mirror covers tables added AFTER that point, which are the ones that can
    // be missing from a long-lived database.
    const baseline = new Set(
      [...read('prisma/migrations/0_init/migration.sql').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/g)]
        .map(m => m[1]!),
    )

    const unmirrored = [...declared].filter(t => !baseline.has(t) && !mirrored.has(t)).sort()
    expect(unmirrored, `add these tables to ${SHIM} (CRITICAL_TABLES + CRITICAL_INDEXES)`).toEqual([])
  })

  it('mirrors every migration-added column into the shim', () => {
    // The table check above catches a whole missing table. A missing *column*
    // is the quieter version of the same incident and has already happened
    // here more than once — the feature ships, the shim never learned about
    // the column, and every write to that table 500s on a database that was
    // never rebuilt from the migration folder.
    //
    // Columns on tables the shim creates outright are already covered by the
    // CREATE TABLE statement, so they are excluded.
    const shim = read(SHIM)
    const mirrored = new Set(
      [...shim.matchAll(/\{\s*table:\s*'(\w+)',\s*column:\s*'(\w+)'/g)].map(m => `${m[1]}.${m[2]}`),
    )
    const shimCreatedTables = new Set(
      [...shim.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/g)].map(m => m[1]!),
    )

    const migrationsDir = join(ROOT, 'prisma/migrations')
    const declared = new Set<string>()
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const sqlPath = join(migrationsDir, dir.name, 'migration.sql')
      if (!existsSync(sqlPath)) continue
      const sql = readFileSync(sqlPath, 'utf8')
      for (const m of sql.matchAll(/ALTER TABLE "(\w+)"\s+ADD COLUMN (?:IF NOT EXISTS )?"(\w+)"/gi)) {
        declared.add(`${m[1]}.${m[2]}`)
      }
    }

    const unmirrored = [...declared]
      .filter(c => !mirrored.has(c) && !shimCreatedTables.has(c.split('.')[0]!))
      .sort()
    expect(unmirrored, `add these columns to ${SHIM} (CRITICAL_COLUMNS)`).toEqual([])
  })
})

// The unique key on (userId, campaignKey) is what makes "a campaign can never
// be sent to the same person twice" a property of the database rather than a
// promise made by the worker. It has to hold in all three places that describe
// the schema, because production is built from the shim and reviewed from the
// Prisma schema — a mismatch means the guarantee silently is not there.
describe('lifecycle nudge schema', () => {
  const files = {
    prisma: read('prisma/schema.prisma'),
    migration: read('prisma/migrations/20260801_lifecycle_nudges/migration.sql'),
    shim: read('scripts/ensure-critical-columns.mjs'),
  }

  it('declares the Nudge idempotency key in the Prisma schema', () => {
    expect(files.prisma).toMatch(/@@unique\(\[userId, campaignKey\]\)/)
  })

  it('creates the Nudge idempotency key in the migration and the shim', () => {
    for (const [name, sql] of [['migration', files.migration], ['shim', files.shim]] as const) {
      expect(
        sql,
        `${name} must create a UNIQUE index on Nudge(userId, campaignKey)`,
      ).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "Nudge_userId_campaignKey_key"/)
    }
  })

  it('makes the unsubscribe token unique everywhere', () => {
    // A collision here would hand one user the power to unsubscribe another.
    expect(files.prisma).toMatch(/unsubscribeToken\s+String\?\s+@unique/)
    expect(files.migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "User_unsubscribeToken_key"/)
    expect(files.shim).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "User_unsubscribeToken_key"/)
  })

  it('cascades nudges when a user is deleted', () => {
    // Nudges are not an audit trail; they must not outlive the account.
    expect(files.migration).toMatch(
      /CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/,
    )
    expect(files.shim).toMatch(
      /CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/,
    )
  })
})
