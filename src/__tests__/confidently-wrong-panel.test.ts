import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ConfidentlyWrongPanel } from '@/components/results/ConfidentlyWrongPanel'
import { buildMisconceptionSummary, type SessionMatrixData } from '@/lib/session-matrix'

function matrix(questionCount = 2): SessionMatrixData {
  return {
    questions: Array.from({ length: questionCount }, (_, index) => ({
      index,
      label: `Evidence question ${index + 1}`,
      type: 'mcq',
      isScored: true,
    })),
    participants: [{
      id: 'asha',
      name: 'Asha Rao',
      score: 0,
      correct: 0,
      answered: questionCount,
      accuracy: 0,
      cells: Array.from({ length: questionCount }, () => 0 as const),
      points: Array.from({ length: questionCount }, () => 0),
      confidences: Array.from({ length: questionCount }, () => 'sure' as const),
    }],
    perQuestionAccuracy: Array.from({ length: questionCount }, () => 0),
  }
}

describe('ConfidentlyWrongPanel', () => {
  it('summarises affected respondents without exposing participant names', () => {
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data: matrix(),
      loading: false,
      error: null,
    }))

    expect(markup).toContain('id="misconceptions"')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('Misconception overview')
    expect(markup).toMatch(/>2<\/strong><span[^>]*>answers<\/span>/)
    expect(markup).toContain('Evidence question 1')
    expect(markup).toContain('1 of 1 respondents')
    expect(markup).toContain('100%')
    expect(markup).toContain('Participant names are included in Download Report')
    expect(markup).not.toContain('Asha Rao')
  })

  it('keeps the overview bounded to the five most affected questions', () => {
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data: matrix(7),
      loading: false,
      error: null,
    }))

    expect(markup).toContain('Showing 5 of 7 affected questions')
    expect(markup).toContain('Evidence question 5')
    expect(markup).not.toContain('Evidence question 6')
    expect(markup).not.toContain('<details')
  })

  it('derives respondent totals and affected percentages from attempted answers', () => {
    const data = matrix(1)
    data.participants = [
      { ...data.participants[0], id: 'sure-1', name: 'Sure one' },
      { ...data.participants[0], id: 'sure-2', name: 'Sure two' },
      { ...data.participants[0], id: 'unsure', name: 'Unsure', confidences: ['unsure'] },
      { ...data.participants[0], id: 'correct', name: 'Correct', cells: [1] },
      { ...data.participants[0], id: 'absent', name: 'Absent', cells: [null], confidences: [null], answered: 0 },
    ]

    const summary = buildMisconceptionSummary(data)

    expect(summary.questions[0]).toMatchObject({
      answerCount: 2,
      respondentCount: 4,
      affectedPct: 50,
    })
  })

  it('uses a neutral state when confidence was not captured', () => {
    const data = matrix(1)
    data.participants[0].confidences = [null]
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data,
      loading: false,
      error: null,
    }))

    expect(markup).toContain('Confidence wasn’t captured for this session')
    expect(markup).not.toContain('No confidently-wrong answers')
  })

  it('uses a positive state when confidence exists without sure-wrong answers', () => {
    const data = matrix(1)
    data.participants[0].cells = [1]
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data,
      loading: false,
      error: null,
    }))

    expect(markup).toContain('No confidently-wrong answers in this session')
  })
})
