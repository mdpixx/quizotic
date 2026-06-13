// Scheduled self-paced quiz E2E spec.
//
// Seeds two GameSession rows directly via pg (no host auth needed):
//   A — opensAt = now + 6s  → countdown screen → auto-unlock → full play
//   B — already ended       → closed/ended card
//
// Serial order is intentional: test 2 depends on the auto-unlock triggered
// by test 1 setting up session A with the short countdown.

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

// Read DATABASE_URL from the project .env without loading the whole env file
// into process.env. The value may be quoted — strip surrounding quotes.
function readDbUrl(): string {
  // process.cwd() is the project root when Playwright is invoked from there
  const envPath = join(process.cwd(), '.env')
  const raw = readFileSync(envPath, 'utf8')
  const match = raw.match(/^DATABASE_URL=(.+)$/m)
  if (!match) throw new Error('DATABASE_URL not found in .env')
  return match[1].replace(/^["']|["']$/g, '').trim()
}

// Unique IDs and slugs so parallel runs (if ever enabled) don't clash
const suffix = Date.now()
const slugA = `e2e-sched-a-${suffix}`
const slugB = `e2e-sched-b-${suffix}`
const codeA = String(100000 + (suffix % 900000)).slice(0, 6).padStart(6, '1')
const codeB = String(200000 + (suffix % 700000)).slice(0, 6).padStart(6, '2')

const ONE_MCQ_SNAPSHOT = JSON.stringify([
  {
    id: 'eq1',
    type: 'mcq',
    text: 'Which planet is closest to the Sun?',
    options: ['Mercury', 'Venus', 'Earth', 'Mars'],
    correctAnswer: '0',
    timerSeconds: 30,
    points: 1000,
  },
])

let versionId: string
let sessionAId: string
let sessionBId: string

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const client = new Client({ connectionString: readDbUrl() })
  await client.connect()

  try {
    // Use SQL NOW() arithmetic to avoid any client timezone issues.
    // Session A: opens 12 seconds from now (short enough to test auto-unlock).
    // Session B: already ended.
    const vRes = await client.query(
      `INSERT INTO "QuizVersion" (id, title, snapshot, "questionCount", "createdAt")
       VALUES (gen_random_uuid()::text, 'E2E Scheduled Quiz', $1::jsonb, 1, NOW())
       RETURNING id`,
      [ONE_MCQ_SNAPSHOT],
    )
    versionId = vRes.rows[0].id

    // Session A: opens 12 s from now; all time math done in SQL so the server
    // timezone is authoritative and client-side Date serialization issues are avoided.
    const aRes = await client.query(
      `INSERT INTO "GameSession"
         (id, code, type, mode, status, "shareSlug", "quizVersionId", "allowRetries",
          "opensAt", "closesAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'quiz', 'async', 'open', $2, $3, false,
               NOW() + INTERVAL '12 seconds',
               NOW() + INTERVAL '10 minutes',
               NOW())
       RETURNING id`,
      [codeA, slugA, versionId],
    )
    sessionAId = aRes.rows[0].id

    // Session B: already ended (opensAt + closesAt both in the past)
    const bRes = await client.query(
      `INSERT INTO "GameSession"
         (id, code, type, mode, status, "shareSlug", "quizVersionId", "allowRetries",
          "opensAt", "closesAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'quiz', 'async', 'ended', $2, $3, false,
               NOW() - INTERVAL '10 minutes',
               NOW() - INTERVAL '5 minutes',
               NOW())
       RETURNING id`,
      [codeB, slugB, versionId],
    )
    sessionBId = bRes.rows[0].id
  } finally {
    await client.end()
  }
})

test.afterAll(async () => {
  const client = new Client({ connectionString: readDbUrl() })
  await client.connect()
  try {
    // Cascade deletes Attendee/Answer rows
    if (sessionAId) await client.query(`DELETE FROM "GameSession" WHERE id = $1`, [sessionAId])
    if (sessionBId) await client.query(`DELETE FROM "GameSession" WHERE id = $1`, [sessionBId])
    if (versionId)  await client.query(`DELETE FROM "QuizVersion" WHERE id = $1`, [versionId])
  } finally {
    await client.end()
  }
})

test('session A shows the countdown screen before it opens', async ({ page }) => {
  await page.goto(`/q/${slugA}`)

  // Must show the "until it opens" label — confirms we're in the scheduled phase
  await expect(page.getByText(/until it opens/i)).toBeVisible({ timeout: 10_000 })

  // Name input must NOT appear while the countdown is running
  const nameInput = page.locator('input[type="text"], input:not([type])')
  await expect(nameInput).not.toBeVisible()
})

test('session A auto-unlocks into a full play session after the countdown', async ({ page }) => {
  await page.goto(`/q/${slugA}`)

  // Wait for the name entry form to appear (the countdown page auto-refreshes).
  // opensAt = now + 12s; give 40s total for the unlock + React render.
  const nameInput = page.getByPlaceholder('Enter your name to start')
  await nameInput.waitFor({ state: 'visible', timeout: 40_000 })

  // Enter a participant name and start
  await nameInput.fill('E2E Tester')

  // Press Enter to submit (triggers onKeyDown handler on the input)
  await nameInput.press('Enter')

  // Answer the single MCQ — "Mercury" is the correct answer (index 0)
  const answerBtn = page.getByRole('button', { name: /Mercury/i })
  await answerBtn.waitFor({ state: 'visible', timeout: 15_000 })
  await answerBtn.click()

  // Reach a finish/score screen
  await expect(page.getByText(/finish|score|result|done|complete|thank/i).first()).toBeVisible({ timeout: 15_000 })
})

test('session B shows the ended/closed card and no name input', async ({ page }) => {
  await page.goto(`/q/${slugB}`)

  // The page must show ended state
  await expect(
    page.getByText(/ended|no longer available|no longer accepting|closed/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  // No name entry input should exist
  const nameInput = page.locator('input[type="text"], input:not([type])')
  await expect(nameInput).not.toBeVisible()
})
