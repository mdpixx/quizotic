// Full testimonial lifecycle. This test intentionally requires an explicit
// TESTIMONIAL_E2E=1 opt-in because it seeds the configured database. CI runs
// it automatically when DATABASE_URL exactly matches the explicitly declared
// TESTIMONIAL_E2E_DATABASE_URL, preventing accidental writes to a shared DB.

import { test, expect } from '@playwright/test'
import { encode } from '@auth/core/jwt'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const COOKIE_NAME = 'authjs.session-token'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

function localEnv(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const filename of ['.env', '.env.local']) {
    const path = join(process.cwd(), filename)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match) result[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return result
}

const env = { ...localEnv(), ...process.env }
const databaseUrl = env.DATABASE_URL
const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET
const adminEmail = env.TESTIMONIAL_E2E_ADMIN_EMAIL || env.ADMIN_EMAILS?.split(',')[0]?.trim()
const isolatedCiDatabase = Boolean(
  ['1', 'true'].includes((process.env.CI ?? '').toLowerCase())
  && env.TESTIMONIAL_E2E_DATABASE_URL
  && databaseUrl === env.TESTIMONIAL_E2E_DATABASE_URL,
)
const enabled = process.env.TESTIMONIAL_E2E === '1' || isolatedCiDatabase

test.describe('testimonial invitation to homepage lifecycle', () => {
  test.skip(!enabled, 'Set TESTIMONIAL_E2E=1 with an isolated migrated test database to run this lifecycle.')

  const participantId = `e2e-testimonial-user-${randomUUID()}`
  const participantEmail = `testimonial-${randomUUID()}@example.test`
  const inviteId = `e2e-testimonial-invite-${randomUUID()}`
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')
  const quote = 'Quizotic made our knowledge checks faster, clearer, and much more engaging for every participant.'
  let adminId = ''
  let adminWasCreated = false
  let testimonialId = ''

  test.beforeAll(async () => {
    if (!databaseUrl || !authSecret || !adminEmail) {
      throw new Error('DATABASE_URL, AUTH_SECRET/NEXTAUTH_SECRET, and an admin email are required for TESTIMONIAL_E2E.')
    }

    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const existingAdmin = await client.query('SELECT id FROM "User" WHERE lower(email) = lower($1) LIMIT 1', [adminEmail])
      if (existingAdmin.rowCount) {
        adminId = existingAdmin.rows[0].id
      } else {
        adminId = `e2e-testimonial-admin-${randomUUID()}`
        await client.query(
          `INSERT INTO "User" (id, email, name, onboarded, "createdAt", "updatedAt")
           VALUES ($1, $2, 'Testimonial E2E Admin', true, NOW(), NOW())`,
          [adminId, adminEmail],
        )
        adminWasCreated = true
      }

      await client.query(
        `INSERT INTO "User" (id, email, name, organization, onboarded, "createdAt", "updatedAt")
         VALUES ($1, $2, 'Asha Rao', 'Acme Learning', true, NOW(), NOW())`,
        [participantId, participantEmail],
      )
      await client.query(
        `INSERT INTO "TestimonialInvite"
           (id, "tokenHash", "userId", "campaignKey", "expiresAt", "createdAt")
         VALUES ($1, $2, $3, 'testimonial-e2e', NOW() + INTERVAL '30 days', NOW())`,
        [inviteId, tokenHash, participantId],
      )
    } finally {
      await client.end()
    }
  })

  test.afterAll(async () => {
    if (!databaseUrl) return
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      if (testimonialId) await client.query('DELETE FROM "AdminAuditLog" WHERE "targetType" = $1 AND "targetId" = $2', ['testimonial', testimonialId])
      if (testimonialId) await client.query('DELETE FROM "Testimonial" WHERE id = $1', [testimonialId])
      await client.query('DELETE FROM "TestimonialInvite" WHERE id = $1', [inviteId])
      await client.query('DELETE FROM "User" WHERE id = $1', [participantId])
      if (adminWasCreated) await client.query('DELETE FROM "User" WHERE id = $1', [adminId])
    } finally {
      await client.end()
    }
  })

  test('submit, shortlist, publish, display, and unpublish', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    // Simulate a top-level navigation originating outside Quizotic (as an
    // email click does) so the Lax cookie redirect is exercised in-browser.
    await page.setContent(`<a href="${baseURL}/share-your-story?invite=${encodeURIComponent(token)}">Open invitation</a>`)
    await page.getByRole('link', { name: 'Open invitation' }).click()
    await expect(page.getByRole('heading', { name: /tell us what changed/i })).toBeVisible()
    await expect(page.getByLabel('Testimonial preview')).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByLabel(/How has Quizotic made/i).fill(quote)
    await page.getByLabel('Designation').fill('Learning Manager')
    await page.getByLabel(/Permission to publish/i).check()
    await page.getByRole('button', { name: 'Share my Quizotic story' }).click()
    await expect(page.getByRole('heading', { name: 'Your story is with us' })).toBeVisible()

    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const result = await client.query('SELECT id FROM "Testimonial" WHERE "inviteId" = $1', [inviteId])
      testimonialId = result.rows[0].id
    } finally {
      await client.end()
    }

    const sessionToken = await encode({
      token: { sub: adminId, userId: adminId, email: adminEmail, name: 'Testimonial E2E Admin' },
      secret: authSecret!,
      salt: COOKIE_NAME,
      maxAge: 3600,
    })
    await page.context().addCookies([{ name: COOKIE_NAME, value: sessionToken, url: baseURL }])

    const shortlist = await page.context().request.patch('/api/admin/testimonials', {
      data: { id: testimonialId, status: 'shortlisted' },
    })
    expect(shortlist.ok()).toBe(true)

    const publish = await page.context().request.patch('/api/admin/testimonials', {
      data: { id: testimonialId, status: 'published' },
    })
    expect(publish.ok()).toBe(true)

    await page.goto('/')
    await expect(page.getByText(quote)).toBeVisible()
    await expect(page.getByText('Asha Rao')).toBeVisible()

    const unpublish = await page.context().request.patch('/api/admin/testimonials', {
      data: { id: testimonialId, status: 'shortlisted' },
    })
    expect(unpublish.ok()).toBe(true)
    await page.goto('/')
    await expect(page.getByText(quote)).toHaveCount(0)
  })
})
