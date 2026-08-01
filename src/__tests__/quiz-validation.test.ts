import { describe, expect, it } from 'vitest'
import { validateQuizQuestions, formatQuizValidationIssues } from '../lib/quiz-validation'
import type { Question } from '../lib/quiz-types'

function q(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    type: 'mcq',
    text: 'Which option is correct?',
    options: ['A', 'B', 'C', 'D'],
    timerSeconds: 20,
    points: 1000,
    ...overrides,
  }
}

describe('validateQuizQuestions', () => {
  it('requires MCQ to have exactly one valid correct answer', () => {
    expect(validateQuizQuestions([q({ correctAnswer: undefined })])).toEqual([
      {
        questionIndex: 0,
        field: 'correctAnswer',
        message: 'MCQ questions need one correct answer.',
        severity: 'error',
      },
    ])
  })

  it('rejects an MCQ correct answer outside the option range', () => {
    expect(validateQuizQuestions([q({ correctAnswer: '9' })])[0]).toMatchObject({
      questionIndex: 0,
      field: 'correctAnswer',
      severity: 'error',
    })
  })

  it('requires multi-select to have at least one valid correct option', () => {
    const issues = validateQuizQuestions([
      q({ type: 'multiselect', correctAnswer: undefined, correctAnswers: [] }),
    ])

    expect(issues).toEqual([
      {
        questionIndex: 0,
        field: 'correctAnswers',
        message: 'Multi-select questions need at least one correct option.',
        severity: 'error',
      },
    ])
  })

  it('accepts multi-select with multiple correct options', () => {
    expect(validateQuizQuestions([
      q({ type: 'multiselect', correctAnswer: undefined, correctAnswers: ['0', '2'] }),
    ])).toEqual([])
  })

  it('does not require a correct answer for polls', () => {
    expect(validateQuizQuestions([
      q({ type: 'poll', correctAnswer: undefined }),
    ])).toEqual([])
  })

  it.each([0, 5, 600])('accepts canonical timer value %s', timerSeconds => {
    expect(validateQuizQuestions([q({ timerSeconds, correctAnswer: '0' })])).toEqual([])
  })

  it.each([1, 4, 601, 1.5, '20'])('rejects unsupported timer value %j', timerSeconds => {
    const issues = validateQuizQuestions([
      q({ timerSeconds: timerSeconds as unknown as number, correctAnswer: '0' }),
    ])

    expect(issues).toContainEqual({
      questionIndex: 0,
      field: 'timerSeconds',
      message: 'Timer must be 0 (no timer) or 5-600 seconds.',
      severity: 'error',
    })
  })
})

describe('formatQuizValidationIssues', () => {
  it('adds question numbers for creator and API messages', () => {
    expect(formatQuizValidationIssues(validateQuizQuestions([
      q({ text: '', correctAnswer: undefined }),
    ]))).toBe('Q1: Question text is required. Q1: MCQ questions need one correct answer.')
  })
})
