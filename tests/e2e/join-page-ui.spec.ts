import { test, expect } from '@playwright/test'

const SESSION_CODE = '481927'
const SESSION_TITLE = 'AI Basics Sprint'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session/lookup?code=*', async route => {
    const code = new URL(route.request().url()).searchParams.get('code')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: code === SESSION_CODE,
        title: code === SESSION_CODE ? SESSION_TITLE : undefined,
      }),
    })
  })
})

test.describe('Participant join form', () => {
  test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })

  test('makes manual entry readable and responds when the form is complete', async ({ page }) => {
    await page.goto('/join')

    const wordmark = page.getByLabel('Quizotic', { exact: true })
    await expect(wordmark).toHaveCSS('color', 'rgb(255, 255, 255)')
    expect(await wordmark.evaluate(el => getComputedStyle(el).fontFamily)).toContain('-apple-system')

    const codeInput = page.getByRole('textbox', { name: 'Session code' })
    await expect(codeInput).toBeVisible()
    expect(parseFloat(await codeInput.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(40)

    const nameInput = page.getByRole('textbox', { name: 'Your name' })
    expect(parseFloat(await nameInput.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20)

    const emailToggle = page.getByRole('button', { name: /Add email/i })
    expect(parseFloat(await emailToggle.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)

    await expect(page.getByRole('img', { name: 'Smiling face' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Excited face' })).toHaveCount(0)

    await codeInput.fill(SESSION_CODE)
    const sessionContext = page.getByTestId('join-session-context')
    await expect(sessionContext).toContainText(SESSION_TITLE)

    await nameInput.fill('Mahesh')
    await expect(page.getByRole('img', { name: 'Excited face' })).toBeVisible()
  })

  test('keeps a QR-resolved session separate from participant details', async ({ page }) => {
    await page.goto(`/join?code=${SESSION_CODE}`)

    await expect(page.getByRole('textbox', { name: 'Session code' })).toHaveCount(0)
    await expect(page.getByTestId('join-session-context')).toContainText(SESSION_TITLE)
    await expect(page.getByText('481927')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeFocused()
  })
})
