import { describe, expect, it } from 'vitest'
import { buildTeacherReportInsights } from '../lib/report-insights'
import type { QuestionStat } from '../lib/quiz-types'

describe('buildTeacherReportInsights', () => {
  it('identifies weak, mastered, misconception, and completion signals', () => {
    const stats: QuestionStat[] = [
      {
        index: 0,
        text: 'Photosynthesis basics',
        type: 'mcq',
        correctPct: 42,
        confidenceGrid: { sureCorrect: 4, sureWrong: 3, unsureCorrect: 1, unsureWrong: 2 },
        bloomsLevel: 'remember',
        explanation: null,
        isNonScored: false,
        totalResponses: 10,
      },
      {
        index: 1,
        text: 'Advanced food chain reasoning',
        type: 'mcq',
        correctPct: 88,
        confidenceGrid: { sureCorrect: 8, sureWrong: 0, unsureCorrect: 1, unsureWrong: 1 },
        bloomsLevel: 'analyse',
        explanation: null,
        isNonScored: false,
        totalResponses: 10,
      },
      {
        index: 2,
        text: 'How confident are you?',
        type: 'rating',
        correctPct: null,
        confidenceGrid: null,
        bloomsLevel: null,
        explanation: null,
        isNonScored: true,
        totalResponses: 10,
      },
    ]

    const insights = buildTeacherReportInsights({ questionStats: stats, totalParticipants: 12, finishedCount: 9 })

    expect(insights.weakestQuestions).toEqual([{ index: 0, text: 'Photosynthesis basics', correctPct: 42 }])
    expect(insights.masteredQuestions).toEqual([{ index: 1, text: 'Advanced food chain reasoning', correctPct: 88 }])
    expect(insights.misconceptions).toEqual([{ index: 0, text: 'Photosynthesis basics', sureWrong: 3 }])
    expect(insights.completion).toEqual({ totalParticipants: 12, finishedCount: 9, completionRate: 75, dropOffCount: 3 })
    expect(insights.suggestedNextStep).toContain('weakest questions')
  })

  it('recommends harder follow-up when scored questions are mastered', () => {
    const insights = buildTeacherReportInsights({
      totalParticipants: 3,
      finishedCount: 3,
      questionStats: [{
        index: 0,
        text: 'Easy question',
        type: 'mcq',
        correctPct: 95,
        confidenceGrid: { sureCorrect: 3, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 },
        bloomsLevel: null,
        explanation: null,
        isNonScored: false,
      }],
    })

    expect(insights.weakestQuestions).toHaveLength(0)
    expect(insights.suggestedNextStep).toContain('harder follow-up quiz')
  })
})
