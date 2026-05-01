// Regression tests for the GPT 5.5 review (2026-05-01). Each test
// exercises one of the bug classes that previously shipped to production.
// Add to this file whenever a real prod incident reveals a new gap — the
// test name should describe the failure mode, not the fix.

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, { transports: ['websocket'], reconnection: false, forceNew: true })
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

test.describe('Regressions — quiz', () => {
  test('multiselect: correctAnswers MUST NOT leak in question_show payload (security)', async () => {
    // The 2026-05-01 review found sanitizeQuestion stripped only `correctAnswer`,
    // not `correctAnswers` — so multiselect's full answer set was broadcast
    // to every participant. Anyone with dev-tools could win.
    const host = await connect()
    const participant = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'Multiselect leak test',
          questions: [{
            id: 'm1',
            type: 'multiselect',
            text: 'Pick the two prime numbers',
            options: ['4', '6', '7', '11'],
            correctAnswers: ['2', '3'], // MUST NOT leak
            timerSeconds: 20,
            points: 1000,
          }],
        },
      })
      const gameCode = created.gameCode!

      const hostSawJoin = waitFor<unknown>(host, 'participant_joined')
      await emit<{ success: boolean }>(participant, 'join_session', { gameCode, displayName: 'Spy' })
      await hostSawJoin

      const questionShown = waitFor<{ question: Record<string, unknown> }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      const { question } = await questionShown

      expect(question).not.toHaveProperty('correctAnswer')
      expect(question).not.toHaveProperty('correctAnswers')
      // Type field must still be there so the client renders correctly.
      expect(question.type).toBe('multiselect')
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('multiselect: host bars must reflect array answers (countAnswersByOption)', async () => {
    // The 2026-05-01 review found `Number(['0','2'])` returns NaN, so
    // multiselect option distribution showed [0,0,0,0] forever even when
    // every participant answered correctly.
    const host = await connect()
    const p1 = await connect()
    const p2 = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'Multiselect bars test',
          questions: [{
            id: 'm1', type: 'multiselect', text: 'Pick A and C',
            options: ['A', 'B', 'C', 'D'],
            correctAnswers: ['0', '2'],
            timerSeconds: 20, points: 1000,
          }],
        },
      })
      const gameCode = created.gameCode!

      const join1 = await emit<{ participantId?: string }>(p1, 'join_session', { gameCode, displayName: 'P1' })
      const join2 = await emit<{ participantId?: string }>(p2, 'join_session', { gameCode, displayName: 'P2' })

      const q1 = waitFor<unknown>(p1, 'question_show')
      const q2 = waitFor<unknown>(p2, 'question_show')
      host.emit('start_quiz', { gameCode })
      await Promise.all([q1, q2])
      await new Promise(r => setTimeout(r, 4000)) // 3.5s countdown

      // Both submit ['0', '2'] — the correct multi-pick.
      const lastReceived = waitFor<{ count: number; optionCounts: number[] }>(host, 'answer_received')
      // Track AT LEAST one answer_received — we only need to validate the
      // final shape; the host emits one per submission so capturing the
      // first is enough.
      const _firstReceived = await Promise.resolve()
      void _firstReceived

      await emit<{ accepted: boolean }>(p1, 'submit_answer', {
        gameCode, participantId: join1.participantId,
        answer: ['0', '2'], timeMs: 1000, confidence: 'sure', serverSubmittedAt: Date.now() + 0.1,
      })
      const final = await lastReceived
      expect(final.optionCounts).toBeDefined()
      // After P1's vote, options A (0) and C (2) should each have 1 tick.
      expect(final.optionCounts[0]).toBe(1)
      expect(final.optionCounts[2]).toBe(1)
      expect(final.optionCounts[1]).toBe(0)
      expect(final.optionCounts[3]).toBe(0)

      // Now P2 votes the same way → A and C should each show 2.
      const after2 = waitFor<{ optionCounts: number[] }>(host, 'answer_received')
      await emit<{ accepted: boolean }>(p2, 'submit_answer', {
        gameCode, participantId: join2.participantId,
        answer: ['0', '2'], timeMs: 1000, confidence: 'sure', serverSubmittedAt: Date.now() + 0.1,
      })
      const f2 = await after2
      expect(f2.optionCounts[0]).toBe(2)
      expect(f2.optionCounts[2]).toBe(2)
    } finally {
      host.disconnect(); p1.disconnect(); p2.disconnect()
    }
  })

  test('drawing: host answer_received uses `count` field (not `answered`)', async () => {
    // The 2026-05-01 review found server emitted `answered:` but host
    // listener destructures `count`, so drawing host counter showed
    // `undefined / N answered`.
    const host = await connect()
    const participant = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'Drawing field test',
          questions: [{
            id: 'd1', type: 'drawing', text: 'Sketch a house',
            timerSeconds: 30, points: 0,
          }],
        },
      })
      const gameCode = created.gameCode!

      const join = await emit<{ participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'Drawer' })
      const qShown = waitFor<unknown>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      await qShown
      await new Promise(r => setTimeout(r, 4000))

      const ar = waitFor<{ count?: number; answered?: number }>(host, 'answer_received')
      participant.emit('submit_drawing', {
        gameCode,
        participantId: join.participantId,
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=', // tiny valid PNG header
      })
      const payload = await ar
      expect(payload.count).toBe(1)
      // The legacy `answered` field should be absent — keep payload tight.
      expect(payload.answered).toBeUndefined()
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})

