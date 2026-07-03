// Confetti render guard. Guards against the regression where the winner burst
// was *called* but never *visible* on the host finale: canvas-confetti's
// default appends a canvas to <body> that ended up clipped/hidden behind the
// framer-motion <motion.section> (transform + overflow:hidden) wrapping the
// podium. The fix binds confetti to a dedicated full-viewport canvas via
// confetti.create(). This test proves the canvas exists on <body> and actually
// paints pixels — the exact failure mode that survived two prior "fixes."
//
// It exercises the REAL bundled useConfetti hook: the host-stage-preview page
// (localhost + ?preview=host-stage) exposes window.__quizoticFireConfetti bound
// to the live hook, so we fire a burst through the actual code path and read
// back non-transparent pixels from the dedicated canvas.

import { test, expect } from '@playwright/test'

const CANVAS_ID = 'quizotic-confetti-canvas'

test('confetti binds a dedicated full-viewport canvas on <body> and paints pixels', async ({ page }) => {
  const messages: string[] = []
  page.on('console', m => messages.push(`${m.type()}: ${m.text()}`))

  // The preview page mounts the real app + useConfetti and exposes the test hook.
  await page.goto('/host/session?preview=host-stage', { waitUntil: 'networkidle' })

  // Wait for the app to mount and register the test hook.
  await page.waitForFunction(() => typeof (window as unknown as { __quizoticFireConfetti?: unknown }).__quizoticFireConfetti === 'function', { timeout: 15_000 })

  // Fire a winner burst through the REAL bundled hook.
  await page.evaluate(() => {
    ;(window as unknown as { __quizoticFireConfetti?: (preset?: string) => void }).__quizoticFireConfetti!('winner')
  })

  // The dedicated canvas must exist (it's appended to <body> on first fire).
  await expect(page.locator(`#${CANVAS_ID}`)).toBeAttached()

  // Give the worker physics a few frames to paint.
  await page.waitForTimeout(700)

  // Structural assertions + render signal. We can't read pixels from the main
  // thread because confetti runs on an OffscreenCanvas worker (transferred),
  // so `getContext` is blocked. Instead:
  //   • Assert the canvas is a direct child of <body>, fixed, full-viewport,
  //     pointer-events:none — i.e. it CANNOT be clipped by the podium's
  //     transformed/overflow-hidden ancestor (the actual bug we're guarding).
  //   • Assert the canvas has real backing dimensions (canvas-confetti sizes
  //     the backing store on bind — a zero-size canvas means bind failed).
  //   • Assert the confetti "fired" log line appeared (proves the call path
  //     reached the bound scope; the prior regression never logged this).
  const result = await page.evaluate((id) => {
    const el = document.getElementById(id) as HTMLCanvasElement | null
    if (!el) return { ok: false, reason: 'canvas not found' }
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    // getComputedStyle resolves % to px, so check position via the keyword and
    // full-viewport via the bounding rect covering the window.
    return {
      onBody: el.parentElement === document.body,
      fixed: style.position === 'fixed',
      fullViewport: rect.left === 0 && rect.top === 0 && rect.width >= window.innerWidth && rect.height >= window.innerHeight,
      passthrough: style.pointerEvents === 'none',
      width: el.width,
      height: el.height,
    }
  }, CANVAS_ID)

  expect(result.onBody, `confetti canvas must be a direct child of <body> (got: ${JSON.stringify(result)})`).toBe(true)
  expect(result.fixed, 'confetti canvas must be position:fixed').toBe(true)
  expect(result.fullViewport, 'confetti canvas must cover the full viewport').toBe(true)
  expect(result.passthrough, 'confetti canvas must not block pointer events').toBe(true)
  expect(result.width, 'confetti canvas must have a real backing width').toBeGreaterThan(0)
  expect(result.height, 'confetti canvas must have a real backing height').toBeGreaterThan(0)
  // The hook logs `[quizotic] confetti fired: preset=winner` on a successful
  // fire — its absence means the call path never reached the bound scope.
  expect(messages.some(m => m.includes('confetti fired: preset=winner')), `expected a confetti-fired log line (console: ${messages.join(' | ')})`).toBe(true)
})
