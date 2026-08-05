// Result visuals for the calm stage (PR2): density ridge, dot view, alive
// scatter dots, FLIP word cloud.
//
// Drives the real stage through a live socket session — the aggregates these
// visuals render only exist server-side, so a component test would be
// asserting against fixtures rather than the thing that ships.
//
// The host user is synthetic and has no database row, so the GameSession
// foreign key fails and nothing is written to production.

import { test, expect, type Page } from '@playwright/test'
import { io, type Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

const DECK = {
  id: 'calm-result-visuals',
  title: 'Result visuals check',
  hypeMode: false,
  slides: [
    {
      id: 'r1',
      type: 'rating_scale',
      question: 'How confident are you in explaining SwadhyayaNxt?',
      minLabel: 'Not confident',
      maxLabel: 'Very confident',
      maxRating: 5,
      responseMode: 'instant',
    },
    {
      id: 'g1',
      type: 'grid_2x2',
      question: 'Where does your unit sit today?',
      xLabel: 'Adoption', yLabel: 'Capability',
      xMin: 'Low', xMax: 'High', yMin: 'Low', yMax: 'High',
      responseMode: 'instant',
    },
    {
      id: 'm1',
      type: 'multiple_choice',
      question: 'Which metric is better for fair comparison?',
      options: ['Total completions', 'Active learners', 'Adoption rate', 'Avg learning hours'],
      showCorrect: false,
      responseMode: 'instant',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function startSession(page: Page): Promise<string> {
  await page.context().addCookies([{
    name: 'authjs.session-token',
    value: (await hostAuthCookie('calm-visuals-host')).split('=').slice(1).join('='),
    url: BASE,
  }])
  await page.addInitScript(deck => {
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(deck))
    localStorage.setItem('quizotic_skip_intro', 'true')
  }, DECK)
  await page.goto('/host/present/session')
  await page.getByRole('button', { name: /start|present/i }).first().click()
  await expect(page.locator('text=/\\d{3} \\d{3}/').first()).toBeVisible({ timeout: 20_000 })
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => /^\d{3} \d{3}$/.test(d.textContent?.trim() ?? ''))
    return (el?.textContent ?? '').trim().replace(' ', '')
  })
}

async function join(gameCode: string, n: number): Promise<Socket[]> {
  const sockets: Socket[] = []
  for (let i = 0; i < n; i++) {
    const s = io(BASE, { transports: ['websocket'], forceNew: true })
    sockets.push(s)
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('join timed out')), 10_000)
      s.on('connect', () =>
        s.emit('join_presenter_session', { gameCode, displayName: `Tester ${i + 1}` },
          (res: { success: boolean; error?: string }) => {
            clearTimeout(t)
            res?.success ? resolve() : reject(new Error(res?.error || 'join rejected'))
          }))
      s.on('connect_error', e => { clearTimeout(t); reject(e) })
    })
  }
  return sockets
}

async function send(sockets: Socket[], gameCode: string, slideIndex: number, values: unknown[]) {
  for (let i = 0; i < values.length && i < sockets.length; i++) {
    sockets[i].emit('submit_presenter_response', { gameCode, slideIndex, response: values[i] })
    await new Promise(r => setTimeout(r, 70))
  }
}

test('density ridge replaces the bare average and separates a split room', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  const sockets = await join(code, 12)
  try {
    // A deliberately split room: six 1s and six 5s. Mean is 3.0 — identical to
    // a room that all answered 3, and the old display could not tell them apart.
    await send(sockets, code, 0, [1, 1, 1, 5, 5, 5, 1, 1, 1, 5, 5, 5])
    await page.waitForTimeout(1000)

    const ridge = await page.evaluate(() => {
      const path = document.querySelector('svg path[fill^="url"]') as SVGPathElement | null
      if (!path) return null
      const d = path.getAttribute('d') ?? ''
      // Sample the curve height at the edges vs the middle. A split room must
      // be taller at both ends than in the centre.
      const ys = [...d.matchAll(/[MLQ]\s*[\d.]+\s+([\d.]+)/g)].map(m => Number(m[1]))
      const body = ys.slice(1, -2)
      const mid = body[Math.floor(body.length / 2)]
      return { first: body[0], mid, last: body[body.length - 1], count: body.length }
    })
    expect(ridge).not.toBeNull()
    // Lower y = taller curve, since y grows downward in SVG.
    expect(ridge!.first).toBeLessThan(ridge!.mid)
    expect(ridge!.last).toBeLessThan(ridge!.mid)

    // The mean handle still reports 3.0 — the number did not change, the
    // information did.
    await expect(page.getByText('3.0', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'test-results/pr2-density-ridge.png' })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})

