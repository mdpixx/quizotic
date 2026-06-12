// Landing-page funnel guards (June 2026 onboarding review). These protect
// the conversion-critical entry points: the participant join-code box, the
// /demo link, and the category-first hero copy. If any of these disappear
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
    // The join page must pre-fill the code from the query param.
    await expect(page.locator('input[inputmode="numeric"]').first()).toHaveValue('482913')
  })

  test('join button stays disabled until 6 digits are entered', async ({ page }) => {
    await page.goto('/')
    const main = page.getByRole('main')
    const button = main.getByRole('button', { name: 'Join session' })
    await expect(button).toBeDisabled()
    await main.getByPlaceholder('Enter 6-digit code').fill('123456')
    await expect(button).toBeEnabled()
  })

  test('hero links to the live demo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Try a Live Demo →' }).click()
    await page.waitForURL('**/demo')
    await expect(page).toHaveURL(/\/demo$/)
  })
})
