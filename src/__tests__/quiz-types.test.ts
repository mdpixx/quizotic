import { describe, expect, it } from 'vitest'
import { isScoredQuestion, normalizeRatingValue, type Question } from '../lib/quiz-types'

const baseRanking: Question = {
  id: 'rank-1',
  type: 'ranking',
  text: 'Arrange these steps',
  options: ['First', 'Second', 'Third'],
  timerSeconds: 30,
  points: 1000,
}

describe('isScoredQuestion', () => {
  it('treats sequence ranking as scored when correctOrder is configured', () => {
    expect(isScoredQuestion({ ...baseRanking, correctOrder: ['0', '1', '2'] })).toBe(true)
  })

  it('treats ordinary ranking as participation-only when no correctOrder exists', () => {
    expect(isScoredQuestion(baseRanking)).toBe(false)
  })

  it('keeps traditional quiz question types scored', () => {
    expect(isScoredQuestion({ ...baseRanking, type: 'mcq' })).toBe(true)
    expect(isScoredQuestion({ ...baseRanking, type: 'multiselect' })).toBe(true)
    expect(isScoredQuestion({ ...baseRanking, type: 'truefalse' })).toBe(true)
  })
})

// ─── rating helpers (integer stars) ─────────────────────────────────────────
// Mirrored verbatim in server.mjs — these tests lock the contract both share.

describe('normalizeRatingValue', () => {
  it('converts a legacy 0-based index string to a 1-based value', () => {
    expect(normalizeRatingValue('0', 5)).toBe(1)
    expect(normalizeRatingValue('4', 5)).toBe(5)
  })

  it('rejects a legacy index out of range', () => {
    expect(normalizeRatingValue('5', 5)).toBeNull()
    expect(normalizeRatingValue('9', 5)).toBeNull()
  })

  it('accepts integer values in range', () => {
    expect(normalizeRatingValue(1, 5)).toBe(1)
    expect(normalizeRatingValue(3, 5)).toBe(3)
    expect(normalizeRatingValue(5, 5)).toBe(5)
  })

  it('rejects non-integer values', () => {
    expect(normalizeRatingValue(3.5, 5)).toBeNull()
    expect(normalizeRatingValue(3.7, 5)).toBeNull()
  })

  it('rejects values below 1', () => {
    expect(normalizeRatingValue(0, 5)).toBeNull()
    expect(normalizeRatingValue(-1, 5)).toBeNull()
  })

  it('rejects values above max', () => {
    expect(normalizeRatingValue(6, 5)).toBeNull()
  })

  it('works with 7/10-point scales', () => {
    expect(normalizeRatingValue(4, 7)).toBe(4)
    expect(normalizeRatingValue(10, 10)).toBe(10)
  })

  it('rejects garbage', () => {
    expect(normalizeRatingValue('abc', 5)).toBeNull()
    expect(normalizeRatingValue(null, 5)).toBeNull()
    expect(normalizeRatingValue(undefined, 5)).toBeNull()
  })
})