test('grid dots de-overlap a clustered room and animate in', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  const sockets = await join(code, 10)
  try {
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.waitForTimeout(400)

    // Ten taps inside a tiny box — the "everyone agrees" case that used to
    // render as two or three visible dots.
    await send(sockets, code, 1, Array.from({ length: 10 }, (_, i) => ({
      x: 66 + (i % 3) * 0.4,
      y: 32 + Math.floor(i / 3) * 0.4,
    })))
    await page.waitForTimeout(1200)

    const dots = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.qz-pin-in')] as HTMLElement[]
      const centres = nodes.map(n => {
        const r = n.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
      let min = Infinity
      for (let i = 0; i < centres.length; i++)
        for (let j = i + 1; j < centres.length; j++)
          min = Math.min(min, Math.hypot(centres[j].x - centres[i].x, centres[j].y - centres[i].y))
      return { count: nodes.length, minSeparationPx: min }
    })

    expect(dots.count).toBe(10)
    // Every dot distinguishable — before relaxation these sat within ~2px.
    expect(dots.minSeparationPx).toBeGreaterThan(4)

    // Drift is running as a CSS animation, not a JS loop.
    const drifting = await page.evaluate(() =>
      [...document.querySelectorAll('.qz-pin-drift')].filter(
        n => getComputedStyle(n).animationName === 'qz-pin-drift',
      ).length)
    expect(drifting).toBe(10)

    // The plot is square and the axis labels sit outside it. Both regressed
    // once while making the grid fill the frame height: aspect-ratio lost to
    // flex-shrink (square became a strip), then the plot overflowed its column
    // and slid underneath the y-axis labels.
    const geom = await page.evaluate(() => {
      // Explicit hook: the dot wrappers carry `aspect-ratio` too, so matching
      // on style selects a single dot instead of the plot.
      const plot = document.querySelector('[data-pin-plot]')
      if (!plot) return null
      const p = plot.getBoundingClientRect()
      // 'High' and 'Low' each appear twice — once on each axis — so collect
      // every match rather than the first.
      const texts = new Set(['High', 'Low', 'Capability', 'Adoption'])
      const rects = [...document.querySelectorAll('span')]
        .filter(s => texts.has((s.textContent ?? '').trim()))
        .map(s => s.getBoundingClientRect())
      const found = new Set(
        [...document.querySelectorAll('span')]
          .map(s => (s.textContent ?? '').trim())
          .filter(t => texts.has(t)),
      )
      return {
        aspect: p.width / p.height,
        plot: { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width },
        allLabelsFound: found.size === texts.size && rects.length === 6,
        // Widest horizontal gap between any two labels — the x scale must
        // actually span the plot rather than bunching in a corner.
        labelSpan: (() => {
          const xs = rects.flatMap(r => [r.left, r.right])
          return xs.length ? Math.max(...xs) - Math.min(...xs) : 0
        })(),
        outsidePlot: rects.filter(
          r => r.left < p.left - 1 || r.right > p.right + 1 || r.top < p.top - 1 || r.bottom > p.bottom + 1,
        ).length,
      }
    })
    expect(geom).not.toBeNull()
    expect(geom!.aspect).toBeGreaterThan(0.95)
    expect(geom!.aspect).toBeLessThan(1.05)
    expect(geom!.allLabelsFound).toBe(true)
    // Every label inside the plot box — they previously sat on top of the
    // quadrants or hung off the edge depending on the wrapper's width.
    expect(geom!.outsidePlot).toBe(0)
    // And spread across it, not collapsed into one corner.
    expect(geom!.labelSpan).toBeGreaterThan(geom!.plot.width * 0.8)

    await page.screenshot({ path: 'test-results/pr2-alive-dots.png' })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})

test('dot view renders one dot per response at small N', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  const sockets = await join(code, 5)
  try {
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.waitForTimeout(400)

    // Five responses — exactly where a bar chart looks broken.
    await send(sockets, code, 2, [1, 1, 0, 2, 1])
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Dots', exact: true }).click()
    await page.waitForTimeout(900)

    const dotCount = await page.evaluate(
      () => document.querySelectorAll('span[style*="border-radius: 50%"]').length,
    )
    expect(dotCount).toBeGreaterThanOrEqual(5)

    await page.screenshot({ path: 'test-results/pr2-dot-view.png' })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})
