// Mobile host-flow guard (July 2026 mobile streamlining). Drives the real
// host UI at phone size (375×812) through lobby → question → reveal →
// standings → finale podium → report CTA, with two scripted socket
// participants answering with mixed confidence. A second test verifies the
// report page's insight visuals (confidence grid, score distribution,
// accuracy scan) and the Pro-only CSV gating against mocked API data.
// Screenshots land in SHOT_DIR (default /tmp/quizotic-shots) for eyeballing.

import { test, expect, Page } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'
import { mkdirSync } from 'fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const SHOTS = process.env.SHOT_DIR || '/tmp/quizotic-shots'

test.use({ viewport: { width: 375, height: 812 } })

function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, { transports: ['websocket'], reconnection: false, forceNew: true })
    const t = setTimeout(() => { s.disconnect(); reject(new Error('socket connect timeout')) }, 10_000)
    s.on('connect', () => { clearTimeout(t); resolve(s) })
    s.on('connect_error', err => { clearTimeout(t); reject(new Error(`connect_error: ${err.message}`)) })
  })
}

async function addBot(gameCode: string, name: string, pick: number, confidence: 'sure' | 'unsure', delayMs: number): Promise<Socket> {
  const s = await connectSocket()
  const joined = await new Promise<{ success?: boolean; participantId?: string }>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('join ack timeout')), 8_000)
    s.emit('join_session', { gameCode, displayName: name }, (res: { success?: boolean; participantId?: string }) => { clearTimeout(t); resolve(res) })
  })
  if (!joined.success || !joined.participantId) throw new Error(`bot ${name} failed to join`)
  const pid = joined.participantId
  s.on('question_show', (payload: { startAt?: number }) => {
    // Respect the 3.5s get-ready countdown before answering.
    const wait = Math.max(0, (payload.startAt ?? Date.now()) - Date.now()) + delayMs
    setTimeout(() => {
      s.emit('submit_answer', { gameCode, participantId: pid, answer: pick, timeMs: delayMs, confidence }, () => {})
    }, wait)
  })
  return s
}

async function clickPrimary(page: Page): Promise<string | null> {
  for (const label of [/Reveal Answer/, /View Standings/, /Next Question/, /^End Quiz$/]) {
    const btn = page.getByRole('button', { name: label }).first()
    if (await btn.isVisible().catch(() => false)) {
      const text = await btn.textContent()
      await btn.click()
      return text
    }
  }
  return null
}

