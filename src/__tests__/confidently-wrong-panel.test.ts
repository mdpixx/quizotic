import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ConfidentlyWrongPanel } from '@/components/results/ConfidentlyWrongPanel'
import type { SessionMatrixData } from '@/lib/session-matrix'

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
  it('shows counts, affected questions, and participant names', () => {
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data: matrix(),
      loading: false,
      error: null,
    }))

    expect(markup).toContain('id="misconceptions"')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('Confidently wrong')
    expect(markup).toMatch(/>2<\/strong><span[^>]*>answers<\/span>/)
    expect(markup).toContain('Evidence question 1')
    expect(markup).toContain('Asha Rao')
  })

  it('shows only six questions before an accessible expansion', () => {
    const markup = renderToStaticMarkup(createElement(ConfidentlyWrongPanel, {
      data: matrix(7),
      loading: false,
      error: null,
    }))

    expect(markup).toContain('Show 1 more question')
    expect(markup).toContain('<details')
    expect(markup).toContain('Evidence question 7')
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
