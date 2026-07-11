// Protocol contract tests for the 2026-07 quiz-options review fixes.
// Drives the Socket.IO layer directly (same approach as live-quiz-flow.spec.ts):
//
//   1. A tap arriving during the 3-2-1 countdown is REJECTED (not_started) —
//      it used to score at serverTimeMs=0 (maximum speed bonus).
//   2. An answer stamped with a stale questionIndex is REJECTED
//      (stale_question) — it used to be booked against the current question.
//   3. An answer after the host manually ends the question is recorded as
//      LATE (0 points, late:true) — it used to score full points after the
//      reveal.
//   4. question_ended carries the full multiselect correctAnswers array and
//      the matching answer-key pairs — participants used to get nothing to
//      render for these types.
//   5. Scored sequence ranking: answer_confirmed is NEUTRAL (no correctness
//      leak before the reveal), question_ended carries correctOrderTexts,
//      and a late joiner's catch-up question_show replays the SAME shuffled
//      option order the room saw (it used to send the unshuffled original,
//      mis-scoring every reconnecting player).

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

type SessionHandles = { host: Socket; participant: Socket; gameCode: string; participantId: string }

async function createSessionWithPlayer(quizData: unknown, playerName = 'Window Player'): Promise<SessionHandles> {
  const host = await connectSocket(await hostAuthCookie())
  const participant = await connectSocket()
  const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
    host, 'create_session', { quizData },
  )
  if (!created.success || !created.gameCode) throw new Error(`create_session failed: ${created.error}`)
  const gameCode = created.gameCode
  const hostSawJoin = waitForEvent<unknown>(host, 'participant_joined', 5_000)
  const joined = await emitWithAck<{ success: boolean; participantId?: string }>(
    participant, 'join_session', { gameCode, displayName: playerName },
  )
  if (!joined.success || !joined.participantId) throw new Error('join_session failed')
  await hostSawJoin
  return { host, participant, gameCode, participantId: joined.participantId }
}

function mcqQuiz(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Window E2E',
    questions: [{
      id: 'q1',
      type: 'mcq',
      text: 'Pick B',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: '1',
      timerSeconds: 20,
      points: 1000,
      ...overrides,
    }],
  }
}

