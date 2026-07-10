// Host-stage chrome guards, born from live sessions' screenshots:
//   1. the PIN pill slid under the fixed ⋯ menu button,
//   2. the reveal's vote-% + tick painted OVER the answer text — now they live
//      in a fixed corner float INSIDE the text span (text wraps around it, so
//      non-overlap is by construction and lines below the float run full width),
//   3. "View Standings (recommended)" widened the primary until it overlapped
//      the Skip label and pause button,
//   4. content-sized tiles re-shaped the grid on every question,
//   5. a join-QR overlay for latecomers,
//   6. the tip/explanation bar mounted on reveal (even when EMPTY) and
//      re-centered the whole column — now a fixed-height .host-tip-slot is
//      permanently reserved and the bar renders inside it only when there is
//      real tip text, so NOTHING moves at reveal (asserted in absolute page
//      coordinates below).
// Each test drives the real host UI via ?preview=host-stage (auth cookie →
// lobby → question) exactly like host-stage-fit.spec.ts.

import { test, expect } from '@playwright/test'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

// Deliberately mixed-length options: the old content-sized rows gave these
// four visibly different tile heights. No `explanation` on q1 — the default
// fixture exercises the no-tip path.
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

type Quiz = ReturnType<typeof mixedQuiz>

async function bootToQuestion(
  browser: import('@playwright/test').Browser,
  viewport: { width: number; height: number },
  quiz: Quiz = mixedQuiz(),
) {
  const context = await browser.newContext({ viewport })
  const cookie = await hostAuthCookie()
  const eq = cookie.indexOf('=')
  await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
  const page = await context.newPage()
  await page.addInitScript(q => {
    localStorage.setItem('quizotic_active_session', JSON.stringify(q))
  }, quiz)
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

// End Now is a two-tap armed button while participants are still answering
// (action === 'waiting'); with nobody outstanding it ends on the first tap.
// Handle both so the flow doesn't silently rely on the 20s timer auto-end.
async function endAndReveal(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'End Now' }).click()
  const confirm = page.getByRole('button', { name: 'Tap again to confirm' })
  const armed = await confirm
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false)
  if (armed) await confirm.click() // within the 2.5s disarm window
  await page.getByRole('button', { name: /Reveal Answer/ }).click()
  // Wait out the badge fade + fill-bar rise (300/700ms transitions).
  await page.waitForTimeout(900)
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

// ── 2+3+4+6. Reveal must move NOTHING (absolute page coords): the tip slot is
//             permanently reserved and the badge float is always present, so
//             tiles, text, grid and slot hold one geometry live → revealed.
//             Badges must stay inside their reserved corner, tiles uniform,
//             and the primary label stays "View Standings". ─────────────────
test('reveal keeps text still, badges clear of text, tiles uniform, dock label short', async ({ browser }) => {
  const { context, page } = await bootToQuestion(browser, { width: 1280, height: 720 })

  const snapshot = () =>
    page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return {
        grid: rect(document.querySelector('.host-options-stage')!),
        slot: rect(document.querySelector('.host-tip-slot')!),
        tiles: [...document.querySelectorAll('.host-options-stage > div')].map(rect),
        texts: [...document.querySelectorAll('.host-options-stage .host-opt-text')].map(rect),
      }
    })

  // 4: all tiles share one height (grid-auto-rows: 1fr).
  const before = await snapshot()
  expect(before.tiles.length).toBe(4)
  for (const t of before.tiles) {
    expect(Math.abs(t.height - before.tiles[0].height), 'tiles must share one uniform height').toBeLessThanOrEqual(1)
  }

  await endAndReveal(page)

  // 2a + 6: ZERO movement anywhere — absolute page coordinates. The tip slot
  // was reserved before reveal and the badge float never changes size, so the
  // column must not re-center and the text must not re-wrap.
  const after = await snapshot()
  // yTol 3 for tiles/texts only: the CORRECT tile deliberately lifts by a
  // translateY(-2px) transform on reveal (a visual bloom, not a layout
  // shift — getBoundingClientRect includes transforms). Grid and slot are
  // layout boxes and must hold ±1px.
  const same = (a: { x: number; y: number; width: number; height: number }, b: typeof a, what: string, yTol = 1) => {
    expect(Math.abs(a.x - b.x), `${what} x`).toBeLessThanOrEqual(1)
    expect(Math.abs(a.y - b.y), `${what} y`).toBeLessThanOrEqual(yTol)
    expect(Math.abs(a.width - b.width), `${what} width`).toBeLessThanOrEqual(1)
    expect(Math.abs(a.height - b.height), `${what} height`).toBeLessThanOrEqual(1)
  }
  same(before.grid, after.grid, 'options grid must not move on reveal:')
  same(before.slot, after.slot, 'tip slot must not move on reveal:')
  before.tiles.forEach((t, i) => same(t, after.tiles[i], `tile ${i} must not move on reveal:`, 3))
  before.texts.forEach((t, i) => same(t, after.texts[i], `option ${i} text must not move on reveal:`, 3))

  // Text stays inside its tile after the reveal too.
  const containment = await page.locator('.host-options-stage > div').evaluateAll(tiles =>
    tiles.map(t => {
      const r = t.getBoundingClientRect()
      const s = t.querySelector('.host-opt-text')!.getBoundingClientRect()
      return { topIn: s.top - r.top, bottomOver: s.bottom - r.bottom }
    })
  )
  for (const [i, m] of containment.entries()) {
    expect(m.topIn, `option ${i} text must not clip above its tile after reveal`).toBeGreaterThanOrEqual(-1)
    expect(m.bottomOver, `option ${i} text must not clip below its tile after reveal`).toBeLessThanOrEqual(1)
  }

  // 2b: badges live inside the reserved corner float, and no text LINE box
  // enters the float (the float is inside the text span, so span-rect vs
  // %-rect intersection is meaningless — measure the real line boxes).
  const geom = await page.locator('.host-options-stage > div').evaluateAll(tiles =>
    tiles.map(tile => {
      const span = tile.querySelector('.host-opt-text')!
      const float = span.querySelector('.host-opt-badges')!
      const pct = float.querySelector('span.tabular-nums')!
      const textNode = Array.from(span.childNodes).find(n => n.nodeType === Node.TEXT_NODE)!
      const range = document.createRange()
      range.selectNode(textNode)
      const lines = Array.from(range.getClientRects()).map(r => ({ l: r.left, r: r.right, t: r.top, b: r.bottom }))
      const f = float.getBoundingClientRect()
      const p = pct.getBoundingClientRect()
      return { lines, float: { l: f.left, r: f.right, t: f.top, b: f.bottom }, pct: { l: p.left, r: p.right, t: p.top, b: p.bottom } }
    })
  )
  for (const [i, g] of geom.entries()) {
    expect(g.pct.l, `option ${i}: % must sit inside the corner float`).toBeGreaterThanOrEqual(g.float.l - 1)
    expect(g.pct.r, `option ${i}: % must sit inside the corner float`).toBeLessThanOrEqual(g.float.r + 1)
    for (const ln of g.lines) {
      const hit = ln.l < g.float.r - 1 && g.float.l + 1 < ln.r && ln.t < g.float.b - 1 && g.float.t + 1 < ln.b
      expect(hit, `option ${i}: text line must not enter the badge corner`).toBe(false)
    }
  }

  // 3: no "(recommended)" suffix on the primary.
  const primary = page.getByRole('button', { name: /View Standings/ })
  await expect(primary).toBeVisible()
  await expect(primary).not.toContainText('recommended')

  await context.close()
})

