// The builder preview must not lie about what the room will see.
//
// Two regressions this guards:
//
//   * Content width. Interactive slides are projected with a join rail taking
//     roughly a quarter of the frame. A preview that renders full-bleed lets an
//     author lay a slide out against a width that never exists.
//   * Question weight. The projected stage dropped to 500; a preview still
//     drawing 700 would sell a different design than the one that ships.
//
// Uses the dev-only `?preview=builder` bypass (src/proxy.ts, NODE_ENV-gated)
// so the page renders without an OAuth round-trip, and seeds the deck through
// the builder's own draft storage rather than driving the slide-type picker.

import { test, expect } from '@playwright/test'

const DECK_ID = 'calm-builder-preview-check'

const DECK = {
  id: DECK_ID,
  title: 'Calm preview check',
  hypeMode: false,
  slides: [
    {
      id: 'a',
      type: 'multiple_choice',
      question: 'Which communication channel works best locally?',
      options: ['Word of mouth', 'Through HOD', 'Reminder mails', 'Broadcast'],
      showCorrect: false,
    },
    { id: 'b', type: 'title', heading: 'Thanks', subheading: '', bgColor: '#FAFAF8' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.addInitScript(
    ({ id, deck }) => {
      localStorage.setItem(
        `quizotic_presentation_draft_${id}`,
        JSON.stringify({ value: deck, savedAt: Date.now() }),
      )
    },
    { id: DECK_ID, deck: DECK },
  )
  await page.goto(`/host/present/create?preview=builder&id=${DECK_ID}`)
  // More than one preview node exists (a hidden mobile pager copy); the laid-out
  // one is the desktop canvas.
  await expect
    .poll(async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-slide-preview]')].filter(
          f => f.getBoundingClientRect().width > 100,
        ).length,
      ),
    )
    .toBeGreaterThan(0)
})

async function activePreview(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const frame = [...document.querySelectorAll('[data-slide-preview]')].find(
      f => f.getBoundingClientRect().width > 100,
    ) as HTMLElement | undefined
    if (!frame) return null
    const rail = frame.querySelector('[data-preview-rail]') as HTMLElement | null
    const heading = frame.querySelector('p') as HTMLElement | null
    const fb = frame.getBoundingClientRect()
    const rb = rail?.getBoundingClientRect() ?? null
    return {
      slideType: frame.dataset.slideType ?? '',
      frameWidth: fb.width,
      railWidth: rb?.width ?? 0,
      railFlushRight: rb ? fb.right - rb.right : null,
      headingWeight: heading ? getComputedStyle(heading).fontWeight : '',
      headingClearsRail: rb && heading ? rb.left - heading.getBoundingClientRect().right : null,
    }
  })
}

test('interactive slides reserve the join rail at the projected proportion', async ({ page }) => {
  const info = await activePreview(page)
  expect(info).not.toBeNull()
  expect(info!.slideType).toBe('multiple_choice')

  // The live stage rail is clamp(140px, 25cqw, 360px). Anything far outside
  // this band means the preview and the stage disagree about content width.
  const share = info!.railWidth / info!.frameWidth
  expect(share).toBeGreaterThan(0.15)
  expect(share).toBeLessThan(0.32)

  // Flush to the frame edge, and never overlapping the question.
  expect(Math.abs(info!.railFlushRight ?? 999)).toBeLessThanOrEqual(1)
  expect(info!.headingClearsRail ?? -1).toBeGreaterThanOrEqual(0)
})

test('preview question uses the calm weight the stage renders', async ({ page }) => {
  const info = await activePreview(page)
  expect(info!.headingWeight).toBe('500')
})

test('content slides get no rail — there is nothing to join in on', async ({ page }) => {
  // Advance to slide 2 (the title slide) with the canvas pager.
  await page.evaluate(() => {
    const next = [...document.querySelectorAll('button')].find(
      b => (b.textContent ?? '').trim() === '›',
    )
    ;(next as HTMLElement | undefined)?.click()
  })
  await expect
    .poll(async () => (await activePreview(page))?.slideType)
    .toBe('title')

  const info = await activePreview(page)
  expect(info!.railWidth).toBe(0)
})
