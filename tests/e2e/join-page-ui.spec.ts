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

    // Type scale. These floors were rebalanced in #99, which deliberately took
    // the code from 48px to 30px so it stops competing with the title — the
    // assertions below were written against the pre-#99 sizes and were left
    // behind, which is why they are relative where they can be. The absolute
    // numbers are the ones that mean something on a real phone; the relative
    // ones survive the next rescale.
    const fontPx = (loc: ReturnType<typeof page.getByRole>) =>
      loc.evaluate(el => parseFloat(getComputedStyle(el).fontSize))

    const codeInput = page.getByRole('textbox', { name: 'Session code' })
    await expect(codeInput).toBeVisible()
    const codePx = await fontPx(codeInput)
    // Shipped: 30px, dropping to 26px on short/narrow phones.
    expect(codePx, 'session code must stay large enough to read across a room').toBeGreaterThanOrEqual(24)

    const nameInput = page.getByRole('textbox', { name: 'Your name' })
    const namePx = await fontPx(nameInput)
    // 16px is not cosmetic: iOS Safari zooms the page when a focused input is
    // below it, which throws a one-handed participant out of the layout
    // mid-typing. Shipped value is exactly 16 at every breakpoint, so any
    // reduction at all trips this.
    expect(namePx, 'name input must not drop below the iOS no-zoom threshold').toBeGreaterThanOrEqual(16)

    const emailToggle = page.getByRole('button', { name: /Add email/i })
    const togglePx = await fontPx(emailToggle)
    expect(togglePx, 'email toggle must stay legible').toBeGreaterThanOrEqual(13)

    // The point of the #99 rebalance: the code is the single focal point, and
    // the optional email toggle stays subordinate to the fields you must fill.
    expect(codePx, 'session code must dominate the form').toBeGreaterThan(namePx)
    expect(togglePx, 'optional email must not outweigh the required fields').toBeLessThanOrEqual(namePx)

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
