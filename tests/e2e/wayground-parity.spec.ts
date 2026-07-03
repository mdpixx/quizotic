// Contract tests for the Wayground-parity host controls (2026-07-03):
// adjust_timer (extend/restart), goto_question (navigator), kick_participant,
// set_anonymous_mode, and the per-participant answer_received identity that
// drives the live roster panel. Socket-level, same harness as regressions.

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

function connect(cookie?: string): Promise<Socket> {
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

function emit<T>(s: Socket, ev: string, p: unknown, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${ev} ack timeout`)), timeoutMs)
    s.emit(ev, p, (res: T) => { clearTimeout(t); resolve(res) })
  })
}

function waitFor<T>(s: Socket, ev: string, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event ${ev} not received in ${timeoutMs}ms`)), timeoutMs)
    s.once(ev, (p: T) => { clearTimeout(t); resolve(p) })
  })
}

function mcq(id: string, text: string) {
  return {
    id,
    type: 'mcq',
    text,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: '1',
    timerSeconds: 5,
    points: 1000,
  }
}

test.describe('Wayground parity — host controls', () => {
  test('adjust_timer extend widens the late window and re-anchors participants', async () => {
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    const classmate = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: { title: 'Timer extend test', questions: [mcq('t1', 'Extend me')] },
      })
      const gameCode = created.gameCode!

      const joined = await emit<{ success: boolean; participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'Slowpoke' })
      // Second participant never answers, so the all-answered early-end can't
      // reveal before our late-window submission goes through.
      await emit<{ success: boolean }>(classmate, 'join_session', { gameCode, displayName: 'Statue' })

      const qShown = waitFor<{ startAt?: number }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      const { startAt } = await qShown

      // Extend by 15s shortly after start. Participant must get the re-anchor.
      const adjusted = waitFor<{ remainingMs: number; action: string }>(participant, 'timer_adjusted')
      const ack = await emit<{ success: boolean; remainingMs?: number }>(host, 'adjust_timer', { gameCode, action: 'extend', seconds: 15 })
      expect(ack.success).toBe(true)
      const adj = await adjusted
      expect(adj.action).toBe('extend')
      expect(adj.remainingMs).toBeGreaterThan(15_000)

      // Submit ~8s after the question went live — past the original 5s timer
      // plus 2s grace, inside the extended window. Without the extension this
      // is marked late (0 points); with it the answer must score normally.
      const wait = Math.max(0, (startAt ?? Date.now()) + 8_000 - Date.now())
      await new Promise(r => setTimeout(r, wait))
      const confirmed = await emit<{ accepted: boolean; late?: boolean }>(participant, 'submit_answer', {
        gameCode,
        participantId: joined.participantId,
        answer: 1,
        timeMs: 8_000,
      })
      expect(confirmed.accepted).toBe(true)
      expect(confirmed.late).toBeUndefined()
    } finally {
      host.disconnect(); participant.disconnect(); classmate.disconnect()
    }
  })

  test('goto_question jumps to unplayed questions and refuses replays', async () => {
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: { title: 'Navigator test', questions: [mcq('q0', 'Zero'), mcq('q1', 'One'), mcq('q2', 'Two')] },
      })
      const gameCode = created.gameCode!
      await emit<{ success: boolean }>(participant, 'join_session', { gameCode, displayName: 'Jumper' })

      const q0 = waitFor<{ index: number }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      expect((await q0).index).toBe(0)

      // Jump forward over Q1 straight to Q2 — participants must follow.
      const q2 = waitFor<{ index: number }>(participant, 'question_show', 10_000)
      const jumpAck = await emit<{ success: boolean; index?: number }>(host, 'goto_question', { gameCode, index: 2 })
      expect(jumpAck).toMatchObject({ success: true, index: 2 })
      expect((await q2).index).toBe(2)

      // Replaying a played question is refused (answers could never re-open).
      const replay = await emit<{ success: boolean; reason?: string }>(host, 'goto_question', { gameCode, index: 0 })
      expect(replay).toMatchObject({ success: false, reason: 'played' })
      const current = await emit<{ success: boolean; reason?: string }>(host, 'goto_question', { gameCode, index: 2 })
      expect(current).toMatchObject({ success: false, reason: 'current' })

      // The skipped Q1 is still available.
      const q1 = waitFor<{ index: number }>(participant, 'question_show', 10_000)
      const backAck = await emit<{ success: boolean }>(host, 'goto_question', { gameCode, index: 1 })
      expect(backAck.success).toBe(true)
      expect((await q1).index).toBe(1)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('kick_participant removes, notifies, and blocks the participantId from rejoining', async () => {
    const host = await connect(await hostAuthCookie())
    const troll = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: { title: 'Kick test', questions: [mcq('k0', 'Behave')] },
      })
      const gameCode = created.gameCode!
      const joined = await emit<{ success: boolean; participantId?: string }>(troll, 'join_session', { gameCode, displayName: 'Troll' })
      const pid = joined.participantId!

      const removed = waitFor<unknown>(troll, 'removed_by_host')
      const left = waitFor<{ participantId?: string }>(host, 'participant_left')
      const ack = await emit<{ success: boolean }>(host, 'kick_participant', { gameCode, participantId: pid })
      expect(ack.success).toBe(true)
      await removed
      expect((await left).participantId).toBe(pid)

      // Same durable identity can't come back.
      const rejoin = await emit<{ success: boolean; error?: string }>(troll, 'join_session', { gameCode, displayName: 'Troll', participantId: pid })
      expect(rejoin.success).toBe(false)
      expect(rejoin.error).toMatch(/removed/i)
    } finally {
      host.disconnect(); troll.disconnect()
    }
  })

  test('set_anonymous_mode swaps names live and notifies participants', async () => {
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: { title: 'Names toggle test', questions: [mcq('n0', 'Who am I')] },
      })
      const gameCode = created.gameCode!
      const joined = await emit<{ success: boolean; archetype?: string }>(participant, 'join_session', { gameCode, displayName: 'Mahesh Real Name' })

      const notified = waitFor<{ anonymous: boolean }>(participant, 'anonymous_mode_changed')
      const snapshot = waitFor<{ active: Array<{ name: string }> }>(host, 'session_state')
      const ack = await emit<{ success: boolean }>(host, 'set_anonymous_mode', { gameCode, anonymous: true })
      expect(ack.success).toBe(true)
      expect((await notified).anonymous).toBe(true)
      const snap = await snapshot
      expect(snap.active[0].name).toBe(joined.archetype)

      // And back: real names return.
      const snapshot2 = waitFor<{ active: Array<{ name: string }> }>(host, 'session_state')
      await emit<{ success: boolean }>(host, 'set_anonymous_mode', { gameCode, anonymous: false })
      expect((await snapshot2).active[0].name).toBe('Mahesh Real Name')
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('answer_received identifies the participant (live roster panel contract)', async () => {
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    const classmate = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: { title: 'Roster identity test', questions: [mcq('r0', 'Tick me')] },
      })
      const gameCode = created.gameCode!
      const joined = await emit<{ success: boolean; participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'Ticker' })
      await emit<{ success: boolean }>(classmate, 'join_session', { gameCode, displayName: 'Idle' })

      const qShown = waitFor<{ startAt?: number }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      const { startAt } = await qShown
      await new Promise(r => setTimeout(r, Math.max(0, (startAt ?? Date.now()) + 500 - Date.now())))

      const received = waitFor<{ count: number; participantId?: string | null; questionIndex?: number }>(host, 'answer_received')
      await emit<{ accepted: boolean }>(participant, 'submit_answer', {
        gameCode,
        participantId: joined.participantId,
        answer: 1,
        timeMs: 500,
      })
      const payload = await received
      expect(payload.count).toBe(1)
      expect(payload.participantId).toBe(joined.participantId)
      expect(payload.questionIndex).toBe(0)

      // Reveal carries the exact correct-count for the stats donut.
      const ended = waitFor<{ correctCount?: number | null }>(host, 'question_ended')
      await emit<{ success: boolean }>(host, 'end_question', { gameCode })
      expect((await ended).correctCount).toBe(1)
    } finally {
      host.disconnect(); participant.disconnect(); classmate.disconnect()
    }
  })
})
