// PR3: per-slide layouts, multi-select, host branding.
//
// The multi-select case is driven end to end through a live socket session
// rather than asserted on a component, because the property that matters spans
// three processes: the participant sends an ARRAY, the server counts picks but
// increments respondents once, and the host divides by respondents. Only a
// real session exercises that seam.

import { test, expect, type Page } from '@playwright/test'
import { io, type Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="34"><rect width="150" height="34" fill="#0F1B3D"/></svg>',
  )

const DECK = {
  id: 'calm-builder-features',
  title: 'Builder features check',
  hypeMode: false,
  logoUrl: LOGO,
  slides: [
    {
      id: 'ms1',
      type: 'multiple_choice',
      question: 'Which metrics matter for fair comparison?',
      options: ['Total completions', 'Active learners', 'Adoption rate', 'Avg learning hours'],
      showCorrect: false,
      maxSelections: 3,
      responseMode: 'instant',
    },
    {
      id: 'lay1',
      type: 'multiple_choice',
      question: 'Which channel works best locally?',
      options: ['Word of mouth', 'Through HOD', 'Reminder mails'],
      showCorrect: false,
      layout: 'content-left',
      contentImageUrl: LOGO,
      responseMode: 'instant',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function startSession(page: Page): Promise<string> {
  await page.context().addCookies([{
    name: 'authjs.session-token',
    value: (await hostAuthCookie('calm-builder-host')).split('=').slice(1).join('='),
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

test('multi-select counts picks but tallies respondents once', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  const sockets = await join(code, 5)
  try {
    // Five people, three picks each = 15 picks. Option 1 chosen by all five.
    const ballots = [[0, 1, 2], [1, 2, 3], [0, 1, 3], [1, 2, 3], [0, 1, 2]]
    for (let i = 0; i < ballots.length; i++) {
      sockets[i].emit('submit_presenter_response', { gameCode: code, slideIndex: 0, response: ballots[i] })
      await new Promise(r => setTimeout(r, 90))
    }
    await page.waitForTimeout(900)

    const read = await page.evaluate(() => {
      const nums = [...document.querySelectorAll('[data-bar-count]')].map(n => Number(n.textContent))
      const pcts = [...document.querySelectorAll('[data-bar-pct]')].map(
        n => Number((n.textContent ?? '').replace(/\D/g, '')),
      )
      const progress = document.querySelector('[data-response-progress]')?.textContent ?? ''
      return { nums, pcts, progress }
    })

    // Picks: A=3, B=5, C=3, D=3 → 14... asserted from the ballots themselves
    // so the expectation cannot drift from the fixture.
    const expected = [0, 1, 2, 3].map(i => ballots.filter(b => b.includes(i)).length)
    expect(read.nums).toEqual(expected)
    expect(read.nums.reduce((a, b) => a + b, 0)).toBeGreaterThan(5)

    // Percentages are of the five respondents, so they exceed 100% in total
    // while each stays a sane 0–100.
    expect(read.pcts).toEqual(expected.map(c => Math.round((c / 5) * 100)))
    expect(read.pcts.reduce((a, b) => a + b, 0)).toBeGreaterThan(100)
    for (const p of read.pcts) expect(p).toBeLessThanOrEqual(100)

    // The counter must still read five people, not fifteen.
    expect(read.progress).toMatch(/All responded|5 of 5/)

    await expect(page.getByText(/Up to 3 picks each/)).toBeVisible()
    await page.screenshot({ path: 'test-results/pr3-multiselect.png' })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})

test('a content-left slide splits into content and media columns', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  const sockets = await join(code, 3)
  try {
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.waitForTimeout(500)
    for (let i = 0; i < 3; i++) {
      sockets[i].emit('submit_presenter_response', { gameCode: code, slideIndex: 1, response: i })
      await new Promise(r => setTimeout(r, 80))
    }
    await page.waitForTimeout(700)

    const cols = await page.evaluate(() => {
      const grid = document.querySelector('[data-slide-layout]')
      if (!grid) return null
      const style = getComputedStyle(grid)
      return {
        layout: grid.getAttribute('data-slide-layout'),
        columns: style.gridTemplateColumns.split(' ').length,
      }
    })
    expect(cols).not.toBeNull()
    expect(cols!.layout).toBe('content-left')
    // Two real columns — the whole point of the layout is that the result no
    // longer runs the full width.
    expect(cols!.columns).toBe(2)

    await page.screenshot({ path: 'test-results/pr3-layout-content-left.png' })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})

test('joining a presentation through the quiz handler is rejected, not fatal', async ({ page }) => {
  // Regression guard. The participant page picks its join event from
  // /api/session/lookup, which is best-effort — on a network blip it falls
  // back to `join_session`. That handler read `session.quizData.title` on a
  // session that has no quizData and threw an unhandled rejection, killing
  // the process and every other live session on the instance with it.
  await page.setViewportSize({ width: 1280, height: 800 })
  const code = await startSession(page)

  const socket = io(BASE, { transports: ['websocket'], forceNew: true })
  try {
    const res = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no ack — the server most likely died')), 10_000)
      socket.on('connect', () =>
        socket.emit('join_session', { gameCode: code, displayName: 'Wrong Door' }, (r: { success: boolean; error?: string }) => {
          clearTimeout(t)
          resolve(r)
        }))
      socket.on('connect_error', e => { clearTimeout(t); reject(e) })
    })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/presentation/i)

    // And the server is still serving: a correct join on the same code works.
    const good = io(BASE, { transports: ['websocket'], forceNew: true })
    const ok = await new Promise<{ success: boolean }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('server stopped answering')), 10_000)
      good.on('connect', () =>
        good.emit('join_presenter_session', { gameCode: code, displayName: 'Right Door' }, (r: { success: boolean }) => {
          clearTimeout(t)
          resolve(r)
        }))
    })
    expect(ok.success).toBe(true)
    good.disconnect()
  } finally {
    socket.disconnect()
  }
})

test('the host logo renders on the stage and on the participant phone', async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const code = await startSession(page)
  try {
    const stageLogo = await page.evaluate(() => {
      const img = document.querySelector('[data-deck-logo]') as HTMLImageElement | null
      return img ? { src: img.getAttribute('src')?.slice(0, 30), visible: img.getBoundingClientRect().height > 0 } : null
    })
    expect(stageLogo).not.toBeNull()
    expect(stageLogo!.visible).toBe(true)

    // Participant side: a real browser joining the same code.
    const phone = await context.newPage()
    await phone.setViewportSize({ width: 390, height: 844 })
    await phone.goto(`/join?code=${code}&mode=presenter`)
    await phone.getByPlaceholder(/name/i).first().fill('Nayna')
    await phone.getByRole('button', { name: /join|go|enter/i }).first().click()
    await phone.waitForTimeout(2500)

    const phoneLogo = await phone.evaluate(
      () => [...document.querySelectorAll('img')].filter(i => (i.getAttribute('src') ?? '').startsWith('data:image/svg')).length,
    )
    expect(phoneLogo).toBeGreaterThan(0)
    await phone.screenshot({ path: 'test-results/pr3-participant-logo.png' })
    await phone.close()
  } catch (err) {
    await page.screenshot({ path: 'test-results/pr3-logo-failure.png' })
    throw err
  }
})
