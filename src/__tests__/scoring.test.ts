import { describe, it, expect } from 'vitest'
import { checkAnswer, calcPoints, applyStreak } from '../lib/scoring'

// ─── checkAnswer ─────────────────────────────────────────────────────────────

describe('checkAnswer — MCQ', () => {
  const q = { type: 'mcq', correctAnswer: '2', timerSeconds: 20, points: 1000 }

  it('returns true for exact match', () => {
    expect(checkAnswer(q, '2')).toBe(true)
  })

  it('returns false for wrong option', () => {
    expect(checkAnswer(q, '0')).toBe(false)
  })

  it('coerces number to string', () => {
    expect(checkAnswer(q, 2)).toBe(true)
  })
})

describe('checkAnswer — truefalse', () => {
  const q = { type: 'truefalse', correctAnswer: '0', timerSeconds: 15, points: 500 }

  it('matches on "0" (True)', () => {
    expect(checkAnswer(q, '0')).toBe(true)
  })

  it('rejects "1" (False)', () => {
    expect(checkAnswer(q, '1')).toBe(false)
  })
})

describe('checkAnswer — multiselect', () => {
  const q = { type: 'multiselect', correctAnswers: ['0', '2'], timerSeconds: 30, points: 1000 }

  it('returns true for exact correct set', () => {
    expect(checkAnswer(q, ['0', '2'])).toBe(true)
  })

  it('returns true regardless of submission order', () => {
    expect(checkAnswer(q, ['2', '0'])).toBe(true)
  })

  it('returns false for incomplete selection', () => {
    expect(checkAnswer(q, ['0'])).toBe(false)
  })

  it('returns false for wrong selection', () => {
    expect(checkAnswer(q, ['1', '2'])).toBe(false)
  })

  it('returns false for extra selection', () => {
    expect(checkAnswer(q, ['0', '1', '2'])).toBe(false)
  })
})

describe('checkAnswer — non-scored types', () => {
  it('returns false for poll', () => {
    expect(checkAnswer({ type: 'poll', timerSeconds: 20, points: 0 }, '0')).toBe(false)
  })

  it('returns false for openended', () => {
    expect(checkAnswer({ type: 'openended', timerSeconds: 60, points: 0 }, 'anything')).toBe(false)
  })
})

// ─── calcPoints ───────────────────────────────────────────────────────────────

describe('calcPoints', () => {
  it('awards full base for instant answer', () => {
    // speedRatio = 1.0 → base * (0.5 + 0.5) = base
    expect(calcPoints(1000, 0, 20)).toBe(1000)
  })

  it('awards half base if answered at time limit', () => {
    // speedRatio = 0 → base * 0.5
    expect(calcPoints(1000, 20000, 20)).toBe(500)
  })

  it('awards half base if answer is over time', () => {
    // speedRatio clamped to 0 → base * 0.5
    expect(calcPoints(1000, 25000, 20)).toBe(500)
  })

  it('awards proportional points for mid-time answer', () => {
    // timeMs = 10000ms, timerSeconds = 20s → speedRatio = 0.5 → base * 0.75
    expect(calcPoints(1000, 10000, 20)).toBe(750)
  })

  it('awards full base in accuracy formula regardless of time', () => {
    expect(calcPoints(1000, 19000, 20, 'accuracy')).toBe(1000)
  })
})

// ─── applyStreak ─────────────────────────────────────────────────────────────

describe('applyStreak', () => {
  function mkParticipant(streakCount = 0) {
    return { score: 0, streakCount, answers: {} }
  }

  it('first correct gives no streak bonus', () => {
    const p = mkParticipant(0)
    expect(applyStreak(p, true, false)).toBe(0)
    expect(p.streakCount).toBe(1)
  })

  it('2-streak gives +100', () => {
    const p = mkParticipant(1)
    expect(applyStreak(p, true, false)).toBe(100)
    expect(p.streakCount).toBe(2)
  })

  it('3-streak gives +200', () => {
    const p = mkParticipant(2)
    expect(applyStreak(p, true, false)).toBe(200)
  })

  it('4+-streak gives +500', () => {
    const p = mkParticipant(3)
    expect(applyStreak(p, true, false)).toBe(500)
    const p2 = mkParticipant(10)
    expect(applyStreak(p2, true, false)).toBe(500)
  })

  it('wrong answer resets streak to 0 and gives 0 bonus', () => {
    const p = mkParticipant(5)
    expect(applyStreak(p, false, false)).toBe(0)
    expect(p.streakCount).toBe(0)
  })

  it('non-scored question does not affect streak', () => {
    const p = mkParticipant(3)
    expect(applyStreak(p, true, true)).toBe(0)
    expect(p.streakCount).toBe(3) // unchanged
  })
})
