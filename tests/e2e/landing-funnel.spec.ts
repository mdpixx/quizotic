// Landing-page funnel guards (June 2026 onboarding review). These protect
// the conversion-critical entry points: the participant join-code box, the
// signup CTA, and the category-first hero copy. If any of these disappear
// in a redesign, the viral loop (students → homepage → join) breaks silently.

import { test, expect } from '@playwright/test'

test.describe('Landing funnel', () => {
  test('hero states the category plainly', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Live quizzes your class joins')
  })

  test('join-code box forwards participants to /join with the code pre-filled', async ({ page }) => {
    await page.goto('/')
    // Hero variant — the mobile-menu box shares the placeholder, so scope
    // to <main>.
    const heroInput = page.getByRole('main').getByPlaceholder('Enter 6-digit code')
    await heroInput.fill('482913')
    await heroInput.press('Enter')
    await page.waitForURL('**/join?code=482913')
    // Direct links show the code as a locked summary chip (not an editable
    // input) with the name field focused for entry — see the
    // hasPrefilledCode branch in src/app/join/page.tsx.
    await expect(page.getByText('482913')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible()
  })

  test('join button stays disabled until 6 digits are entered', async ({ page }) => {
    await page.goto('/')
    const main = page.getByRole('main')
    const button = main.getByRole('button', { name: 'Join session' })
    await expect(button).toBeDisabled()
    await main.getByPlaceholder('Enter 6-digit code').fill('123456')
    await expect(button).toBeEnabled()
  })

  // The hero demo link was retired with the /demo page (commit 7ed9c2f);
  // the primary CTA now routes teachers straight into the signup flow.
  // seo-signup-path.test.ts guards the SEO pages — this guards the homepage.
  test('hero CTA routes to the signup flow', async ({ page }) => {
    await page.goto('/')
    // .first() — the hero and the bottom CTA band both carry this link.
    const cta = page.getByRole('main').getByRole('link', { name: 'Start Teaching Free →' }).first()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/auth/signin?intent=signup')
  })
})
