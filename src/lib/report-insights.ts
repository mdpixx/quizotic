import type { QuestionStat } from '@/lib/quiz-types'

export interface TeacherReportInsights {
  weakestQuestions: Array<{ index: number; text: string; correctPct: number }>
  masteredQuestions: Array<{ index: number; text: string; correctPct: number }>
  misconceptions: Array<{ index: number; text: string; sureWrong: number }>
  completion: {
    totalParticipants: number
    finishedCount: number
    completionRate: number | null
    dropOffCount: number
  }
  suggestedNextStep: string
}

function shortText(text: string): string {
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

export function buildTeacherReportInsights(input: {
  questionStats: QuestionStat[]
  totalParticipants: number
  finishedCount?: number
}): TeacherReportInsights {
  const scored = input.questionStats.filter(q => !q.isNonScored && typeof q.correctPct === 'number')
  const weakestQuestions = scored
    .filter(q => (q.correctPct ?? 0) < 60)
    .sort((a, b) => (a.correctPct ?? 0) - (b.correctPct ?? 0))
    .slice(0, 5)
    .map(q => ({ index: q.index, text: shortText(q.text), correctPct: q.correctPct ?? 0 }))

  const masteredQuestions = scored
    .filter(q => (q.correctPct ?? 0) >= 80)
    .sort((a, b) => (b.correctPct ?? 0) - (a.correctPct ?? 0))
    .slice(0, 5)
    .map(q => ({ index: q.index, text: shortText(q.text), correctPct: q.correctPct ?? 0 }))

  const misconceptions = scored
    .filter(q => (q.confidenceGrid?.sureWrong ?? 0) > 0)
    .sort((a, b) => (b.confidenceGrid?.sureWrong ?? 0) - (a.confidenceGrid?.sureWrong ?? 0))
    .slice(0, 5)
    .map(q => ({ index: q.index, text: shortText(q.text), sureWrong: q.confidenceGrid?.sureWrong ?? 0 }))

  const totalParticipants = Math.max(0, input.totalParticipants)
  const finishedCount = Math.max(0, input.finishedCount ?? totalParticipants)
  const completionRate = totalParticipants > 0 ? Math.round((finishedCount / totalParticipants) * 100) : null
  const dropOffCount = Math.max(0, totalParticipants - finishedCount)

  let suggestedNextStep = 'Run a short retrieval quiz using the weakest questions.'
  if (weakestQuestions.length === 0 && misconceptions.length > 0) {
    suggestedNextStep = 'Review the confident-but-wrong questions before the next lesson.'
  } else if (weakestQuestions.length === 0 && scored.length > 0) {
    suggestedNextStep = 'Move to a harder follow-up quiz; this group is ready.'
  } else if (weakestQuestions.length === 0 && dropOffCount > 0) {
    suggestedNextStep = 'Share a self-paced retry link and focus the recap on incomplete attempts.'
  }

  return {
    weakestQuestions,
    masteredQuestions,
    misconceptions,
    completion: { totalParticipants, finishedCount, completionRate, dropOffCount },
    suggestedNextStep,
  }
}
