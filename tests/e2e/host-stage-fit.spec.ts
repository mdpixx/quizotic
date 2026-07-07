// Projector-fit guard. Teachers project the host stage at low resolutions
// (1024×768 4:3 projectors, 1280×720 TVs — often further shrunk by Windows
// display scaling). The desktop stage is h-svh + overflow-hidden, so any
// question the sizing math under-shrinks gets CLIPPED on the wall while
// looking fine on the teacher's laptop and on student phones.
//
// Drives the real host UI (auth cookie → lobby → question) with a max-length
// question and asserts the rendered card doesn't overflow its own box — the
// closed-loop useFitText guarantee — while staying at or above the 16px
// legibility floor.

import { test, expect } from '@playwright/test'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

// QUESTION_CHAR_LIMIT (160) worth of realistic text — the worst case a host
// can produce in the builder.
const LONG_QUESTION =
  'If a coding benchmark shows one model scoring slightly higher than another on a single suite, what is the best conclusion a careful engineering team can draw?'

const stressQuiz = {
  id: `e2e-fit-${Date.now()}`,
  title: 'Projector fit stress',
  subject: 'e2e',
  language: 'en',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questions: [
    {
      id: 'q-fit-1',
      type: 'mcq',
      text: LONG_QUESTION,
      // Image questions are the worst case: the image takes up to 18vh of
      // the card, squeezing the text. 1×1 PNG stretched by the card's
      // object-contain sizing — no network dependency.
      imageUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      options: [
        'The result is useful for comparing performance on that suite, but it does not prove overall superiority',
        'The higher-scoring model is better for every possible task',
        'Benchmarks should be ignored because they are always misleading',
        'The lower-scoring model is no longer useful for any coding work',
      ],
      correctAnswer: '0',
      timerSeconds: 20,
      points: 1000,
    },
  ],
}

for (const vp of [
  // Bare 4:3 projector.
  { width: 1024, height: 768 },
  // 720p projector/TV mirrored from a laptop at 125% Windows scaling —
  // still the desktop (overflow-hidden) stage, with much less height.
  // This is the combination hosts actually project with.
  { width: 1024, height: 576 },
  { width: 1280, height: 720 },
]) {
  test(`question card fits without clipping at ${vp.width}×${vp.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: vp })
    const cookie = await hostAuthCookie()
    const eq = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
    const page = await context.newPage()

    // Seed the quiz directly (bypasses the builder). Deliberately NOT via
    // setActiveSession, so no fresh-start marker / stale-session chooser is
    // involved — this spec isolates the stage layout.
    await page.addInitScript(q => {
      localStorage.setItem('quizotic_active_session', JSON.stringify(q))
    }, stressQuiz)

    await page.goto('/host/session?preview=host-stage')
    await expect(page.getByRole('button', { name: 'Start lobby' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Start lobby' }).click()

    // preview=host-stage enables Start Quiz with zero participants.
    const startQuiz = page.getByRole('button', { name: /Start Quiz/ })
    await expect(startQuiz).toBeEnabled({ timeout: 15_000 })
    await startQuiz.click()

    const card = page.locator('.host-question-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toContainText('careful engineering team')
    // Give the post-paint fit pass a beat to settle.
    await page.waitForTimeout(400)

    const m = await card.evaluate(el => {
      const p = el.querySelector('p')
      return {
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        fontPx: p ? parseFloat(getComputedStyle(p).fontSize) : 0,
      }
    })

    // The regression: rendered content must fit the card's own box — the
    // card is overflow-hidden, so any excess is invisible on the projector.
    expect(m.scrollH, 'question card must not clip vertically').toBeLessThanOrEqual(m.clientH + 1)
    expect(m.scrollW, 'question card must not clip horizontally').toBeLessThanOrEqual(m.clientW + 1)
    expect(m.fontPx, 'fitted font must stay legible').toBeGreaterThanOrEqual(16)

    await context.close()
  })
}
