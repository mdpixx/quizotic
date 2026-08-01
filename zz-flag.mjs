// One-off: create the lifecycle kill switch in a DISABLED state.
//
// With no row at all, isFeatureEnabled() already returns false, so this changes
// nothing behaviourally — it exists so the switch is visible and flippable in
// the admin UI rather than requiring someone to invent the key from memory.
//
// ON CONFLICT DO NOTHING so re-running can never re-disable a flag that has
// since been turned on.
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const KEY = 'lifecycle_emails_enabled'

const res = await pool.query(
  `INSERT INTO "FeatureFlag" (id, key, description, enabled, "rolloutPercent", "createdBy", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, false, 0, 'lifecycle-setup', NOW(), NOW())
   ON CONFLICT (key) DO NOTHING
   RETURNING id`,
  [
    randomUUID(),
    KEY,
    'Master kill switch for lifecycle activation nudges. OFF until a dry-run week has been reviewed. See docs/lifecycle-automation-spec.md §5 and §10.',
  ],
)

const row = await pool.query(
  `SELECT key, enabled, "rolloutPercent" FROM "FeatureFlag" WHERE key = $1`,
  [KEY],
)
console.log(res.rowCount ? 'created' : 'already existed', '→', JSON.stringify(row.rows[0]))
await pool.end()
