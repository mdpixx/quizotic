import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ParticipantMatrix } from '@/components/results/ParticipantMatrix'
import { QuestionResultsView } from '@/components/results/QuestionResultsView'
import type { SessionMatrixData } from '@/lib/session-matrix'

const MATRIX: SessionMatrixData = {
  questions: [{ index: 0, label: 'Evidence question', type: 'mcq', isScored: true }],
  participants: [
    { id: 'sure', name: 'Sure learner', score: 0, correct: 0, answered: 1, accuracy: 0, cells: [0], points: [0], confidences: ['sure'] },
    { id: 'unsure', name: 'Unsure learner', score: 0, correct: 0, answered: 1, accuracy: 0, cells: [0], points: [0], confidences: ['unsure'] },
  ],
  perQuestionAccuracy: [0],
}

describe('final report presentation', () => {
  it('renders every wrong matrix answer with the same plain cross', () => {
    const markup = renderToStaticMarkup(createElement(ParticipantMatrix, {
      sessionId: 'session-1',
      data: MATRIX,
      loading: false,
      error: null,
    }))

    expect(markup.match(/aria-label="Wrong"/g)).toHaveLength(2)
    expect(markup).not.toContain('Confidently wrong')
    expect(markup).not.toContain('title="Confidently wrong"')
  })

  it('shows a fractional five-star rating with a numerical average and response count', () => {
    const markup = renderToStaticMarkup(createElement(QuestionResultsView, {
      questionType: 'rating',
      stat: { ratingHistogram: [1, 2, 3, 5, 6], ratingAverage: 3.59, ratingMax: 5 },
      mode: 'final',
    }))

    expect(markup).toContain('aria-label="Average rating 3.59 out of 5 from 17 ratings"')
    expect(markup.match(/data-rating-star="true"/g)).toHaveLength(5)
    expect(markup).toContain('3.59 / 5')
    expect(markup).toContain('17 ratings')
  })

  it('derives a missing average and supports a ten-point rating scale', () => {
    const markup = renderToStaticMarkup(createElement(QuestionResultsView, {
      questionType: 'rating',
      stat: { ratingHistogram: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1], ratingMax: 10 },
      mode: 'final',
    }))

    expect(markup.match(/data-rating-star="true"/g)).toHaveLength(10)
    expect(markup).toContain('9.50 / 10')
    expect(markup).toContain('2 ratings')
  })
})
