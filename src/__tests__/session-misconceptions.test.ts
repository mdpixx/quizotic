import { describe, expect, it } from 'vitest'

import { buildMisconceptionSummary, type SessionMatrixData } from '@/lib/session-matrix'

const matrix: SessionMatrixData = {
  questions: [
    { index: 0, label: 'What is a context window?', type: 'mcq', isScored: true },
    { index: 1, label: 'What is grounding?', type: 'mcq', isScored: true },
    { index: 2, label: 'Which answer is supported?', type: 'mcq', isScored: true },
  ],
  participants: [
    { id: 'a', name: 'Asha', score: 100, correct: 1, answered: 3, accuracy: 33, cells: [0, 0, 1], points: [0, 0, 100], confidences: ['sure', 'unsure', 'sure'] },
    { id: 'b', name: 'Ravi', score: 0, correct: 0, answered: 3, accuracy: 0, cells: [0, 0, 0], points: [0, 0, 0], confidences: ['sure', 'sure', null] },
    { id: 'c', name: 'Meera', score: 100, correct: 1, answered: 3, accuracy: 33, cells: [0, 1, 0], points: [0, 100, 0], confidences: ['sure', 'sure', 'sure'] },
  ],
  perQuestionAccuracy: [0, 33, 33],
}

describe('buildMisconceptionSummary', () => {
  it('groups confidently-wrong answers by question and names unique learners', () => {
    const summary = buildMisconceptionSummary(matrix)

    expect(summary).toMatchObject({
      hasConfidenceData: true,
      answerCount: 5,
      learnerCount: 3,
      questionCount: 3,
    })
    expect(summary.questions.map(question => [question.index, question.answerCount])).toEqual([
      [0, 3],
      [1, 1],
      [2, 1],
    ])
    expect(summary.questions[0].participants.map(participant => participant.name)).toEqual(['Asha', 'Ravi', 'Meera'])
  })

  it('treats missing confidence as unavailable instead of confidently wrong', () => {
    const withoutConfidence: SessionMatrixData = {
      ...matrix,
      participants: matrix.participants.map(participant => ({
        ...participant,
        confidences: participant.confidences.map(() => null),
      })),
    }

    expect(buildMisconceptionSummary(withoutConfidence)).toMatchObject({
      hasConfidenceData: false,
      answerCount: 0,
      learnerCount: 0,
      questionCount: 0,
      questions: [],
    })
  })

  it('recognises captured confidence when there are no confidently-wrong answers', () => {
    const noMisconceptions: SessionMatrixData = {
      ...matrix,
      participants: [{
        ...matrix.participants[0],
        cells: [1, 0, 1],
        confidences: ['sure', 'unsure', 'sure'],
      }],
    }

    expect(buildMisconceptionSummary(noMisconceptions)).toMatchObject({
      hasConfidenceData: true,
      answerCount: 0,
      learnerCount: 0,
      questionCount: 0,
    })
  })
})
