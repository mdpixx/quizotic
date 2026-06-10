// Critical-path live-quiz contract test. Drives the Socket.IO protocol
// directly with two Node clients (host + participant) — the exact layer
// where the 2026-05-01 regression lived (`SubmitAnswerSchema` rejecting
// floats from `getServerNow()`).
//
// Why Socket.IO clients instead of real browsers:
//   • Today's bug class is server-side schema / scoring / broadcast logic.
//     A real browser is overkill — every relevant codepath is exercised
//     by raw socket frames.
//   • Browser E2E is fragile against Turbopack CSP/eval quirks in dev
//     mode and slow against production builds. This test runs in seconds.
//   • The test deliberately replicates the failure-mode payload (float
//     serverSubmittedAt) so any future schema constraint that rejects
//     real production traffic fails the gate immediately.
//
// What it asserts (any of these blocks the deploy):
//   1. Host can create a session.
//   2. Participant can join.
//   3. Submit_answer with a FLOAT serverSubmittedAt is ACCEPTED, not
//      silently rejected. (THE bug from 2026-05-01.)
//   4. Host receives `answer_received` with count=1.
//   5. Participant receives `answer_confirmed` with isCorrect=true.

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

const TEST_QUIZ = {
  title: 'E2E Smoke',
  questions: [
    {
      id: 'q1',
      type: 'mcq',
      text: 'E2E: pick option B',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: '1', // index 1 = Option B
      timerSeconds: 20,
      points: 1000,
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

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event ${event} did not arrive within ${timeoutMs}ms — answer was silently dropped`)), timeoutMs)
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload) })
  })
}

test.describe('Live quiz — answer capture critical path', () => {
  test('host counter moves and participant gets feedback after submit', async () => {
    const host = await connectSocket(await hostAuthCookie())
    const participant = await connectSocket()

    try {
      // 1. Host creates session.
      const created = await emitWithAck<{ success: boolean; gameCode?: string; error?: string }>(
        host,
        'create_session',
        { quizData: TEST_QUIZ },
      )
      expect(created.success).toBe(true)
      expect(created.gameCode).toMatch(/^\d{6}$/)
      const gameCode = created.gameCode!

      // 2. Participant joins. The host should observe `participant_joined`.
      const hostSawJoin = waitForEvent<{ count: number }>(host, 'participant_joined', 5_000)
      const joined = await emitWithAck<{ success: boolean; status?: string; participantId?: string }>(
        participant,
        'join_session',
        { gameCode, displayName: 'E2E Player' },
      )
      expect(joined.success).toBe(true)
      expect(joined.participantId).toBeTruthy()
      const participantId = joined.participantId!
      await hostSawJoin

      // 3. Host starts the quiz; participant receives question_show.
      const questionShown = waitForEvent<{ index: number; startAt?: number }>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      const q = await questionShown
      expect(q.index).toBe(0)

      // Wait the 3.5s server countdown so submission isn't a "fired during
      // get-ready" edge case (also the realistic player flow).
      await new Promise(r => setTimeout(r, 4_000))

      // 4. Build the exact failure-mode payload: serverSubmittedAt is a
      //    fractional ms value (this is what real browsers send because
      //    clock-sync state.offsetMs is averaged → fractional). The server
      //    must accept this; any future schema constraint that rejects
      //    floats fails this assertion BEFORE the change reaches prod.
      const fractionalServerSubmittedAt = Date.now() + 0.5
      const ackPromise = emitWithAck<{ accepted: boolean; reason?: string; isCorrect?: boolean }>(
        participant,
        'submit_answer',
        {
          gameCode,
          participantId,
          answer: 1, // index 1 = correct (Option B)
          timeMs: 3_000,
          confidence: 'sure',
          serverSubmittedAt: fractionalServerSubmittedAt,
        },
        5_000,
      )

      // 5. Host must receive answer_received with count=1 (the smoking-gun
      //    assertion — silent rejects manifest as this event never firing).
      const answerReceived = waitForEvent<{ count: number; total: number }>(host, 'answer_received', 8_000)

      const ack = await ackPromise
      if (!ack.accepted) {
        throw new Error(
          `submit_answer was rejected (reason=${ack.reason}). This is the 2026-05-01 bug class — the server is silently dropping submissions. Check schema constraints, scoring guards, and clock-skew logic.`
        )
      }
      expect(ack.accepted).toBe(true)
      expect(ack.isCorrect).toBe(true)

      const recv = await answerReceived
      expect(recv.count).toBe(1)
    } finally {
      host.disconnect()
      participant.disconnect()
    }
  })

  test('past-the-buzzer answer is recorded with late: true (not silently dropped)', async () => {
    // Regression test for the OTHER half of the 2026-05-01 fix: the late
    // branch used to early-return before storing the answer or broadcasting
    // to the host. Now it persists with points=0 and emits answer_received.
    const host = await connectSocket(await hostAuthCookie())
    const participant = await connectSocket()
    try {
      const created = await emitWithAck<{ success: boolean; gameCode?: string }>(
        host, 'create_session',
        { quizData: { ...TEST_QUIZ, questions: [{ ...TEST_QUIZ.questions[0], timerSeconds: 5 }] } },
      )
      const gameCode = created.gameCode!

      const hostSawJoin = waitForEvent<unknown>(host, 'participant_joined', 5_000)
      const joined = await emitWithAck<{ success: boolean; participantId?: string }>(
        participant, 'join_session',
        { gameCode, displayName: 'Late Player' },
      )
      const participantId = joined.participantId!
      await hostSawJoin

      const questionShown = waitForEvent<unknown>(participant, 'question_show', 5_000)
      host.emit('start_quiz', { gameCode })
      await questionShown

      // Wait past the 5s timer + 2s grace + countdown — guaranteed late.
      await new Promise(r => setTimeout(r, 11_500))

      const answerReceived = waitForEvent<{ count: number }>(host, 'answer_received', 5_000)
      const ack = await emitWithAck<{ accepted: boolean; late?: boolean }>(
        participant, 'submit_answer',
        { gameCode, participantId, answer: 1, timeMs: 11_000, confidence: 'sure', serverSubmittedAt: Date.now() + 0.25 },
        5_000,
      )
      expect(ack.accepted).toBe(true)
      expect(ack.late).toBe(true)
      const recv = await answerReceived
      expect(recv.count).toBe(1)
    } finally {
      host.disconnect()
      participant.disconnect()
    }
  })
})