// ── 6a. No authored tip → the bar is NEVER empty chrome, geometry frozen ────
// (The regression: a live classroom reveal showed a bar with a lone 💡 and no
// text on every question. The exact participants-present ⇒ no-bar branch is
// pinned by getHostTipText unit tests — the preview server's periodic state
// sync makes connectedCount nondeterministic here, so e2e asserts the
// invariant that holds either way: any rendered bar carries real text.)
test('empty tip never shows empty bar chrome and the grid does not move', async ({ browser }) => {
  const { context, page } = await bootToQuestion(browser, { width: 1280, height: 720 })

  const boxes = () =>
    page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return {
        grid: rect(document.querySelector('.host-options-stage')!),
        slot: rect(document.querySelector('.host-tip-slot')!),
      }
    })
  const before = await boxes()

  await endAndReveal(page)

  // Fixture q1 has no explanation: either no bar at all (participants
  // present) or the nobody-answered notice (empty room) — never a bare 💡.
  const bars = page.locator('.host-tip-bar')
  if (await bars.count()) {
    const text = (await bars.first().locator('.host-tip-text').innerText()).trim()
    expect(text.length, 'a rendered tip bar must carry real text, never bare chrome').toBeGreaterThan(0)
  }

  const after = await boxes()
  expect(Math.abs(after.grid.y - before.grid.y), 'grid must not move on reveal').toBeLessThanOrEqual(1)
  expect(Math.abs(after.slot.y - before.slot.y), 'slot must not move on reveal').toBeLessThanOrEqual(1)

  await context.close()
})

// ── 6b. Authored tip → bar visible inside the pre-reserved slot, grid frozen ─
test('authored tip shows inside the reserved slot without moving the grid', async ({ browser }) => {
  const quiz = mixedQuiz()
  quiz.questions[0] = {
    ...quiz.questions[0],
    explanation: 'Predicting the next token from context is the core mechanism.',
  } as Quiz['questions'][number]
  const { context, page } = await bootToQuestion(browser, { width: 1280, height: 720 }, quiz)

  const gridBefore = await page.locator('.host-options-stage').boundingBox()

  await endAndReveal(page)

  const bar = page.locator('.host-tip-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('Predicting the next token')

  // Bar renders INSIDE the pre-reserved slot…
  const [barBox, slotBox, gridAfter] = await Promise.all([
    bar.boundingBox(),
    page.locator('.host-tip-slot').boundingBox(),
    page.locator('.host-options-stage').boundingBox(),
  ])
  expect(barBox!.y).toBeGreaterThanOrEqual(slotBox!.y - 1)
  expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(slotBox!.y + slotBox!.height + 1)
  // …so the grid does not move when it appears.
  expect(Math.abs(gridAfter!.y - gridBefore!.y), 'grid must not move when the tip appears').toBeLessThanOrEqual(1)

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