test.describe('Answer window enforcement', () => {
  test('tap during the 3-2-1 countdown is rejected as not_started', async () => {
    const { host, participant, gameCode, participantId } = await createSessionWithPlayer(mcqQuiz())
    try {
      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown

      // Fire immediately — we are inside the 3.5s get-ready window.
      const ack = await emitWithAck<{ accepted: boolean; reason?: string }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: '1', timeMs: 0, confidence: null, questionIndex: 0 },
      )
      expect(ack.accepted).toBe(false)
      expect(ack.reason).toBe('not_started')

      // The player is NOT locked out: the same answer after the countdown lands.
      await new Promise(r => setTimeout(r, 4_000))
      const retry = await emitWithAck<{ accepted: boolean; reason?: string }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: '1', timeMs: 500, confidence: null, questionIndex: 0 },
      )
      expect(retry.accepted).toBe(true)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('answer stamped with a stale questionIndex is rejected as stale_question', async () => {
    const { host, participant, gameCode, participantId } = await createSessionWithPlayer(mcqQuiz())
    try {
      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown
      await new Promise(r => setTimeout(r, 4_000))

      const ack = await emitWithAck<{ accepted: boolean; reason?: string; currentIndex?: number }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: '1', timeMs: 500, confidence: null, questionIndex: 5 },
      )
      expect(ack.accepted).toBe(false)
      expect(ack.reason).toBe('stale_question')
      expect(ack.currentIndex).toBe(0)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('answer after manual end_question is recorded as late (never scored)', async () => {
    const { host, participant, gameCode, participantId } = await createSessionWithPlayer(mcqQuiz())
    try {
      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown
      await new Promise(r => setTimeout(r, 4_000))

      // Host ends the question early — the reveal fires for everyone.
      const revealed = waitForEvent<unknown>(participant, 'question_ended', 5_000)
      host.emit('end_question', { gameCode })
      await revealed

      // The straggler's CORRECT answer is still recorded — but as late.
      const ack = await emitWithAck<{ accepted: boolean; late?: boolean }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: '1', timeMs: 2_000, confidence: null, questionIndex: 0 },
      )
      expect(ack.accepted).toBe(true)
      expect(ack.late).toBe(true)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})

test.describe('Reveal payloads', () => {
  test('multiselect question_ended carries the full correctAnswers array', async () => {
    const quiz = {
      title: 'Multi E2E',
      questions: [{
        id: 'q1', type: 'multiselect', text: 'Pick A and C',
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: ['0', '2'],
        timerSeconds: 20, points: 1000,
      }],
    }
    const { host, participant, gameCode } = await createSessionWithPlayer(quiz)
    try {
      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown
      await new Promise(r => setTimeout(r, 4_000))

      const revealed = waitForEvent<{ correctAnswer: unknown }>(participant, 'question_ended', 5_000)
      host.emit('end_question', { gameCode })
      const reveal = await revealed
      expect(reveal.correctAnswer).toEqual(['0', '2'])
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('matching question_ended carries the aligned matchPairs answer key', async () => {
    const pairs = [
      { left: 'India', right: 'New Delhi' },
      { left: 'Japan', right: 'Tokyo' },
      { left: 'France', right: 'Paris' },
    ]
    const quiz = {
      title: 'Match E2E',
      questions: [{
        id: 'q1', type: 'matching', text: 'Match capitals',
        matchPairs: pairs,
        timerSeconds: 20, points: 1000,
      }],
    }
    const { host, participant, gameCode } = await createSessionWithPlayer(quiz)
    try {
      // Sanity: the live question payload must NOT leak the aligned pairs.
      const questionShown = waitForEvent<{ question: { matchPairs?: unknown; matchLefts?: string[]; matchRights?: string[] } }>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      const q = await questionShown
      expect(q.question.matchPairs).toBeUndefined()
      expect(q.question.matchLefts).toEqual(pairs.map(p => p.left))
      await new Promise(r => setTimeout(r, 4_000))

      const revealed = waitForEvent<{ matchPairs: unknown }>(participant, 'question_ended', 5_000)
      host.emit('end_question', { gameCode })
      const reveal = await revealed
      expect(reveal.matchPairs).toEqual(pairs)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})

test.describe('Scored sequence ranking', () => {
  const rankingQuiz = {
    title: 'Ranking E2E',
    questions: [{
      id: 'q1', type: 'ranking', text: 'Order the planets from the sun',
      options: ['Mercury', 'Venus', 'Earth', 'Mars'],
      correctOrder: ['0', '1', '2', '3'],
      timerSeconds: 20, points: 1000,
    }],
  }

  test('neutral receipt on submit + correctOrderTexts at reveal', async () => {
    const { host, participant, gameCode, participantId } = await createSessionWithPlayer(rankingQuiz)
    try {
      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown
      await new Promise(r => setTimeout(r, 4_000))

      const confirmed = waitForEvent<Record<string, unknown>>(participant, 'answer_confirmed', 5_000)
      const ack = await emitWithAck<{ accepted: boolean; isNonScored?: boolean }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: ['0', '1', '2', '3'], timeMs: 1_000, confidence: null, questionIndex: 0 },
      )
      expect(ack.accepted).toBe(true)
      expect(ack.isNonScored).toBe(false)

      // The receipt must be neutral — correctness leaks let neighbours copy.
      const receipt = await confirmed
      expect(receipt.received).toBe(true)
      expect(receipt).not.toHaveProperty('isCorrect')
      expect(receipt).not.toHaveProperty('points')
      expect(receipt).not.toHaveProperty('correctPositions')

      const revealed = waitForEvent<{ correctOrderTexts: string[] | null }>(participant, 'question_ended', 5_000)
      host.emit('end_question', { gameCode })
      const reveal = await revealed
      expect(reveal.correctOrderTexts).toEqual(['Mercury', 'Venus', 'Earth', 'Mars'])
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('late joiner receives the SAME shuffled option order as the room', async () => {
    const { host, participant, gameCode } = await createSessionWithPlayer(rankingQuiz)
    const lateJoiner = await connectSocket()
    try {
      const questionShown = waitForEvent<{ question: { options: string[] } }>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      const first = await questionShown

      // Join mid-question — the catch-up emit must replay the same shuffle,
      // because scoring translates display slots through the shuffle map.
      const catchUp = waitForEvent<{ question: { options: string[] } }>(lateJoiner, 'question_show', 5_000)
      const joined = await emitWithAck<{ success: boolean }>(
        lateJoiner, 'join_session', { gameCode, displayName: 'Late Joiner' },
      )
      expect(joined.success).toBe(true)
      const second = await catchUp

      expect(second.question.options).toEqual(first.question.options)
    } finally {
      host.disconnect(); participant.disconnect(); lateJoiner.disconnect()
    }
  })
})
