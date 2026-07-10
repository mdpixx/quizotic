// Host-stage chrome guards, born from a live session's screenshots:
//   1. the PIN pill slid under the fixed ⋯ menu button,
//   2. the reveal's vote-% + tick painted OVER the answer text,
//   3. "View Standings (recommended)" widened the primary until it overlapped
//      the Skip label and pause button,
//   4. content-sized tiles re-shaped the grid on every question,
//   5. (new) a join-QR overlay for latecomers.
// Each test drives the real host UI via ?preview=host-stage (auth cookie →
// lobby → question) exactly like host-stage-fit.spec.ts.

import { test, expect } from '@playwright/test'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

// Deliberately mixed-length options: the old content-sized rows gave these
// four visibly different tile heights.
const mixedQuiz = () => ({
  id: `e2e-ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'Stage chrome guard',
  subject: 'e2e',
  language: 'en',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questions: [
    {
      id: 'q-ui-1',
      type: 'mcq',
      text: 'What does a Large Language Model, or LLM, mainly do?',
      options: [
        'Stores all internet pages permanently and retrieves exact answers',
        'Works like a calculator',
        'Predicts and generates language based on patterns, context, and training data',
        'Searches Google',
      ],
      correctAnswer: '2',
      timerSeconds: 20,
      points: 1000,
    },
    // Second question so the post-reveal action on Q1 is "View Standings"
    // (on the last question it becomes "End Quiz").
    {
      id: 'q-ui-2',
      type: 'mcq',
      text: 'Which planet is closest to the Sun?',
      options: ['Venus', 'Mercury', 'Mars', 'Earth'],
      correctAnswer: '1',
      timerSeconds: 20,
      points: 1000,
    },
  ],
})

async function bootToQuestion(
  browser: import('@playwright/test').Browser,
  viewport: { width: number; height: number },
) {
  const context = await browser.newContext({ viewport })
  const cookie = await hostAuthCookie()
  const eq = cookie.indexOf('=')
  await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
  const page = await context.newPage()
  await page.addInitScript(q => {
    localStorage.setItem('quizotic_active_session', JSON.stringify(q))
  }, mixedQuiz())
  await page.goto('/host/session?preview=host-stage')
  await expect(page.getByRole('button', { name: 'Start lobby' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Start lobby' }).click()
  const startQuiz = page.getByRole('button', { name: /Start Quiz/ })
  await expect(startQuiz).toBeEnabled({ timeout: 15_000 })
  await startQuiz.click()
  await expect(page.locator('.host-question-card')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(400) // let the fit pass settle
  return { context, page }
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

// ── 1. PIN pill must clear the fixed ⋯ button ───────────────────────────────
for (const vp of [
  { width: 1280, height: 720 },
  { width: 1024, height: 576 },
]) {
  test(`PIN pill and ⋯ menu do not overlap at ${vp.width}×${vp.height}`, async ({ browser }) => {
    const { context, page } = await bootToQuestion(browser, vp)

    const pin = page.locator('span').filter({ hasText: /^PIN/ }).first()
    const dots = page.getByRole('button', { name: 'More options' })
    await expect(pin).toBeVisible()
    await expect(dots).toBeVisible()

    const [pinBox, dotsBox] = await Promise.all([pin.boundingBox(), dots.boundingBox()])
    expect(pinBox).toBeTruthy()
    expect(dotsBox).toBeTruthy()
    expect(intersects(pinBox!, dotsBox!), 'PIN pill must not slide under the ⋯ button').toBe(false)

    await context.close()
  })
}

// ── 2+3+4. Reveal must not move text, badges must not cover it, tiles equal,
//           and the primary label stays "View Standings" (no "(recommended)"
//           suffix — it used to widen the button into the left cluster). ────
test('reveal keeps text still, badges clear of text, tiles uniform, dock label short', async ({ browser }) => {
  const { context, page } = await bootToQuestion(browser, { width: 1280, height: 720 })

  // TILE-RELATIVE rects. What the reserved badge slot guarantees: revealing
  // never pushes the text sideways or re-wraps it (x and width frozen). It
  // does NOT freeze vertical position — on reveal the explanation bar mounts,
  // the stage re-centers, and useFitText's ResizeObserver may legitimately
  // re-fit on tight viewports (the no-clip closed loop, by design).
  const textRects = () =>
    page.locator('.host-options-stage .host-opt-text').evaluateAll(spans =>
      spans.map(s => {
        const tile = s.closest('.host-options-stage > div')!
        const r = s.getBoundingClientRect()
        const t = tile.getBoundingClientRect()
        return { x: r.x - t.x, y: r.y - t.y, width: r.width, height: r.height }
      })
    )

  // 4: all tiles share one height (grid-auto-rows: 1fr).
  const tileHeights = await page
    .locator('.host-options-stage > div')
    .evaluateAll(tiles => tiles.map(t => t.getBoundingClientRect().height))
  expect(tileHeights.length).toBe(4)
  for (const h of tileHeights) {
    expect(Math.abs(h - tileHeights[0]), 'tiles must share one uniform height').toBeLessThanOrEqual(1)
  }

  const before = await textRects()
  expect(before.length).toBe(4)

  await page.getByRole('button', { name: 'End Now' }).click()
  await page.getByRole('button', { name: /Reveal Answer/ }).click()
  // Wait out the badge fade + fill-bar rise (300/700ms transitions).
  await page.waitForTimeout(900)

  // 2a: no horizontal push or re-wrap — the badge slot is permanently
  // reserved, so badges fading in must not narrow or shift the text box.
  const after = await textRects()
  for (let i = 0; i < before.length; i++) {
    expect(Math.abs(after[i].x - before[i].x), `option ${i} text must not shift on reveal (x)`).toBeLessThanOrEqual(1)
    expect(Math.abs(after[i].width - before[i].width), `option ${i} text must not narrow on reveal`).toBeLessThanOrEqual(1)
  }

  // Tiles stay uniform and text stays inside its tile after the reveal too.
  const revealedTiles = await page.locator('.host-options-stage > div').evaluateAll(tiles =>
    tiles.map(t => {
      const r = t.getBoundingClientRect()
      const s = t.querySelector('.host-opt-text')!.getBoundingClientRect()
      return { h: r.height, topIn: s.top - r.top, bottomOver: s.bottom - r.bottom }
    })
  )
  for (const [i, m] of revealedTiles.entries()) {
    expect(Math.abs(m.h - revealedTiles[0].h), 'revealed tiles must share one uniform height').toBeLessThanOrEqual(1)
    expect(m.topIn, `option ${i} text must not clip above its tile after reveal`).toBeGreaterThanOrEqual(-1)
    expect(m.bottomOver, `option ${i} text must not clip below its tile after reveal`).toBeLessThanOrEqual(1)
  }

  // 2b: the vote % never intersects its tile's text.
  const overlaps = await page.locator('.host-options-stage > div').evaluateAll(tiles =>
    tiles.map(tile => {
      const text = tile.querySelector('.host-opt-text')!
      const pct = tile.querySelector('span.tabular-nums')!
      const a = text.getBoundingClientRect()
      const b = pct.getBoundingClientRect()
      return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    })
  )
  for (const [i, o] of overlaps.entries()) {
    expect(o, `option ${i} vote % must not cover the answer text`).toBe(false)
  }

  // 3: no "(recommended)" suffix on the primary.
  const primary = page.getByRole('button', { name: /View Standings/ })
  await expect(primary).toBeVisible()
  await expect(primary).not.toContainText('recommended')

  await context.close()
})

// ── 5. Join-QR overlay: eyebrow icon on desktop, ⋯ menu on phones ───────────
test('join QR overlay opens from the eyebrow icon and closes on Escape', async ({ browser }) => {
  const { context, page } = await bootToQuestion(browser, { width: 1280, height: 720 })

  await page.getByRole('button', { name: 'Show join QR code' }).click()
  const dialog = page.getByRole('dialog', { name: 'Scan to join the game' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Scan to join')).toBeVisible()
  // react-qr-code renders an SVG.
  await expect(dialog.locator('svg').first()).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  // 'Q' keyboard shortcut toggles it too.
  await page.keyboard.press('q')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('q')
  await expect(dialog).not.toBeVisible()

  await context.close()
})

test('join QR overlay opens from the ⋯ menu on a phone', async ({ browser }) => {
  const { context, page } = await bootToQuestion(browser, { width: 375, height: 812 })

  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Show join QR' }).click()
  const dialog = page.getByRole('dialog', { name: 'Scan to join the game' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg').first()).toBeVisible()

  await context.close()
})