test('mobile host flow visual audit', async ({ page, context }) => {
  test.setTimeout(240_000)
  mkdirSync(SHOTS, { recursive: true })

  const cookie = await hostAuthCookie()
  const eq = cookie.indexOf('=')
  await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])

  // ── Idle ──
  await page.goto('/host/session?preview=host-stage')
  await expect(page.getByRole('button', { name: 'Start lobby' })).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `${SHOTS}/01-idle.png`, fullPage: true })

  // ── Lobby ──
  await page.getByRole('button', { name: 'Start lobby' }).click()
  await expect(page.getByText('Game PIN', { exact: true })).toBeVisible({ timeout: 15_000 })
  const gameCode = (await page.locator('p.select-all').first().textContent())?.trim() ?? ''
  expect(gameCode).toMatch(/^\d{6}$/)

  const botA = await addBot(gameCode, 'Asha', 0, 'sure', 1200)   // correct on Q1+Q2, wrong Q3
  const botB = await addBot(gameCode, 'Ravi', 1, 'unsure', 2200) // wrong Q1+Q2, correct Q3
  await expect(page.getByText('2 joined')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SHOTS}/02-lobby.png`, fullPage: true })

  // ── Start quiz → Q1 live ──
  await page.getByRole('button', { name: /Start Quiz/ }).click()
  await expect(page.getByText('Live Question')).toBeVisible({ timeout: 25_000 })
  await page.screenshot({ path: `${SHOTS}/03-q1-live.png`, fullPage: true })

  // Both bots answer → question auto-ends → reveal state.
  await expect(page.getByRole('button', { name: /Reveal Answer|View Standings|Next Question/ }).first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${SHOTS}/04-q1-reveal.png`, fullPage: true })

  // Short-phone check (iPhone SE height) while on the reveal screen.
  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/05-q1-reveal-se.png`, fullPage: false })
  await page.setViewportSize({ width: 375, height: 812 })

  // ── Drive the cadence until the finale ──
  for (let i = 0; i < 12; i++) {
    if (await page.getByText('Session Complete').first().isVisible().catch(() => false)) break
    const clicked = await clickPrimary(page)
    if (clicked && /Standings/.test(clicked)) {
      await page.waitForTimeout(1_500)
      await page.screenshot({ path: `${SHOTS}/06-standings.png`, fullPage: true })
    }
    await page.waitForTimeout(2_500)
  }

  // ── Finale podium ──
  await expect(page.getByText('Session Complete').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(7_500) // let the reveal sequence + confetti play
  await page.screenshot({ path: `${SHOTS}/07-podium-finale.png`, fullPage: false })
  await page.screenshot({ path: `${SHOTS}/08-ended-full.png`, fullPage: true })

  // ── Report CTA exists and navigates ──
  // (The synthetic e2e host has no User row, so GameSession rows can't persist
  //  for it — FK. Real hosts have real rows; the report content itself is
  //  verified below with route-mocked data.)
  const reportCta = page.getByRole('link', { name: /View full session report/ })
  await expect(reportCta).toBeVisible({ timeout: 10_000 })
  await reportCta.click()
  await page.waitForURL('**/host/reports/**', { timeout: 15_000 })

  botA.disconnect()
  botB.disconnect()
})

// ── Report page visual verification with realistic mocked data ──────────────
const MOCK_STATS = [
  {
    index: 0, text: 'Which regulatory body oversees the Indian securities and stock market?', type: 'mcq',
    correctPct: 78, bloomsLevel: 'remember', explanation: 'SEBI is the statutory regulator of the Indian securities market.',
    confidenceGrid: { sureCorrect: 14, sureWrong: 3, unsureCorrect: 4, unsureWrong: 2 },
    optionDistribution: [18, 3, 1, 1], options: ['SEBI', 'RBI', 'Ministry of Finance', 'NITI Aayog'], correctIndex: 0,
  },
  {
    index: 1, text: 'Which planet is closest to the Sun?', type: 'mcq',
    correctPct: 43, bloomsLevel: 'remember', explanation: 'Mercury is the innermost planet.',
    confidenceGrid: { sureCorrect: 6, sureWrong: 8, unsureCorrect: 4, unsureWrong: 5 },
    optionDistribution: [10, 9, 3, 1], options: ['Mercury', 'Venus', 'Earth', 'Mars'], correctIndex: 0,
  },
  {
    index: 2, text: 'How confident do you feel about this topic?', type: 'rating',
    correctPct: null, isNonScored: true, bloomsLevel: null, explanation: null, confidenceGrid: null,
    ratingHistogram: [1, 3, 8, 7, 4], ratingAverage: 3.4, ratingMax: 5,
  },
  {
    index: 3, text: 'A student answers correctly in the final second. What should scoring reward?', type: 'mcq',
    correctPct: 91, bloomsLevel: 'understand', explanation: 'Reward correctness while making speed matter.',
    confidenceGrid: { sureCorrect: 19, sureWrong: 1, unsureCorrect: 2, unsureWrong: 1 },
    optionDistribution: [1, 21, 1, 0], options: ['Nothing', 'Accuracy with lower speed points', 'Only streaks', 'Manual points'], correctIndex: 1,
  },
]

const MOCK_LEADERBOARD = [
  { name: 'Asha', score: 2850 }, { name: 'Ravi', score: 2410 }, { name: 'Meera', score: 2200 },
  { name: 'Kabir', score: 1830 }, { name: 'Diya', score: 1410 }, { name: 'Arjun', score: 660 },
]

const MOCK_SESSION = {
  id: 'mock-session-1', code: '482913', type: 'quiz', status: 'ended', mode: 'live',
  participantCount: 23,
  createdAt: '2026-07-06T10:00:00.000Z', endedAt: '2026-07-06T10:24:00.000Z',
  results: {
    quizTitle: 'Indian Financial Markets — Unit 3',
    leaderboard: MOCK_LEADERBOARD,
    duration: 1440, questionCount: 4, maxScore: 3000,
    questionStats: MOCK_STATS,
  },
}

const MOCK_MATRIX = {
  questions: MOCK_STATS.map(s => ({ index: s.index, label: s.text, type: s.type, isScored: !s.isNonScored })),
  participants: MOCK_LEADERBOARD.map((p, i) => ({
    id: `att-${i}`, name: p.name, score: p.score, correct: 3 - (i % 3), answered: 4,
    accuracy: Math.round(((3 - (i % 3)) / 3) * 100),
    cells: [1, i % 3 === 0 ? 1 : 0, 2, i % 2],
    points: [900, i % 3 === 0 ? 800 : 0, 0, (i % 2) * 950],
  })),
  perQuestionAccuracy: [78, 43, null, 91],
}

async function mockReportApis(page: Page, plan: 'free' | 'pro') {
  await page.route('**/api/sessions/mock-session-1', r => r.fulfill({ json: { success: true, data: MOCK_SESSION } }))
  await page.route('**/api/sessions/mock-session-1/attendees**', r => r.fulfill({
    json: { success: true, data: MOCK_LEADERBOARD.map((p, i) => ({ joinedAt: '2026-07-06T09:58:00.000Z', leftAt: '2026-07-06T10:24:00.000Z', durationSec: 1560 - i * 60 })) },
  }))
  await page.route('**/api/sessions/mock-session-1/matrix', r => r.fulfill({ json: { success: true, data: MOCK_MATRIX } }))
  await page.route('**/api/billing/status', r => r.fulfill({ json: { plan } }))
}

test('report page renders insight visuals (mocked data)', async ({ page, context }) => {
  test.setTimeout(120_000)
  mkdirSync(SHOTS, { recursive: true })
  const cookie = await hostAuthCookie()
  const eq = cookie.indexOf('=')
  await context.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])

  await mockReportApis(page, 'free')
  await page.goto('/host/reports/mock-session-1')
  await expect(page.getByText('Confidence grid').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Misconception', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Score distribution')).toBeVisible()
  await expect(page.getByText('Accuracy by question')).toBeVisible()
  await expect(page.getByText('CSV · Pro')).toBeVisible() // free plan → locked pill
  await page.screenshot({ path: `${SHOTS}/09-report-mobile.png`, fullPage: true })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/10-report-desktop.png`, fullPage: true })

  // Pro pass — CSV becomes a real download button.
  await page.unroute('**/api/billing/status')
  await page.route('**/api/billing/status', r => r.fulfill({ json: { plan: 'pro' } }))
  await page.reload()
  await expect(page.getByText('Confidence grid').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/11-report-desktop-pro.png`, fullPage: false })
})
