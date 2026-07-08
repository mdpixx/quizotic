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

    // Answer tiles are individually overflow-hidden — a long option used to
    // clip inside its tile (host-only; phones grow). The grid-level fit must
    // clear every tile.
    const tiles = await page.locator('.host-options-stage .host-opt-text').evaluateAll(spans =>
      spans.map(span => {
        const tile = span.closest('.host-options-stage > div')!
        const s = span.getBoundingClientRect()
        const t = tile.getBoundingClientRect()
        // Upward overflow of a centered flex item is invisible to
        // scrollHeight — geometric containment is the honest check.
        return { top: s.top - t.top, bottomOver: s.bottom - t.bottom, rightOver: s.right - t.right }
      })
    )
    expect(tiles.length).toBeGreaterThan(0)
    for (const m of tiles) {
      expect(m.top, 'option text must not clip above its tile').toBeGreaterThanOrEqual(-1)
      expect(m.bottomOver, 'option text must not clip below its tile').toBeLessThanOrEqual(1)
      expect(m.rightOver, 'option text must not clip past its tile').toBeLessThanOrEqual(1)
    }

    // Typography contract for the wall: never auto-hyphenate (no "-" word
    // breaks) and center the text so a short answer fills its tile instead of
    // leaving a dead right strip.
    const optStyles = await page.locator('.host-options-stage .host-opt-text').evaluateAll(spans =>
      spans.map(s => {
        const cs = getComputedStyle(s)
        return { hyphens: cs.hyphens, align: cs.textAlign }
      })
    )
    expect(optStyles.length).toBeGreaterThan(0)
    for (const st of optStyles) {
      expect(st.hyphens, 'option text must not auto-hyphenate').not.toBe('auto')
      expect(st.align, 'option text must be centered').toBe('center')
    }

    await context.close()
  })
}

// ── Short question + very long options ──────────────────────────────────────
// The nastier combination: a SHORT question fits at a large font, growing its
// card and starving the options grid — a long option then clipped inside its
// tile even though the long-question fixture above passed. The question card
// cap + option fit must keep every tile intact.
for (const vp of [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
]) {
  test(`long options fit under a short question at ${vp.width}×${vp.height}`, async ({ browser }) => {
    const quiz = {
      ...stressQuiz,
      id: `e2e-shortq-${Date.now()}-${vp.height}`,
      questions: [
        {
          ...stressQuiz.questions[0],
          id: 'q-shortq-1',
          text: 'DeepSeek-R1 became widely discussed because:',
          imageUrl: undefined,
          options: [
            'It was the first AI tool made only for presentations',
            'It was designed only for image generation',
            'It removed the need for human review in AI-generated answers',
            'It showed strong reasoning performance and increased discussion around open-source or open-weight AI models',
          ],
        },
      ],
    }
    const context = await browser.newContext({ viewport: vp })
    const cookie = await hostAuthCookie()
    const eq = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
    const page = await context.newPage()
    await page.addInitScript(q => {
      localStorage.setItem('quizotic_active_session', JSON.stringify(q))
    }, quiz)
    await page.goto('/host/session?preview=host-stage')
    await page.getByRole('button', { name: 'Start lobby' }).click()
    const startQuiz = page.getByRole('button', { name: /Start Quiz/ })
    await expect(startQuiz).toBeEnabled({ timeout: 15_000 })
    await startQuiz.click()
    await expect(page.locator('.host-question-card')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(400)

    const tiles = await page.locator('.host-options-stage .host-opt-text').evaluateAll(spans =>
      spans.map(span => {
        const tile = span.closest('.host-options-stage > div')!
        const s = span.getBoundingClientRect()
        const t = tile.getBoundingClientRect()
        // Upward overflow of a centered flex item is invisible to
        // scrollHeight — geometric containment is the honest check.
        return { top: s.top - t.top, bottomOver: s.bottom - t.bottom, rightOver: s.right - t.right }
      })
    )
    expect(tiles.length).toBe(4)
    for (const m of tiles) {
      expect(m.top, 'option text must not clip above its tile').toBeGreaterThanOrEqual(-1)
      expect(m.bottomOver, 'option text must not clip below its tile').toBeLessThanOrEqual(1)
      expect(m.rightOver, 'option text must not clip past its tile').toBeLessThanOrEqual(1)
    }

    // Typography contract for the wall: never auto-hyphenate (no "-" word
    // breaks) and center the text so a short answer fills its tile instead of
    // leaving a dead right strip.
    const optStyles = await page.locator('.host-options-stage .host-opt-text').evaluateAll(spans =>
      spans.map(s => {
        const cs = getComputedStyle(s)
        return { hyphens: cs.hyphens, align: cs.textAlign }
      })
    )
    expect(optStyles.length).toBeGreaterThan(0)
    for (const st of optStyles) {
      expect(st.hyphens, 'option text must not auto-hyphenate').not.toBe('auto')
      expect(st.align, 'option text must be centered').toBe('center')
    }
    await context.close()
  })
}

// ── Matching questions on the wall ──────────────────────────────────────────
// Matching had NO host-stage rendering at all: the projector showed an empty
// stage while phones had the task, and the reveal showed nothing. The host
// must show the task while live (without leaking the answer alignment) and
// the correct pairs after the reveal.
test('matching question shows the task live and correct pairs after reveal', async ({ browser }) => {
  const matchingQuiz = {
    id: `e2e-match-${Date.now()}`,
    title: 'Matching stage',
    subject: 'e2e',
    language: 'en',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q-match-1',
        type: 'matching',
        text: 'Match the following AI models to their classification',
        matchPairs: [
          { left: 'Claude Fable', right: 'Frontier reasoning model' },
          { left: 'Whisper', right: 'Speech-to-text model' },
          { left: 'Stable Diffusion', right: 'Image generation model' },
        ],
        timerSeconds: 20,
        points: 1000,
      },
    ],
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const cookie = await hostAuthCookie()
  const eq = cookie.indexOf('=')
  await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
  const page = await context.newPage()
  await page.addInitScript(q => {
    localStorage.setItem('quizotic_active_session', JSON.stringify(q))
  }, matchingQuiz)

  await page.goto('/host/session?preview=host-stage')
  await page.getByRole('button', { name: 'Start lobby' }).click()
  const startQuiz = page.getByRole('button', { name: /Start Quiz/ })
  await expect(startQuiz).toBeEnabled({ timeout: 15_000 })
  await startQuiz.click()

  // Live: both columns of the task are on the wall.
  await expect(page.getByText('Match these')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('With one of these')).toBeVisible()
  await expect(page.getByText('Claude Fable')).toBeVisible()
  await expect(page.getByText('Speech-to-text model')).toBeVisible()

  // End the question, reveal — the correct pairs must appear.
  await page.getByRole('button', { name: 'End Now' }).click()
  await page.getByRole('button', { name: /Reveal Answer/ }).click()
  await expect(page.getByText('Correct matches')).toBeVisible({ timeout: 15_000 })
  const pairRow = page.locator('div').filter({ hasText: /^1Claude Fable/ }).last()
  await expect(pairRow).toContainText('Frontier reasoning model')

  await context.close()
})
