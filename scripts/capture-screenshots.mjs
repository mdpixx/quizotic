// Capture Scheduled Quiz screenshots for the testimonial email.
// Uses Playwright directly with a seeded auth cookie so we can reach the host dashboard.
//
// Run: node scripts/capture-screenshots.mjs
// Output: exports/screenshots/scheduled-list.png
//         exports/screenshots/scheduled-create.png

import { chromium } from 'playwright'
import { encode }   from '@auth/core/jwt'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env
const envPath = join(__dir, '..', '.env')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const BASE_URL    = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
const IS_HTTPS    = BASE_URL.startsWith('https://')
const COOKIE_NAME = IS_HTTPS ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
const SECRET      = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

const outDir = join(__dir, '..', 'exports', 'screenshots')
mkdirSync(outDir, { recursive: true })

// ─── Seed a scheduled game session so the list page has content ───────────────

async function seedScheduledSession(userId) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    // Find Mahesh's first quiz
    const quizRes = await pool.query(
      `SELECT id, title FROM "Quiz" WHERE "userId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
      [userId]
    )
    if (!quizRes.rowCount) {
      console.log('  (no quizzes found — screenshot will show empty state)')
      await pool.end()
      return null
    }
    const quiz = quizRes.rows[0]

    // Check if a scheduled session already exists (avoid double-seeding)
    const existing = await pool.query(
      `SELECT id FROM "GameSession" WHERE "userId" = $1 AND mode = 'async' AND status = 'waiting' AND "closesAt" IS NOT NULL LIMIT 1`,
      [userId]
    )
    if (existing.rowCount) {
      console.log(`  Using existing scheduled session id=${existing.rows[0].id}`)
      await pool.end()
      return quiz.title
    }

    // Insert a seeded scheduled session 10 min from now, closing in 7 days
    const opensAt  = new Date(Date.now() + 10 * 60 * 1000)
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const code = 'SCR' + Math.random().toString(36).slice(2, 5).toUpperCase()

    await pool.query(
      `INSERT INTO "GameSession" (id, code, type, "quizId", "userId", status, mode, "opensAt", "closesAt", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'quiz', $2, $3, 'waiting', 'async', $4, $5, now(), now())`,
      [code, quiz.id, userId, opensAt, closesAt]
    )
    console.log(`  Seeded scheduled session: "${quiz.title}" opens ${opensAt.toLocaleString('en-IN')}`)
    await pool.end()
    return quiz.title
  } catch (err) {
    console.warn('  Seed skipped:', err.message)
    await pool.end()
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const USER_ID = 'cmnljwlfa00000cofqse5y2df'
  const now     = Math.floor(Date.now() / 1000)

  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Cookie:   ${COOKIE_NAME}`)
  console.log('')

  // 1. Seed a scheduled session so the list isn't empty
  console.log('Seeding scheduled quiz session...')
  await seedScheduledSession(USER_ID)

  // 2. Build JWT
  console.log('Building session JWT...')
  const jwtToken = await encode({
    token: {
      sub:       USER_ID,
      email:     'dhiman.mahesh@gmail.com',
      name:      'Mahesh Dhiman',
      userId:    USER_ID,
      onboarded: true,
      iat:       now,
      exp:       now + 24 * 60 * 60,
      jti:       `screenshot-${Date.now()}`,
    },
    secret: SECRET,
    salt:   COOKIE_NAME,
  })

  // 3. Launch browser
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // retina-quality
  })

  // 4. Set auth cookie via Playwright context API (bypasses __Secure- restrictions)
  const domain = new URL(BASE_URL).hostname
  await context.addCookies([{
    name:     COOKIE_NAME,
    value:    jwtToken,
    domain,
    path:     '/',
    httpOnly: true,
    secure:   IS_HTTPS,
    sameSite: 'Lax',
    expires:  now + 24 * 60 * 60,
  }])
  console.log(`  Cookie set for domain: ${domain}`)

  const page = await context.newPage()

  try {
    // ── Screenshot 1: /host/scheduled — the list ────────────────────────────
    console.log('\nNavigating to /host/scheduled...')
    await page.goto(`${BASE_URL}/host/scheduled`, { waitUntil: 'networkidle', timeout: 30_000 })

    const url1 = page.url()
    console.log(`  Landed at: ${url1}`)

    if (url1.includes('signin') || url1.includes('auth')) {
      console.error('  Auth failed — still on sign-in page. The session token may be wrong.')
      console.error('  Check AUTH_SECRET matches the server.')
    } else {
      // Wait for content
      await page.waitForTimeout(1500)

      const out1 = join(outDir, 'scheduled-list.png')
      await page.screenshot({ path: out1, fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 760 } })
      console.log(`  Saved: ${out1}`)
    }

    // ── Screenshot 2: /host/my-quizzes — show the Assign button ────────────
    console.log('\nNavigating to /host/my-quizzes (to show the Schedule/Assign flow)...')
    await page.goto(`${BASE_URL}/host/my-quizzes`, { waitUntil: 'networkidle', timeout: 30_000 })

    const url2 = page.url()
    console.log(`  Landed at: ${url2}`)

    if (!url2.includes('signin') && !url2.includes('auth')) {
      await page.waitForTimeout(1200)

      // Try to open the Assign modal on the first quiz
      const assignBtn = page.locator('[data-testid="assign-btn"], button:has-text("Assign"), button:has-text("assign")').first()
      const btnVisible = await assignBtn.isVisible().catch(() => false)
      if (btnVisible) {
        await assignBtn.click()
        await page.waitForTimeout(800)
        // Click the Schedule tab if it exists
        const scheduleTab = page.locator('[role="tab"]:has-text("Schedule"), button:has-text("Schedule"), [data-tab="schedule"]').first()
        const tabVisible = await scheduleTab.isVisible().catch(() => false)
        if (tabVisible) {
          await scheduleTab.click()
          await page.waitForTimeout(600)
          console.log('  Schedule tab opened')
        } else {
          console.log('  No Schedule tab found — screenshot the modal as-is')
        }
      } else {
        console.log('  No Assign button visible — screenshot the quiz list page')
      }

      const out2 = join(outDir, 'scheduled-create.png')
      await page.screenshot({ path: out2, fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 760 } })
      console.log(`  Saved: ${out2}`)
    }

  } finally {
    await browser.close()
  }

  // Report
  const { readdirSync } = await import('fs')
  const files = readdirSync(outDir).filter(f => f.endsWith('.png'))
  console.log(`\nScreenshots in exports/screenshots/: ${files.join(', ')}`)
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
