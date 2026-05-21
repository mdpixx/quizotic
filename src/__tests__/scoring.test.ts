import { describe, it, expect } from 'vitest'
import { checkAnswer, calcPoints, applyStreak, validateAnswer, scoreRanking } from '../lib/scoring'

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

// ─── validateAnswer ──────────────────────────────────────────────────────────

const mcqQ = { type: 'mcq', options: ['A', 'B', 'C', 'D'], timerSeconds: 20, points: 1000 }
const tfQ = { type: 'truefalse', timerSeconds: 15, points: 500 }
const msQ = { type: 'multiselect', options: ['A', 'B', 'C'], timerSeconds: 30, points: 1000 }
const oeQ = { type: 'openended', timerSeconds: 60, points: 0 }
const ratingQ = { type: 'rating', options: ['1', '2', '3', '4', '5'], timerSeconds: 30, points: 0 }
const rankQ = { type: 'ranking', options: ['A', 'B', 'C'], timerSeconds: 60, points: 0 }
const drawQ = { type: 'drawing', timerSeconds: 120, points: 0 }

describe('validateAnswer — mcq', () => {
  it('accepts a valid integer index', () => {
    const r = validateAnswer(mcqQ, 2)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(2)
  })

  it('accepts a string index', () => {
    const r = validateAnswer(mcqQ, '1')
    expect(r.ok).toBe(true)
  })

  it('rejects out-of-range index', () => {
    const r = validateAnswer(mcqQ, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_answer')
  })

  it('rejects negative index', () => {
    expect(validateAnswer(mcqQ, -1).ok).toBe(false)
  })
})

describe('validateAnswer — truefalse backfill', () => {
  it('accepts 0 (True) even without explicit options', () => {
    expect(validateAnswer(tfQ, 0).ok).toBe(true)
  })

  it('accepts 1 (False)', () => {
    expect(validateAnswer(tfQ, 1).ok).toBe(true)
  })

  it('rejects 2', () => {
    expect(validateAnswer(tfQ, 2).ok).toBe(false)
  })
})

describe('validateAnswer — multiselect', () => {
  it('accepts valid array', () => {
    const r = validateAnswer(msQ, ['0', '2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual(['0', '2'])
  })

  it('deduplicates repeated indices', () => {
    const r = validateAnswer(msQ, ['1', '1'])
    expect(r.ok).toBe(true)
    if (r.ok) expect((r.value as string[]).length).toBe(1)
  })

  it('rejects empty array', () => {
    expect(validateAnswer(msQ, []).ok).toBe(false)
  })

  it('rejects out-of-range index in array', () => {
    expect(validateAnswer(msQ, ['0', '5']).ok).toBe(false)
  })
})

describe('validateAnswer — openended / wordcloud / qa', () => {
  it('accepts non-empty string', () => {
    const r = validateAnswer(oeQ, '  my answer  ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('my answer')
  })

  it('rejects empty string', () => {
    expect(validateAnswer(oeQ, '   ').ok).toBe(false)
  })

  it('caps at 2000 chars', () => {
    const long = 'x'.repeat(3000)
    const r = validateAnswer(oeQ, long)
    expect(r.ok).toBe(true)
    if (r.ok) expect((r.value as string).length).toBe(2000)
  })
})

describe('validateAnswer — rating', () => {
  it('accepts 0-based index string', () => {
    const r = validateAnswer(ratingQ, '2')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('2')
  })

  it('rejects index >= max', () => {
    expect(validateAnswer(ratingQ, 5).ok).toBe(false)
  })
})

describe('validateAnswer — ranking', () => {
  it('accepts a valid permutation', () => {
    const r = validateAnswer(rankQ, [2, 0, 1])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual([2, 0, 1])
  })

  it('rejects wrong length', () => {
    expect(validateAnswer(rankQ, [0, 1]).ok).toBe(false)
  })

  it('rejects duplicate indices (not a permutation)', () => {
    expect(validateAnswer(rankQ, [0, 0, 1]).ok).toBe(false)
  })
})

// ─── scoreRanking ─────────────────────────────────────────────────────────────

describe('scoreRanking — all-or-nothing', () => {
  const q = { type: 'ranking', correctOrder: ['0', '1', '2', '3'], timerSeconds: 20, points: 1000 }

  it('full correct at speed 1 → 1000 pts, isCorrect=true', () => {
    const r = scoreRanking(q, [0, 1, 2, 3], 1)
    expect(r.isCorrect).toBe(true)
    expect(r.basePoints).toBe(1000)
    expect(r.correctPositions).toBe(4)
    expect(r.totalPositions).toBe(4)
  })

  it('full correct at speed 0.5 → 500 pts', () => {
    const r = scoreRanking(q, [0, 1, 2, 3], 0.5)
    expect(r.isCorrect).toBe(true)
    expect(r.basePoints).toBe(500)
  })

  it('one position wrong → 0 pts, isCorrect=false', () => {
    const r = scoreRanking(q, [0, 1, 3, 2], 1)
    expect(r.isCorrect).toBe(false)
    expect(r.basePoints).toBe(0)
    expect(r.correctPositions).toBe(2)
  })

  it('fully reversed → 0 pts', () => {
    const r = scoreRanking(q, [3, 2, 1, 0], 1)
    expect(r.isCorrect).toBe(false)
    expect(r.basePoints).toBe(0)
    expect(r.correctPositions).toBe(0)
  })

  it('string answer normalises correctly', () => {
    const r = scoreRanking(q, ['0', '1', '2', '3'], 1)
    expect(r.isCorrect).toBe(true)
    expect(r.basePoints).toBe(1000)
  })

  it('numeric correctOrder normalises correctly', () => {
    const qNum = { ...q, correctOrder: [0, 1, 2, 3] as unknown as string[] }
    const r = scoreRanking(qNum, [0, 1, 2, 3], 1)
    expect(r.isCorrect).toBe(true)
  })

  it('no correctOrder → 0 pts, totalPositions=0', () => {
    const qNone = { type: 'ranking', timerSeconds: 20, points: 1000 }
    const r = scoreRanking(qNone, [0, 1, 2], 1)
    expect(r.totalPositions).toBe(0)
    expect(r.basePoints).toBe(0)
    expect(r.isCorrect).toBe(false)
  })

  it('non-array answer → 0 pts, no throw', () => {
    expect(() => scoreRanking(q, null, 1)).not.toThrow()
    expect(scoreRanking(q, null, 1).basePoints).toBe(0)
    expect(scoreRanking(q, 'bad', 1).basePoints).toBe(0)
  })

  it('late answer (speedMultiplier=0) → 0 pts but correctPositions still computed', () => {
    const r = scoreRanking(q, [0, 1, 2, 3], 0)
    expect(r.isCorrect).toBe(true)
    expect(r.basePoints).toBe(0)
    expect(r.correctPositions).toBe(4)
  })
})

describe('validateAnswer — drawing', () => {
  it('accepts a valid data URL', () => {
    const r = validateAnswer(drawQ, 'data:image/png;base64,abc')
    expect(r.ok).toBe(true)
  })

  it('rejects non-data-url', () => {
    expect(validateAnswer(drawQ, 'https://example.com/img.png').ok).toBe(false)
  })

  it('rejects drawings over 200 000 chars', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(200000)
    const r = validateAnswer(drawQ, big)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('answer_too_large')
  })
})
