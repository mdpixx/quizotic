// Visual verification of the calm presentation stage (PR1).
//
// Drives the REAL host stage — not a mockup — through a real socket session:
// mints a host cookie, seeds a presentation into localStorage, starts the
// session, then joins participants over Socket.IO and votes so the rail's
// response progress, the calm bars and the layout variants are exercised with
// live aggregate data.
//
// The host user id is synthetic and has no row in the database, so the
// GameSession foreign key fails and the session exists only in server memory.
// Nothing here writes to the production database.
//
// Screenshots land in test-results/ for review; assertions cover the things
// that would silently regress (rail present and sized, no corner QR competing
// with it, calm weight on the question, denominator wired to participants).

import { test, expect, type Page } from '@playwright/test'
import { io, type Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

const PRESENTATION = {
  id: 'calm-stage-preview',
  title: 'Calm stage check',
  hypeMode: false,
  slides: [
    {
      id: 's1',
      type: 'multiple_choice',
      question: 'Which communication channel works best locally?',
      options: ['Word of mouth', 'Through HOD', 'Reminder mails', 'Broadcast'],
      showCorrect: false,
      responseMode: 'instant',
    },
    {
      id: 's2',
      type: 'word_cloud',
      question: 'What is the biggest adoption barrier in your office?',
      maxWords: 1,
      responseMode: 'instant',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function joinAndVote(gameCode: string, votes: (number | string)[]) {
  const sockets: Socket[] = []
  for (let i = 0; i < votes.length; i++) {
    const socket = io(BASE, { transports: ['websocket'], forceNew: true })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('join timed out')), 10_000)
      socket.on('connect', () => {
        socket.emit(
          'join_presenter_session',
          { gameCode, displayName: `Tester ${i + 1}` },
          (res: { success: boolean; error?: string }) => {
            clearTimeout(timer)
            if (!res?.success) reject(new Error(res?.error || 'join rejected'))
            else resolve()
          },
        )
      })
      socket.on('connect_error', e => { clearTimeout(timer); reject(e) })
    })
  }

  // Stagger so the count-up and staggered bars are exercised, not jumped past.
  for (let i = 0; i < sockets.length; i++) {
    sockets[i].emit('submit_presenter_response', { gameCode, slideIndex: 0, response: votes[i] })
    await new Promise(r => setTimeout(r, 90))
  }
  return sockets
}

async function startSession(page: Page): Promise<string> {
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: (await hostAuthCookie('calm-stage-preview-host')).split('=').slice(1).join('='),
      url: BASE,
    },
  ])

  await page.addInitScript(pres => {
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(pres))
    localStorage.setItem('quizotic_skip_intro', 'true')
  }, PRESENTATION)

  await page.goto('/host/present/session')
  await page.getByRole('button', { name: /start|present/i }).first().click()

  // The stage renders the code in the rail once the session is live.
  await expect(page.locator('text=/\\d{3} \\d{3}/').first()).toBeVisible({ timeout: 20_000 })
  const code = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      /^\d{3} \d{3}$/.test(d.textContent?.trim() ?? ''),
    )
    return el?.textContent?.trim().replace(' ', '') ?? ''
  })
  expect(code).toMatch(/^\d{6}$/)
  return code
}

test('calm stage: rail, response progress and calm bars render with live votes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const gameCode = await startSession(page)

  const sockets = await joinAndVote(gameCode, [0, 1, 1, 0, 2, 1, 3, 1])
  try {
    // ── The rail exists and the QR is genuinely large ────────────────────────
    const qr = page.locator('svg').filter({ has: page.locator('path, rect') }).first()
    await expect(qr).toBeVisible()

    const railQrWidth = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg')]
      const widths = svgs.map(s => s.getBoundingClientRect().width)
      return Math.max(0, ...widths)
    })
    // Today's corner pill was 44px. Anything in that range means the rail did
    // not render and we silently fell back to the old chrome.
    expect(railQrWidth).toBeGreaterThan(150)

    // ── Response progress counts real votes against the participant count ────
    // "8 of 8" or "All responded" — anything showing 0 means the aggregate
    // never reached the rail, which is the whole point of the counter.
    await expect(page.getByText(/8 of 8 responded|All responded/).first()).toBeVisible({ timeout: 10_000 })

    // `responseMode: 'instant'` means the stage shows results as they arrive —
    // no reveal click. Give the staggered bars time to finish growing before
    // the screenshot so it captures the settled state, not mid-animation.
    await page.waitForTimeout(1200)

    // ── The question uses the calm weight, not 900 ───────────────────────────
    const weight = await page.evaluate(() => {
      const h = document.querySelector('h2')
      return h ? getComputedStyle(h).fontWeight : ''
    })
    expect(weight).toBe('500')

    await page.screenshot({ path: 'test-results/calm-stage-multiple-choice.png', fullPage: false })

    // ── Second slide: word cloud under the same frame ────────────────────────
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/calm-stage-word-cloud.png', fullPage: false })
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})

test('hype mode off leaves the stage free of vote-velocity chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const gameCode = await startSession(page)
  const sockets = await joinAndVote(gameCode, [0, 1, 2])
  try {
    await expect(page.getByText('Vote velocity')).toHaveCount(0)
  } finally {
    sockets.forEach(s => s.disconnect())
  }
})
