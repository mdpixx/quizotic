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

describe('validateQuizQuestions — text length', () => {
  const ok = { correctAnswer: '0' as const }

  it('warns about a long option on a standard slide and points at the fix', () => {
    const issues = validateQuizQuestions([
      q({ ...ok, options: ['x'.repeat(900), 'B', 'C', 'D'] }),
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: 'options', severity: 'warning' })
    expect(issues[0]!.message).toContain('Long text')
  })

  it('accepts the same long option once the slide opts in', () => {
    expect(validateQuizQuestions([
      q({ ...ok, longText: true, options: ['x'.repeat(900), 'B', 'C', 'D'] }),
    ])).toEqual([])
  })

  it('warns about a question over the standard cap and points at the fix', () => {
    const issues = validateQuizQuestions([q({ ...ok, text: 'x'.repeat(400) })])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: 'text', severity: 'warning' })
  })

  it('stays silent about a long question once the slide opts in', () => {
    expect(validateQuizQuestions([
      q({ ...ok, longText: true, text: 'x'.repeat(1500) }),
    ])).toEqual([])
  })

  // The ceilings are absolute — they stop a pathological API/import payload
  // regardless of the flag, which is the only length guard the server has.
  it('errors past the option ceiling even on a long-text slide', () => {
    const issues = validateQuizQuestions([
      q({ ...ok, longText: true, options: ['x'.repeat(1001), 'B', 'C', 'D'] }),
    ])
    expect(issues).toContainEqual(expect.objectContaining({ field: 'options', severity: 'error' }))
  })

  it('errors past the question ceiling even on a long-text slide', () => {
    const issues = validateQuizQuestions([
      q({ ...ok, longText: true, text: 'x'.repeat(1601) }),
    ])
    expect(issues).toContainEqual(expect.objectContaining({ field: 'text', severity: 'error' }))
  })

  it('errors past the scenario and supporting-detail ceilings', () => {
    const issues = validateQuizQuestions([
      q({
        ...ok,
        type: 'case',
        longText: true,
        scenarioText: 'x'.repeat(3001),
        supportingDetail: 'y'.repeat(601),
      }),
    ])
    expect(issues).toContainEqual(expect.objectContaining({ field: 'scenarioText', severity: 'error' }))
    expect(issues).toContainEqual(expect.objectContaining({ field: 'supportingDetail', severity: 'error' }))
  })

  it('leaves an ordinary slide with ordinary text completely clean', () => {
    expect(validateQuizQuestions([q(ok)])).toEqual([])
  })
})

describe('formatQuizValidationIssues', () => {
  it('adds question numbers for creator and API messages', () => {
    expect(formatQuizValidationIssues(validateQuizQuestions([
      q({ text: '', correctAnswer: undefined }),
    ]))).toBe('Q1: Question text is required. Q1: MCQ questions need one correct answer.')
  })
})
