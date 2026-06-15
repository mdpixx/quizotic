// Export all registered Quizotic users with their session counts to an Excel sheet.
//
// Run with:
//   node scripts/export-users-xlsx.mjs
//   (DATABASE_URL must be set — loaded from .env automatically)
//
// Output: projects/Quizotic/exports/quizotic-users-YYYY-MM-DD.xlsx

import { Pool } from 'pg'
import ExcelJS from 'exceljs'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

// Load .env when running locally
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  console.log('Querying Quizotic users + session counts...')

  const { rows } = await pool.query(`
    SELECT
      u.name,
      u.email,
      u.role,
      u."orgType"        AS org_type,
      u.organization,
      u.country,
      u."createdAt"      AS joined_at,
      u."lastActiveAt"   AS last_active_at,
      COUNT(g.id)::int   AS sessions_conducted
    FROM "User" u
    LEFT JOIN "GameSession" g ON g."userId" = u.id
    GROUP BY u.id
    ORDER BY sessions_conducted DESC, u."createdAt" ASC
  `)
  await pool.end()

  console.log(`Found ${rows.length} users.`)

  // Build workbook
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Quizotic'
  wb.created = new Date()

  const ws = wb.addWorksheet('Quizotic Users', { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = [
    { header: 'Name',               key: 'name',               width: 24 },
    { header: 'Email',              key: 'email',              width: 32 },
    { header: 'Sessions Conducted', key: 'sessions_conducted', width: 20 },
    { header: 'Role',               key: 'role',               width: 16 },
    { header: 'Org Type',           key: 'org_type',           width: 16 },
    { header: 'Organization',       key: 'organization',       width: 28 },
    { header: 'Country',            key: 'country',            width: 10 },
    { header: 'Joined',             key: 'joined_at',          width: 22 },
    { header: 'Last Active',        key: 'last_active_at',     width: 22 },
  ]

  // Bold header row
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F4FD' }, // light blue tint
  }
  headerRow.border = {
    bottom: { style: 'thin', color: { argb: 'FF93C6E7' } },
  }

  // Add data rows
  for (const row of rows) {
    ws.addRow({
      name:               row.name ?? '',
      email:              row.email,
      sessions_conducted: row.sessions_conducted,
      role:               row.role ?? '',
      org_type:           row.org_type ?? '',
      organization:       row.organization ?? '',
      country:            row.country ?? '',
      joined_at:          row.joined_at ? new Date(row.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      last_active_at:     row.last_active_at ? new Date(row.last_active_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    })
  }

  // Alternate row shading
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    if (rowNumber % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FBFF' } }
      })
    }
  })

  // Output filename
  const today = new Date().toISOString().slice(0, 10)
  const outDir = join(__dir, '..', 'exports')
  const outPath = join(outDir, `quizotic-users-${today}.xlsx`)

  await wb.xlsx.writeFile(outPath)
  console.log(`Saved: ${outPath}`)
  console.log(`\nTop 5 hosts by sessions:`)
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${(r.name || '(no name)').padEnd(24)} ${r.email.padEnd(36)} ${r.sessions_conducted} sessions`)
  }
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
