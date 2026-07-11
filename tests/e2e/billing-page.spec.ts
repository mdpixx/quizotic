// Billing ("Your Account") page guards. The page is the retention + word-of-
// mouth surface for signed-in hosts: it must state the Early Supporter boost,
// the promise block, and the personal referral share card. APIs are mocked —
// synthetic e2e hosts have no DB rows (see socket-auth.ts), so real fetches
// would return nulls and hide the referral card.
import { test, expect, Page } from '@playwright/test'
import { mkdirSync } from 'fs'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const SHOTS = 'test-results/billing-shots'

async function mockBillingApis(page: Page) {
  await page.route('**/api/billing/status', r => r.fulfill({ json: { plan: 'free', subscription: null } }))
  await page.route('**/api/user/ai-usage', r => r.fulfill({
    json: {
      plan: 'free',
      questions: { used: 12, limit: 30, bonusCredits: 30 },
      enhancements: { used: 2, limit: 10 },
    },
  }))
  await page.route('**/api/user/referral-code', r => r.fulfill({ json: { code: 'mahesh-k7x2' } }))
}

test.describe('Billing page (Your Account)', () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await hostAuthCookie()
    const eq = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
    await mockBillingApis(page)
  })

  test('states the Early Supporter boost and the promise', async ({ page }) => {
    await page.goto('/host/billing')
    await expect(page.getByText('Free · Early Supporter')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Your Early Supporter boost: 100 participants/)).toBeVisible()
    await expect(page.getByText('Up to 100')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Our promise to you' })).toBeVisible()
    await expect(page.getByText('The free plan never shrinks for existing accounts.')).toBeVisible()
  })

  test('shows the personal referral share card with earned bonus', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    await page.goto('/host/billing')
    await expect(page.getByRole('heading', { name: 'Share Quizotic — earn AI questions' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('https://www.quizotic.live/r/mahesh-k7x2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible()
    await expect(page.getByText('+30 bonus questions earned')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/billing-desktop.png`, fullPage: true })

    // Element shots — the dashboard scrolls in an inner container, so
    // fullPage stitching can't reach below the fold.
    const shareCard = page.locator('div', { has: page.getByRole('heading', { name: 'Share Quizotic — earn AI questions' }) }).last()
    await shareCard.screenshot({ path: `${SHOTS}/share-card-desktop.png` })

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByText('https://www.quizotic.live/r/mahesh-k7x2')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/billing-mobile.png`, fullPage: true })
    await shareCard.screenshot({ path: `${SHOTS}/share-card-mobile.png` })
  })

  test('referral card hides gracefully when no code is available', async ({ page }) => {
    await page.route('**/api/user/referral-code', r => r.fulfill({ json: { code: null } }))
    await page.goto('/host/billing')
    await expect(page.getByText('Free · Early Supporter')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Share Quizotic — earn AI questions' })).toHaveCount(0)
  })
})
