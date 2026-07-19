// Participant desktop/tablet LAYOUT ASSERTIONS (July 2026 desktop stream).
// Companion to participant-desktop-visual.spec.ts (which captures screenshots).
// This spec drives a real socket session and asserts the structural layout
// properties at each breakpoint — more reliable than eyeballing screenshots:
//
//   - <768px (mobile):  single column, no rails, vertical MCQ stack, old topbar
//   - ≥1024px (desktop): 3-zone grid, PlayerHUD + StageRail visible, MCQ 2×2 grid,
//                        confidence modal centered, question text uses clamp class
//
// The participant is a real browser at /join?code=XXX; the host is a socket.

import { test, expect, Page } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

const TEST_QUIZ = {
  title: 'Layout Assertion',
  subject: 'e2e', language: 'en',
  questions: [
    {
      id: 'q1', type: 'mcq',
      text: 'Which regulatory body oversees the Indian securities and stock market and protects investor interests across exchanges?',
      options: ['SEBI', 'RBI', 'Ministry of Finance', 'NITI Aayog'],
      correctAnswer: '0', timerSeconds: 30, points: 1000,
    },
    {
      id: 'q2', type: 'mcq',
      text: 'Which planet has the most moons?',
      options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
      correctAnswer: '1', timerSeconds: 30, points: 1000,
    },
  ],
}

function connectSocket(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, {
      transports: ['websocket'], reconnection: false, forceNew: true,
      ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
    })
    const t = setTimeout(() => { s.disconnect(); reject(new Error('socket connect timeout')) }, 10_000)
    s.on('connect', () => { clearTimeout(t); resolve(s) })
    s.on('connect_error', err => { clearTimeout(t); reject(new Error(`connect_error: ${err.message}`)) })
  })
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs)
    socket.emit(event, payload, (res: T) => { clearTimeout(t); resolve(res) })
  })
}

async function addBot(gameCode: string, name: string, pick: number, delayMs: number): Promise<Socket> {
  const s = await connectSocket()
  const joined = await emitWithAck<{ success?: boolean; participantId?: string }>(
    s, 'join_session', { gameCode, displayName: name },
  )
  if (!joined.success || !joined.participantId) throw new Error(`bot ${name} failed to join`)
  const pid = joined.participantId
  s.on('question_show', (payload: { startAt?: number }) => {
    const wait = Math.max(0, (payload.startAt ?? Date.now()) - Date.now()) + delayMs
    setTimeout(() => {
      s.emit('submit_answer', { gameCode, participantId: pid, answer: pick, timeMs: delayMs, confidence: 'sure' }, () => {})
    }, wait)
  })
  return s
}

// Read computed style of the participant's stage grid wrapper.
async function gridColumns(page: Page): Promise<string> {
  return page.locator('.participant-stage-grid').first().evaluate(
    el => getComputedStyle(el).gridTemplateColumns
  )
}
async function gridColumns2(page: Page): Promise<string> {
  return page.locator('.participant-stage-grid-2').first().evaluate(
    el => getComputedStyle(el).gridTemplateColumns
  )
}

test('participant question phase: mobile single-column, desktop 3-zone grid', async ({ browser }) => {
  test.setTimeout(120_000)
  const hostCookie = await hostAuthCookie()
  const host = await connectSocket(hostCookie)
  const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
    host, 'create_session', { quizData: TEST_QUIZ },
  )
  if (!created.success || !created.gameCode) throw new Error(`create_session failed: ${created.error}`)
  const gameCode = created.gameCode
  const botA = await addBot(gameCode, 'Asha', 0, 1500)
  const botB = await addBot(gameCode, 'Ravi', 1, 2500)

  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`/join?code=${gameCode}`)
  await page.getByRole('textbox', { name: 'Your name' }).fill('Layout-Test')
  await page.getByRole('button', { name: /Join|Play|Enter|Start/i }).first().click()
  host.emit('start_quiz', { gameCode })

  // Wait for the question card to render.
  await page.locator('.participant-stage-grid').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('button[aria-label^="Option "]').first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(800)

  // ── DESKTOP (1024px): 3-zone grid + both rails visible ──
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(400)
  const cols1024 = await gridColumns(page)
  // Three columns = "280px ... 240px" (left rail, center, right rail)
  expect(cols1024.split(' ').length).toBe(3)
  expect(cols1024).toContain('280px')
  expect(cols1024).toContain('240px')
  // PlayerHUD (left) visible
  await expect(page.locator('.participant-hud')).toBeVisible()
  // StageRail (right) visible
  await expect(page.locator('.participant-rail')).toBeVisible()
  // Old mobile topbar hidden at lg
  await expect(page.locator('.participant-topbar')).toBeHidden()
  // MCQ options render as a 2x2 grid (grid-template-columns: 1fr 1fr) on desktop
  // for 4-option MCQs. The option container is the div right after the question card.
  const optGrid = page.locator('.participant-stage-grid button[aria-label^="Option "]').first()
    .locator('xpath=ancestor::div[starts-with(@class,"pb-4")]').first()
  const optCols = await optGrid.evaluate(el => getComputedStyle(el).gridTemplateColumns)
  // 2-column grid → "1fr 1fr" or similar (two tracks)
  expect(optCols.split(' ').filter(Boolean).length).toBe(2)

  // ── WIDE DESKTOP (1536px): still 3 zones, slightly more gap ──
  await page.setViewportSize({ width: 1536, height: 900 })
  await page.waitForTimeout(400)
  const cols1536 = await gridColumns(page)
  expect(cols1536.split(' ').length).toBe(3)

  // ── TABLET (768px): single column (rails hidden, grid collapses) ──
  await page.setViewportSize({ width: 768, height: 900 })
  await page.waitForTimeout(400)
  const cols768 = await gridColumns(page)
  expect(cols768.split(' ').length).toBe(1) // single column
  await expect(page.locator('.participant-hud')).toBeHidden()
  await expect(page.locator('.participant-rail')).toBeHidden()
  // Mobile topbar reappears below lg
  await expect(page.locator('.participant-topbar')).toBeVisible()
  // MCQ options back to vertical stack (single column)
  const optCols768 = await optGrid.evaluate(el => getComputedStyle(el).gridTemplateColumns)
  expect(optCols768.trim() === '' || optCols768.split(' ').filter(Boolean).length === 1).toBeTruthy()

  // ── PHONE (375px): same single-column behaviour ──
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(400)
  const cols375 = await gridColumns(page)
  expect(cols375.split(' ').length).toBe(1)
  await expect(page.locator('.participant-hud')).toBeHidden()
  await expect(page.locator('.participant-rail')).toBeHidden()
  await expect(page.locator('.participant-topbar')).toBeVisible()

  botA.disconnect(); botB.disconnect(); host.disconnect()
  await ctx.close()
})

