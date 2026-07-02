// Regression tests for the GPT 5.5 review (2026-05-01). Each test
// exercises one of the bug classes that previously shipped to production.
// Add to this file whenever a real prod incident reveals a new gap — the
// test name should describe the failure mode, not the fix.

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

test.describe('Regressions — quiz', () => {
  test('scored answer confirmation must not reveal the correct answer before host reveal', async () => {
    // A participant who answers early may be sitting beside classmates who
    // have not answered yet, so answer data must stay hidden until the host
    // reveal (`end_question`). A second, silent participant keeps the
    // all-answered early-end from firing — with everyone answered the server
    // legitimately reveals immediately (Kahoot-style early end).
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    const classmate = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'No early answer reveal test',
          questions: [{
            id: 'mcq-no-leak',
            type: 'mcq',
            text: 'Which option is correct?',
            options: ['Distractor A', 'Correct B', 'Distractor C', 'Distractor D'],
            correctAnswer: '1',
            timerSeconds: 20,
            points: 1000,
          }],
        },
      })
      const gameCode = created.gameCode!

      const joined = await emit<{ success: boolean; participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'No Leak' })
      await emit<{ success: boolean }>(classmate, 'join_session', { gameCode, displayName: 'Still Thinking' })
      const qShown = waitFor<unknown>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      await qShown
      await new Promise(r => setTimeout(r, 4_000))

      let earlyRevealPayload: unknown = null
      participant.once('question_ended', payload => { earlyRevealPayload = payload })

      const answerReceived = waitFor<{ count: number }>(host, 'answer_received')
      const confirmed = await emit<{
        accepted: boolean
        correctAnswer?: unknown
        correctAnswers?: unknown
        correctOrder?: unknown
        explanation?: unknown
      }>(participant, 'submit_answer', {
        gameCode,
        participantId: joined.participantId,
        answer: 0,
        timeMs: 1_000,
        confidence: 'sure',
        serverSubmittedAt: Date.now() + 0.1,
      })

      expect(confirmed.accepted).toBe(true)
      // The ack must carry NO grading data at all — not even isCorrect.
      // Right/wrong feedback arrives via personal_result at host reveal.
      expect(confirmed).not.toHaveProperty('isCorrect')
      expect(confirmed).not.toHaveProperty('correctAnswer')
      expect(confirmed).not.toHaveProperty('correctAnswers')
      expect(confirmed).not.toHaveProperty('correctOrder')
      expect(confirmed).not.toHaveProperty('explanation')
      expect((await answerReceived).count).toBe(1)

      await new Promise(r => setTimeout(r, 300))
      expect(earlyRevealPayload).toBeNull()

      const reveal = waitFor<{ correctAnswer?: unknown; explanation?: string | null }>(participant, 'question_ended')
      const endAck = await emit<{ success: boolean; ended?: boolean; questionIndex?: number }>(host, 'end_question', { gameCode })
      expect(endAck).toMatchObject({ success: true, ended: true, questionIndex: 0 })
      const revealed = await reveal
      expect(revealed.correctAnswer).toBe('1')
    } finally {
      host.disconnect(); participant.disconnect(); classmate.disconnect()
    }
  })

  test('multiselect: correctAnswers MUST NOT leak in question_show payload (security)', async () => {
    // The 2026-05-01 review found sanitizeQuestion stripped only `correctAnswer`,
    // not `correctAnswers` — so multiselect's full answer set was broadcast
    // to every participant. Anyone with dev-tools could win.
    const host = await connect(await hostAuthCookie())
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
    const host = await connect(await hostAuthCookie())
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
    const host = await connect(await hostAuthCookie())
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

  test('ranking: host can advance as soon as all participants answered', async () => {
    // Real hosting regression from 2026-05-16: a 1/1 ranking question showed
    // all answers in, but the host had no safe next-question path until the
    // full timer reached zero. The host should be able to end the current
    // question with an ack, receive the reveal aggregate, then move on.
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'Ranking early advance test',
          questions: [
            {
              id: 'r1',
              type: 'ranking',
              text: 'Rank these leaders',
              options: ['A', 'B', 'C', 'D'],
              timerSeconds: 60,
              points: 1000,
            },
            {
              id: 'p1',
              type: 'poll',
              text: 'Ready for the next one?',
              options: ['Yes', 'No'],
              timerSeconds: 20,
              points: 1000,
            },
          ],
        },
      })
      const gameCode = created.gameCode!

      const joined = await emit<{ participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'Ranker' })
      const q1Shown = waitFor<{ index: number }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      expect((await q1Shown).index).toBe(0)
      await new Promise(r => setTimeout(r, 4_000))

      const answerReceived = waitFor<{ count: number }>(host, 'answer_received')
      await emit<{ accepted: boolean; isNonScored?: boolean }>(participant, 'submit_answer', {
        gameCode,
        participantId: joined.participantId,
        answer: [0, 1, 2, 3],
        timeMs: 1_000,
        confidence: 'sure',
        serverSubmittedAt: Date.now() + 0.1,
      })
      expect((await answerReceived).count).toBe(1)

      const ended = waitFor<{ isNonScored: boolean }>(host, 'question_ended')
      const reveal = waitFor<{ questionIndex: number; stat?: { totalResponses?: number } }>(host, 'question_reveal')
      const endAck = await emit<{ success: boolean; ended?: boolean; questionIndex?: number }>(host, 'end_question', { gameCode })
      expect(endAck).toMatchObject({ success: true, ended: true, questionIndex: 0 })
      expect((await ended).isNonScored).toBe(true)
      expect((await reveal).stat?.totalResponses).toBe(1)

      const q2Shown = waitFor<{ index: number }>(participant, 'question_show', 5_000)
      host.emit('next_question', { gameCode })
      expect((await q2Shown).index).toBe(1)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })

  test('sequence ranking: correct order is scored and reveal is competitive', async () => {
    // Regression for the ranking-builder bug class: when a ranking question has
    // a correctOrder it is a scored sequence question, not an engagement poll.
    // The participant receives shuffled display slots, submits that displayed
    // order, and the server must translate it back to original-option order.
    const host = await connect(await hostAuthCookie())
    const participant = await connect()
    const originalOptions = ['Highest', 'High', 'Medium', 'Low']
    const correctOrder = ['0', '1', '2', '3']
    try {
      const created = await emit<{ success: boolean; gameCode?: string }>(host, 'create_session', {
        quizData: {
          title: 'Sequence ranking scored test',
          questions: [{
            id: 'sr1',
            type: 'ranking',
            text: 'Arrange from highest to lowest',
            options: originalOptions,
            correctOrder,
            timerSeconds: 30,
            points: 1000,
          }],
        },
      })
      const gameCode = created.gameCode!

      const joined = await emit<{ participantId?: string }>(participant, 'join_session', { gameCode, displayName: 'Sequencer' })
      const qShown = waitFor<{ question: { options: string[]; isScored?: boolean; correctOrder?: string[] }; index: number }>(participant, 'question_show')
      host.emit('start_quiz', { gameCode })
      const shown = await qShown
      expect(shown.index).toBe(0)
      expect(shown.question.isScored).toBe(true)
      expect(shown.question.correctOrder).toBeUndefined()

      const displayedOptions = shown.question.options
      const displayedCorrectOrder = correctOrder.map(originalIdx => {
        const displayIdx = displayedOptions.indexOf(originalOptions[Number(originalIdx)])
        expect(displayIdx).toBeGreaterThanOrEqual(0)
        return displayIdx
      })

      await new Promise(r => setTimeout(r, 4_000))

      const confirmed = waitFor<{
        isCorrect: boolean
        points: number
        isNonScored: boolean
        correctPositions?: number
        totalPositions?: number
      }>(participant, 'answer_confirmed')
      const answerReceived = waitFor<{ count: number }>(host, 'answer_received')
      const rankingSubmission = waitFor<{ ranking: string[] | number[] }>(host, 'ranking_submission')

      const ack = await emit<{ accepted: boolean; isNonScored?: boolean }>(participant, 'submit_answer', {
        gameCode,
        participantId: joined.participantId,
        answer: displayedCorrectOrder,
        timeMs: 1_000,
        confidence: 'sure',
        serverSubmittedAt: Date.now() + 0.1,
      })
      expect(ack.accepted).toBe(true)
      expect(ack.isNonScored).toBe(false)
      expect((await answerReceived).count).toBe(1)
      expect((await rankingSubmission).ranking.map(String)).toEqual(correctOrder)

      const result = await confirmed
      expect(result.isNonScored).toBe(false)
      expect(result.isCorrect).toBe(true)
      expect(result.points).toBeGreaterThan(0)
      expect(result.correctPositions).toBe(correctOrder.length)
      expect(result.totalPositions).toBe(correctOrder.length)

      const ended = waitFor<{ isNonScored: boolean; correctAnswer: unknown; correctOrder?: string[] }>(host, 'question_ended')
      const leaderboard = waitFor<{ totalPlayers: number; questionIndex: number; standingsRecommended: boolean; top: Array<{ score: number }> }>(host, 'leaderboard_update')
      const personalResult = waitFor<{ isCorrect: boolean; pointsEarned: number; totalScore: number; correctPositions?: number; totalPositions?: number }>(participant, 'personal_result')
      const endAck = await emit<{ success: boolean; ended?: boolean; questionIndex?: number }>(host, 'end_question', { gameCode })
      expect(endAck).toMatchObject({ success: true, ended: true, questionIndex: 0 })
      const endedPayload = await ended
      expect(endedPayload.isNonScored).toBe(false)
      expect(endedPayload.correctOrder).toEqual(correctOrder)

      const board = await leaderboard
      expect(board.questionIndex).toBe(0)
      expect(board.totalPlayers).toBe(1)
      expect(board.standingsRecommended).toBe(true)
      expect(board.top[0]?.score).toBeGreaterThan(0)

      const personal = await personalResult
      expect(personal.isCorrect).toBe(true)
      expect(personal.pointsEarned).toBeGreaterThan(0)
      expect(personal.totalScore).toBe(personal.pointsEarned)
      expect(personal.correctPositions).toBe(correctOrder.length)
      expect(personal.totalPositions).toBe(correctOrder.length)
    } finally {
      host.disconnect(); participant.disconnect()
    }
  })
})

test.describe('Regressions — presentation', () => {
  // Helper: create a presenter session via Socket.IO. Mirrors how the
  // host UI does it for live presentations.
  async function createPresenterSession(slides: unknown[]): Promise<{ host: Socket; gameCode: string }> {
    const host = await connect(await hostAuthCookie())
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
