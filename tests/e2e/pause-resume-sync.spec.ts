// Pause/resume timer-sync contract (2026-07 fix).
//
// Bug: quiz_paused carried no payload and quiz_resumed carried only
// remainingMs, so every client anchored its countdown to ITS OWN event
// arrival moment. Host and participant receive the events at different wall
// times (click uplink + differing downlinks), so their deadlines diverged by
// the delivery gap — permanently, compounding with every pause/play cycle.
// The +500ms paint-grace (and any leftover 3-2-1 intro) also leaked into
// remainingMs, inflating the displayed time each cycle.
//
// Contract under test:
//   - quiz_paused  → { remainingMs } display-true frozen remaining
//                    (grace excluded, clamped to the question timer)
//   - quiz_resumed → { remainingMs, endsAt } where endsAt is the ABSOLUTE
//                    display deadline in server wall-clock (same clock as
//                    question_show's startAt), so late delivery self-corrects
//   - timer_adjusted (running) → also carries endsAt

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

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

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event ${event} did not arrive within ${timeoutMs}ms`)), timeoutMs)
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload) })
  })
}

const TIMER_SECONDS = 30

const QUIZ = {
  title: 'Pause Sync E2E',
  questions: [{
    id: 'q1', type: 'mcq', text: 'Pick A',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: '0',
    timerSeconds: TIMER_SECONDS, points: 1000,
  }],
}

test.describe('Pause/resume timer sync contract', () => {
  test('pause carries frozen remaining; resume carries absolute endsAt', async () => {
    const host = await connectSocket(await hostAuthCookie())
    const participant = await connectSocket()
    try {
      const created = await emitWithAck<{ success: boolean; gameCode?: string }>(host, 'create_session', { quizData: QUIZ })
      const gameCode = created.gameCode!
      const hostSawJoin = waitForEvent<unknown>(host, 'participant_joined', 5_000)
      await emitWithAck<{ success: boolean }>(participant, 'join_session', { gameCode, displayName: 'Sync Checker' })
      await hostSawJoin

      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown
      // Get past the 3.5s intro so the question clock is genuinely running.
      await new Promise(r => setTimeout(r, 5_500))

      // ── Pause: both host and participant must receive the frozen remaining ──
      const pausedOnParticipant = waitForEvent<{ remainingMs?: number }>(participant, 'quiz_paused', 5_000)
      const pauseAt = Date.now()
      host.emit('pause_quiz', { gameCode })
      const paused = await pausedOnParticipant
      expect(typeof paused.remainingMs).toBe('number')
      // ~2s elapsed on a 30s timer → remaining must be display-true:
      // below the full timer (grace excluded) and near timer - elapsed.
      expect(paused.remainingMs!).toBeGreaterThan((TIMER_SECONDS - 6) * 1000)
      expect(paused.remainingMs!).toBeLessThanOrEqual(TIMER_SECONDS * 1000)

      // Hold the pause so arrival-anchored clients would drift 2s.
      await new Promise(r => setTimeout(r, 2_000))

      // ── Resume: absolute deadline in server clock, not arrival-relative ──
      const resumedOnParticipant = waitForEvent<{ remainingMs?: number; endsAt?: number }>(participant, 'quiz_resumed', 5_000)
      host.emit('resume_quiz', { gameCode })
      const resumed = await resumedOnParticipant
      const resumeArrival = Date.now()

      // remainingMs must equal the paused snapshot — no time may elapse
      // while paused (tolerance covers emit/delivery jitter).
      expect(typeof resumed.remainingMs).toBe('number')
      expect(Math.abs(resumed.remainingMs! - paused.remainingMs!)).toBeLessThan(500)

      // endsAt is the absolute display deadline (server wall-clock ≈ local
      // clock in this test). It must sit ~remainingMs ahead of now.
      expect(typeof resumed.endsAt).toBe('number')
      const impliedRemaining = resumed.endsAt! - resumeArrival
      expect(Math.abs(impliedRemaining - resumed.remainingMs!)).toBeLessThan(1_500)
      // And the pause must have actually stopped the clock: the deadline is
      // ~pause-duration LATER than it would have been without the pause.
      const unpausedDeadline = pauseAt + paused.remainingMs!
      expect(resumed.endsAt! - unpausedDeadline).toBeGreaterThan(1_000)

      // ── Extend while running: same absolute-anchor contract ──
      const adjustedOnParticipant = waitForEvent<{ remainingMs?: number; endsAt?: number }>(participant, 'timer_adjusted', 5_000)
      const adjustAck = await emitWithAck<{ success: boolean }>(host, 'adjust_timer', { gameCode, action: 'extend', seconds: 15 })
      expect(adjustAck.success).toBe(true)
      const adjusted = await adjustedOnParticipant
      expect(typeof adjusted.endsAt).toBe('number')
      const adjustArrival = Date.now()
      expect(Math.abs((adjusted.endsAt! - adjustArrival) - adjusted.remainingMs!)).toBeLessThan(1_500)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('pause during the 3-2-1 intro clamps remaining to the question timer', async () => {
    const host = await connectSocket(await hostAuthCookie())
    const participant = await connectSocket()
    try {
      const created = await emitWithAck<{ success: boolean; gameCode?: string }>(host, 'create_session', { quizData: QUIZ })
      const gameCode = created.gameCode!
      const hostSawJoin = waitForEvent<unknown>(host, 'participant_joined', 5_000)
      await emitWithAck<{ success: boolean }>(participant, 'join_session', { gameCode, displayName: 'Intro Pauser' })
      await hostSawJoin

      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown

      // Pause immediately — still inside the get-ready window, where the raw
      // internal remaining includes leftover intro + grace. The display value
      // must never exceed the question timer (clients show the full timer
      // during the intro).
      const pausedOnParticipant = waitForEvent<{ remainingMs?: number }>(participant, 'quiz_paused', 5_000)
      host.emit('pause_quiz', { gameCode })
      const paused = await pausedOnParticipant
      expect(typeof paused.remainingMs).toBe('number')
      expect(paused.remainingMs!).toBeLessThanOrEqual(TIMER_SECONDS * 1000)
      expect(paused.remainingMs!).toBeGreaterThan((TIMER_SECONDS - 2) * 1000)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})
