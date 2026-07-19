// Participant desktop/tablet visual audit (July 2026 desktop layout stream).
// Drives a REAL socket session (host socket emits create_session → start_quiz
// → end_question → show_standings → next_question → end_session) with two
// answering socket bots, while a REAL participant browser joins via
// /join?code=XXX and is screenshotted at each phase × each viewport width
// (375 / 768 / 1024 / 1280 / 1536) to verify:
//   - desktop HUD rails (PlayerHUD left, StageRail right) appear at lg (1024+)
//   - MCQ 2×2 quadrant grid at lg for ≤4 options
//   - fluid clamp() question text
//   - centered confidence modal on desktop (bottom sheet on mobile)
//   - centered reveal, standings 2-col, ended 2-col with full leaderboard rail
//   - mobile (375) is the regression baseline — must look unchanged
//
// We can't use the ?preview=host-stage trick (that's a static host preview
// that doesn't broadcast to real participants), so the host is driven purely
// over sockets like the protocol tests, and only the participant is a browser.
//
// Screenshots land in SHOT_DIR (default /tmp/quizotic-shots-desktop).

import { test } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'
import { mkdirSync } from 'fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const SHOTS = process.env.SHOT_DIR || '/tmp/quizotic-shots-desktop'

// Viewport widths to sweep. 375 = phone baseline (must be unchanged),
// 768 = tablet, 1024 = desktop lg breakpoint (rails appear),
// 1280/1536 = wide desktop.
const WIDTHS = [375, 768, 1024, 1280, 1536]

// A 3-question competitive quiz with mixed option counts so we see both the
// 2×2 quadrant grid (4 options) and the vertical stack. Shape mirrors the
// server's CreateSessionSchema (server.mjs:1013).
const TEST_QUIZ = {
  title: 'Desktop Layout Visual Audit',
  subject: 'e2e',
  language: 'en',
  questions: [
    {
      id: 'q1', type: 'mcq',
      text: 'Which regulatory body oversees the Indian securities and stock market and protects investor interests across exchanges?',
      options: [
        'Securities and Exchange Board of India (SEBI)',
        'Reserve Bank of India (RBI)',
        'Ministry of Finance, Government of India',
        'Planning Commission of India and NITI Aayog jointly oversee market regulation',
      ],
      correctAnswer: '0',
      timerSeconds: 30, points: 1000,
    },
    {
      id: 'q2', type: 'mcq',
      text: 'Which planet in our solar system has the most moons?',
      options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
      correctAnswer: '1',
      timerSeconds: 30, points: 1000,
    },
    {
      id: 'q3', type: 'truefalse',
      text: 'The Great Wall of China is visible from space with the naked eye.',
      options: ['True', 'False'],
      correctAnswer: '1',
      timerSeconds: 30, points: 1000,
    },
  ],
}

function connectSocket(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
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

// A socket bot that joins and auto-answers each question_show after the
// get-ready countdown. Different bots pick different options so the leaderboard
// has movement (some correct, some wrong).
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

test('participant desktop/tablet visual audit across breakpoints', async ({ browser }) => {
  test.setTimeout(240_000)
  mkdirSync(SHOTS, { recursive: true })

  // ── Host socket (authed) ──
  const hostCookie = await hostAuthCookie()
  const host = await connectSocket(hostCookie)
  const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
    host, 'create_session', { quizData: TEST_QUIZ },
  )
  if (!created.success || !created.gameCode) throw new Error(`create_session failed: ${created.error}`)
  const gameCode = created.gameCode

  // ── Two answering bots (Asha correct on all, Ravi wrong on all → clear rank gap) ──
  const botA = await addBot(gameCode, 'Asha Bot', 0, 1500)
  const botB = await addBot(gameCode, 'Ravi Bot', 1, 2500)
  // A couple more bots to fill out the leaderboard rail nicely.
  const botC = await addBot(gameCode, 'Meera Bot', 0, 3500)
  const botD = await addBot(gameCode, 'Kabir Bot', 1, 4000)

  // ── Real participant browser ──
  const partCtx = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const participant = await partCtx.newPage()
  await participant.goto(`/join?code=${gameCode}`)
  await participant.getByRole('textbox', { name: 'Your name' }).fill('You-Desktop')
  await participant.getByRole('button', { name: /Join|Play|Enter|Start/i }).first().click()

  // ── Start the quiz (host socket) ──
  host.emit('start_quiz', { gameCode })

  // Screenshot helper — resize in place across all widths.
  const shot = async (prefix: string) => {
    for (const w of WIDTHS) {
      await participant.setViewportSize({ width: w, height: 900 })
      await participant.waitForTimeout(600) // reflow + rails mount/unmount
      await participant.screenshot({ path: `${SHOTS}/${prefix}-${w}.png`, fullPage: true })
    }
  }

  // ── PHASE 1: question (wait for question_show to reach the participant) ──
  // The participant renders the question card once it gets the socket event.
  await participant.waitForTimeout(5000) // get-ready countdown + render
  // Tap an option to surface the confidence overlay — screenshot that too.
  const optBtn = participant.locator('button[aria-label^="Option "]').first()
  await optBtn.waitFor({ state: 'visible', timeout: 15_000 })
  // First screenshot the unanswered question state at all widths.
  await shot('01-question')
  // Now tap + screenshot the confidence overlay.
  await participant.setViewportSize({ width: 1024, height: 900 })
  await optBtn.click()
  await participant.waitForTimeout(600)
  for (const w of WIDTHS) {
    await participant.setViewportSize({ width: w, height: 900 })
    await participant.waitForTimeout(400)
    await participant.screenshot({ path: `${SHOTS}/02-confidence-${w}.png`, fullPage: true })
  }
  // Confirm with "Sure" to lock in the participant's answer.
  const sureBtn = participant.getByRole('button', { name: /^Sure$/ })
  if (await sureBtn.isVisible().catch(() => false)) await sureBtn.click()

  // ── PHASE 2: answered/reveal (host ends the question) ──
  await participant.waitForTimeout(2000) // bots finish answering
  await emitWithAck(host, 'end_question', { gameCode })
  await participant.waitForTimeout(2500) // reveal + score-fly-up + ResultBeat
  await shot('03-answered-revealed')

  // ── PHASE 3: standings (host shows standings) ──
  host.emit('show_standings', { gameCode })
  await participant.waitForTimeout(2000)
  await shot('04-standings')

  // Advance through remaining questions to the end.
  for (let qi = 1; qi < TEST_QUIZ.questions.length; qi++) {
    host.emit('next_question', { gameCode })
    await participant.waitForTimeout(6000) // next question_show + bots answer
    await emitWithAck(host, 'end_question', { gameCode })
    await participant.waitForTimeout(1500)
    host.emit('show_standings', { gameCode })
    await participant.waitForTimeout(1500)
  }

  // ── PHASE 4: ended/podium (host ends the session) ──
  host.emit('end_session', { gameCode })
  await participant.waitForTimeout(8000) // podium reveal + confetti sequence
  await shot('05-ended-podium')

  botA.disconnect(); botB.disconnect(); botC.disconnect(); botD.disconnect()
  host.disconnect()
  await partCtx.close()
})
