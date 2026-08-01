import { describe, it, expect } from 'vitest'
// Import the .mjs directly — it is the ONLY schema module (server.mjs runtime
// + these tests). The old socket-schemas.ts mirror drifted out of sync and
// was removed 2026-07.
import {
  CreateSessionSchema,
  SubmitAnswerSchema,
  JoinSessionSchema,
  safeParseSocket,
} from '../lib/socket-schemas.mjs'

function createSessionPayload(timerSeconds: unknown) {
  return {
    quizData: {
      title: 'Timer contract regression',
      questions: [{
        id: 'q1',
        type: 'mcq',
        text: 'Which timer value should the socket accept?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: '0',
        timerSeconds,
        points: 1000,
      }],
    },
  }
}

describe('JoinSessionSchema', () => {
  it('accepts valid join payload', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', displayName: 'Alice' })
    expect(r.success).toBe(true)
  })

  it('rejects displayName over 24 chars', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', displayName: 'A'.repeat(25) })
    expect(r.success).toBe(false)
  })

  it('rejects empty displayName', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', displayName: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid email', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', displayName: 'Bob', email: 'bob@example.com' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', displayName: 'Bob', email: 'not-an-email' })
    expect(r.success).toBe(false)
  })
})

describe('SubmitAnswerSchema', () => {
  it('accepts single-answer MCQ', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '2', timeMs: 5000, confidence: null })
    expect(r.success).toBe(true)
  })

  it('accepts multiselect array', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: ['0', '2'], timeMs: 5000 })
    expect(r.success).toBe(true)
  })

  // Small negative timeMs values are accepted because the participant client
  // anchors `answerTimeRef` to the future `startAt` during the 3-2-1 countdown
  // — taps during the countdown legitimately produce slightly negative values.
  // The server clamps to [0, timerMs] when computing serverTimeMs anyway, so
  // letting these through Zod prevents a silent drop with no user feedback.
  it('accepts small negative timeMs (countdown taps)', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '0', timeMs: -1500 })
    expect(r.success).toBe(true)
  })

  it('rejects excessively negative timeMs (clearly bogus)', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '0', timeMs: -20000 })
    expect(r.success).toBe(false)
  })

  it('rejects timeMs above the 600s upper bound', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '0', timeMs: 600001 })
    expect(r.success).toBe(false)
  })

  it('rejects excessively long answer string', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: 'x'.repeat(3000), timeMs: 0 })
    expect(r.success).toBe(false)
  })

  // questionIndex is optional (old clients omit it) but when present it must
  // be a small non-negative integer — the server uses it to reject answers
  // that arrive after the host has advanced past the question.
  it('accepts payload with questionIndex', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '1', timeMs: 4000, questionIndex: 0 })
    expect(r.success).toBe(true)
  })

  it('accepts payload without questionIndex (old clients)', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '1', timeMs: 4000 })
    expect(r.success).toBe(true)
  })

  it('rejects negative questionIndex', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '1', timeMs: 4000, questionIndex: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects non-integer questionIndex', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '1', timeMs: 4000, questionIndex: 1.5 })
    expect(r.success).toBe(false)
  })
})

describe('CreateSessionSchema timer contract', () => {
  it('accepts a 600-second question followed by a no-timer leaderboard slide', () => {
    const result = CreateSessionSchema.safeParse({
      quizData: {
        title: 'GE201 PRELIM EXAM',
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            text: "Who combined Plato's ideas with Christian teachings?",
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: '3',
            timerSeconds: 600,
            points: 1000,
          },
          {
            id: 'leaderboard-1',
            type: 'leaderboard',
            text: '',
            timerSeconds: 0,
            points: 1000,
            topN: 5,
          },
        ],
      },
      sessionMode: 'accuracy',
    })

    expect(result.success).toBe(true)
  })

  it('accepts the five-second active-timer lower bound', () => {
    expect(CreateSessionSchema.safeParse(createSessionPayload(5)).success).toBe(true)
  })

  it.each([1, 4, 601, 1.5, '20'])('rejects unsupported timer value %j', timerSeconds => {
    expect(CreateSessionSchema.safeParse(createSessionPayload(timerSeconds)).success).toBe(false)
  })
})

describe('safeParseSocket helper', () => {
  it('returns success for valid payload', () => {
    const result = safeParseSocket(JoinSessionSchema, { gameCode: 'ABC123', displayName: 'Tester' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.displayName).toBe('Tester')
  })

  it('returns error string for invalid payload', () => {
    const result = safeParseSocket(JoinSessionSchema, { gameCode: 'AB', displayName: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(typeof result.error).toBe('string')
  })
})
