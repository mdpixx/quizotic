// Answer submission-window rules — guards against three review findings:
//   1. Answers scored with full points AFTER the reveal fired — submit_answer
//      had no questionEnded check, so stragglers scored into the standings
//      after personal_result went out. ('question_ended' → server records the
//      answer through the LATE path: 0 points, no streak, isCorrect=false.)
//   2. Packets arriving during the 3-2-1 countdown scored at serverTimeMs=0
//      (maximum speed bonus) — the server never enforced the start gate the
//      client UI applies. ('not_started' → rejected.)
//   3. Delayed/outbox-flushed answers booked against whatever question was
//      current on arrival — the protocol carried no questionIndex.
//      ('stale_question' → rejected.)

import { describe, it, expect } from 'vitest'
import { answerWindowRejection } from '../lib/session-state.mjs'

type SessionLike = {
  currentQuestionIndex: number
  questionEnded?: boolean
  questionStartedAt?: number | null
}

const NOW = 1_750_000_000_000

function makeSession(overrides: Partial<SessionLike> = {}): SessionLike {
  return {
    currentQuestionIndex: 3,
    questionEnded: false,
    questionStartedAt: NOW - 5000, // question live for 5s
    ...overrides,
  }
}

describe('answerWindowRejection', () => {
  it('accepts an in-window answer for the current question', () => {
    const r = answerWindowRejection(makeSession(), { clientQuestionIndex: 3, receivedAt: NOW })
    expect(r).toBeNull()
  })

  it('accepts answers from old clients that omit questionIndex', () => {
    const r = answerWindowRejection(makeSession(), { clientQuestionIndex: undefined, receivedAt: NOW })
    expect(r).toBeNull()
  })

  it('rejects a stale answer stamped for a previous question', () => {
    const r = answerWindowRejection(makeSession(), { clientQuestionIndex: 2, receivedAt: NOW })
    expect(r).toBe('stale_question')
  })

  it('rejects an answer stamped for a future question', () => {
    const r = answerWindowRejection(makeSession(), { clientQuestionIndex: 4, receivedAt: NOW })
    expect(r).toBe('stale_question')
  })

  it('flags answers after the reveal fired (server records them as LATE, never scores them)', () => {
    const r = answerWindowRejection(makeSession({ questionEnded: true }), { clientQuestionIndex: 3, receivedAt: NOW })
    expect(r).toBe('question_ended')
  })

  it('rejects packets arriving before the 3-2-1 countdown finishes', () => {
    // questionStartedAt is 2s in the future — mid-countdown.
    const r = answerWindowRejection(makeSession({ questionStartedAt: NOW + 2000 }), { clientQuestionIndex: 3, receivedAt: NOW })
    expect(r).toBe('not_started')
  })

  it('accepts a packet landing exactly at question start', () => {
    const r = answerWindowRejection(makeSession({ questionStartedAt: NOW }), { clientQuestionIndex: 3, receivedAt: NOW })
    expect(r).toBeNull()
  })

  it('stale check wins over questionEnded (reports the real cause)', () => {
    const r = answerWindowRejection(makeSession({ questionEnded: true }), { clientQuestionIndex: 1, receivedAt: NOW })
    expect(r).toBe('stale_question')
  })
})
