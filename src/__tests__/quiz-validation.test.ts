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
})

describe('formatQuizValidationIssues', () => {
  it('adds question numbers for creator and API messages', () => {
    expect(formatQuizValidationIssues(validateQuizQuestions([
      q({ text: '', correctAnswer: undefined }),
    ]))).toBe('Q1: Question text is required. Q1: MCQ questions need one correct answer.')
  })
})