test.describe('Regressions — presentation', () => {
  // Helper: create a presenter session via Socket.IO. Mirrors how the
  // host UI does it for live presentations.
  async function createPresenterSession(slides: unknown[]): Promise<{ host: Socket; gameCode: string }> {
    const host = await connect()
    const created = await emit<{ success: boolean; gameCode?: string; error?: string }>(host, 'create_presenter_session', {
      presentationData: { title: 'E2E Regression', slides },
    })
    if (!created.success || !created.gameCode) {
      host.disconnect()
      throw new Error(`create_presenter_session failed: ${created.error}`)
    }
    return { host, gameCode: created.gameCode }
  }

  test('presentation ranking: aggregate stores full orderings (not Number(array))', async () => {
    // The 2026-05-01 review found server did `Number(response)` for ranking,
    // turning [0,1,2] into NaN — aggregate never accumulated. Now the
    // server stores the full ordering in `agg.rankings`.
    const slide = { type: 'ranking', question: 'Rank these', items: ['Apple', 'Banana', 'Cherry'], responseMode: 'instant' }
    const { host, gameCode } = await createPresenterSession([slide])
    const participant = await connect()
    try {
      const join = await emit<{ success: boolean; participantId?: string }>(participant, 'join_presenter_session', {
        gameCode, displayName: 'Voter',
      })
      // Wait for presenter_aggregate_updated (instant mode broadcasts on submit).
      const aggUpdated = waitFor<{ rankings?: number[][]; counts?: number[] }>(participant, 'presenter_aggregate_updated')
      await emit<{ accepted: boolean }>(participant, 'submit_presenter_response', {
        gameCode,
        participantId: join.participantId,
        slideIndex: 0,
        response: [2, 0, 1], // Cherry, Apple, Banana
      })
      const agg = await aggUpdated
      expect(Array.isArray(agg.rankings)).toBe(true)
      expect(agg.rankings!.length).toBe(1)
      expect(agg.rankings![0]).toEqual([2, 0, 1])
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('presentation open_text: stores full strings (not lowercased into words bucket)', async () => {
    // The 2026-05-01 review found open_text was lowercased + bucketed into
    // `agg.words` and rendered as a word cloud — destroying the "text wall"
    // experience the builder previewed. Now server stores into `agg.responses`.
    const slide = { type: 'open_text', question: 'In one sentence', maxChars: 200, responseMode: 'instant' }
    const { host, gameCode } = await createPresenterSession([slide])
    const participant = await connect()
    try {
      const join = await emit<{ success: boolean; participantId?: string }>(participant, 'join_presenter_session', {
        gameCode, displayName: 'Writer',
      })
      const aggUpdated = waitFor<{ responses?: string[]; words?: Record<string, number> }>(participant, 'presenter_aggregate_updated')
      await emit<{ accepted: boolean }>(participant, 'submit_presenter_response', {
        gameCode,
        participantId: join.participantId,
        slideIndex: 0,
        response: 'Innovation requires Bold Bets', // mixed case + multiple words
      })
      const agg = await aggUpdated
      expect(Array.isArray(agg.responses)).toBe(true)
      expect(agg.responses).toContain('Innovation requires Bold Bets')
      // Old words bucket should NOT have been used for open_text.
      // (`words` may be {} from initialization but must not contain our text.)
      expect(agg.words?.['innovation requires bold bets']).toBeUndefined()
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})