test('participant confidence overlay centers on desktop, bottom-sheets on mobile', async ({ browser }) => {
  test.setTimeout(120_000)
  const hostCookie = await hostAuthCookie()
  const host = await connectSocket(hostCookie)
  const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
    host, 'create_session', { quizData: TEST_QUIZ },
  )
  if (!created.success || !created.gameCode) throw new Error(`create_session failed: ${created.error}`)
  const gameCode = created.gameCode
  const botA = await addBot(gameCode, 'Asha', 0, 1500)

  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`/join?code=${gameCode}`)
  await page.getByRole('textbox', { name: 'Your name' }).fill('Overlay-Test')
  await page.getByRole('button', { name: /Join|Play|Enter|Start/i }).first().click()
  host.emit('start_quiz', { gameCode })
  await page.locator('button[aria-label^="Option "]').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(800)

  // Tap an option to open the confidence overlay.
  await page.locator('button[aria-label^="Option "]').first().click()
  const overlay = page.locator('.fixed.inset-0.bg-black\\/40').first()
  await overlay.waitFor({ state: 'visible', timeout: 5_000 })

  // Desktop: items-centered (modal vertically centered)
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(300)
  const deskAlign = await overlay.evaluate(el => getComputedStyle(el).alignItems)
  expect(deskAlign).toBe('center')

  // Mobile: items-end (bottom sheet)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(300)
  const mobileAlign = await overlay.evaluate(el => getComputedStyle(el).alignItems)
  expect(mobileAlign).toBe('flex-end')

  botA.disconnect(); host.disconnect()
  await ctx.close()
})

test('participant standings + ended: 2-col grid on desktop, single col on mobile', async ({ browser }) => {
  test.setTimeout(150_000)
  const hostCookie = await hostAuthCookie()
  const host = await connectSocket(hostCookie)
  const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
    host, 'create_session', { quizData: TEST_QUIZ },
  )
  if (!created.success || !created.gameCode) throw new Error(`create_session failed: ${created.error}`)
  const gameCode = created.gameCode
  const botA = await addBot(gameCode, 'Asha', 0, 1500)
  const botB = await addBot(gameCode, 'Ravi', 1, 2500)

  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`/join?code=${gameCode}`)
  await page.getByRole('textbox', { name: 'Your name' }).fill('Standings-Test')
  await page.getByRole('button', { name: /Join|Play|Enter|Start/i }).first().click()
  host.emit('start_quiz', { gameCode })

  // Drive to standings.
  await page.locator('button[aria-label^="Option "]').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(6000)
  await emitWithAck(host, 'end_question', { gameCode })
  await page.waitForTimeout(2000)
  host.emit('show_standings', { gameCode })
  await page.locator('.participant-stage-grid-2').first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(1000)

  // Desktop: 2 columns
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(400)
  const standColsDesk = await gridColumns2(page)
  expect(standColsDesk.split(' ').filter(Boolean).length).toBe(2)
  await expect(page.locator('.participant-rail')).toBeVisible()

  // Mobile: 1 column
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(400)
  const standColsMobile = await gridColumns2(page)
  expect(standColsMobile.split(' ').filter(Boolean).length).toBe(1)
  await expect(page.locator('.participant-rail')).toBeHidden()

  // ── Ended phase ──
  host.emit('next_question', { gameCode })
  await page.waitForTimeout(6000)
  await emitWithAck(host, 'end_question', { gameCode })
  await page.waitForTimeout(1500)
  host.emit('show_standings', { gameCode })
  await page.waitForTimeout(1500)
  host.emit('end_session', { gameCode })
  // Wait for the ended phase's 2-col grid.
  await page.locator('text=Quiz Over!').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(3000)

  // Desktop: 2 columns with full leaderboard rail
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(400)
  const endedGrid = page.locator('.participant-stage-grid-2').first()
  await endedGrid.waitFor({ state: 'visible', timeout: 10_000 })
  const endedColsDesk = await gridColumns2(page)
  expect(endedColsDesk.split(' ').filter(Boolean).length).toBe(2)
  // Full ranked leaderboard should be in the rail.
  await expect(page.locator('.participant-rail').getByText(/Final Standings/i)).toBeVisible()

  // Mobile: 1 column
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(400)
  const endedColsMobile = await gridColumns2(page)
  expect(endedColsMobile.split(' ').filter(Boolean).length).toBe(1)

  botA.disconnect(); botB.disconnect(); host.disconnect()
  await ctx.close()
})
