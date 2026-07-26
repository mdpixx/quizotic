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

  it('runs the idempotent schema shim on the path Railway actually boots', () => {
    const railway = JSON.parse(read('railway.json')) as { deploy?: { startCommand?: string } }
    const startCommand = railway.deploy?.startCommand ?? ''

    expect(startCommand).toContain(SHIM)
    // The shim must precede the server, or the first queries race the DDL.
    expect(startCommand.indexOf(SHIM)).toBeLessThan(startCommand.indexOf('start'))
  })

  it('keeps the Dockerfile CMD in sync with that boot path', () => {
    // Not itself the production path, but it is what a local `docker run` and
    // any non-Railway host would use — it must not drift back into a state
    // where the shim is skipped.
    expect(read('Dockerfile')).toContain(SHIM)
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
})
