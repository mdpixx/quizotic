import { describe, expect, it } from 'vitest'
import { isScoredQuestion, type Question } from '../lib/quiz-types'

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
