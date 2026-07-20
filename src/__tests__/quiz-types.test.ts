import { describe, expect, it } from 'vitest'
import { isScoredQuestion, normalizeRatingValue, ratingStepFor, type Question } from '../lib/quiz-types'

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

// ─── rating helpers (half-star support) ─────────────────────────────────────
// These are mirrored verbatim in server.mjs — these tests lock the contract
// both share.

describe('ratingStepFor', () => {
  it('uses 0.5 step for the default 5-point scale', () => {
    expect(ratingStepFor(5)).toBe(0.5)
  })

  it('uses integer step for 7/10-point scales', () => {
    expect(ratingStepFor(7)).toBe(1)
    expect(ratingStepFor(10)).toBe(1)
  })
})

describe('normalizeRatingValue', () => {
  it('converts a legacy 0-based index string to a 1-based value', () => {
    expect(normalizeRatingValue('0', 5)).toBe(1)
    expect(normalizeRatingValue('4', 5)).toBe(5)
  })

  it('rejects a legacy index out of range', () => {
    expect(normalizeRatingValue('5', 5)).toBeNull()
    expect(normalizeRatingValue('9', 5)).toBeNull()
  })

  it('accepts integer float values', () => {
    expect(normalizeRatingValue(3, 5)).toBe(3)
    expect(normalizeRatingValue(5, 5)).toBe(5)
  })

  it('accepts half-star values on a 5-point scale', () => {
    expect(normalizeRatingValue(3.5, 5)).toBe(3.5)
    expect(normalizeRatingValue(1.5, 5)).toBe(1.5)
  })

  it('rejects values not on the 0.5 step grid', () => {
    expect(normalizeRatingValue(3.7, 5)).toBeNull()
    expect(normalizeRatingValue(3.25, 5)).toBeNull()
  })

  it('rejects values below 1', () => {
    expect(normalizeRatingValue(0.5, 5)).toBeNull()
    expect(normalizeRatingValue(0, 5)).toBeNull()
  })

  it('rejects values above max', () => {
    expect(normalizeRatingValue(5.5, 5)).toBeNull()
  })

  it('keeps integer-only steps for 7-point scales', () => {
    expect(normalizeRatingValue(4, 7)).toBe(4)
    expect(normalizeRatingValue(4.5, 7)).toBeNull()
  })

  it('parses a numeric float string', () => {
    expect(normalizeRatingValue('3.5', 5)).toBe(3.5)
  })

  it('rejects garbage', () => {
    expect(normalizeRatingValue('abc', 5)).toBeNull()
    expect(normalizeRatingValue(null, 5)).toBeNull()
    expect(normalizeRatingValue(undefined, 5)).toBeNull()
  })
})
