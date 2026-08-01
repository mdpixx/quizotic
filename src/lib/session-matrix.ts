export type MatrixCell = 1 | 0 | 2 | null
export type MatrixConfidence = 'sure' | 'unsure' | null

export interface SessionMatrixQuestion {
  index: number
  label: string
  type: string
  isScored: boolean
}

export interface SessionMatrixParticipant {
  id: string
  name: string
  score: number
  correct: number
  answered: number
  accuracy: number | null
  cells: MatrixCell[]
  points: number[]
  confidences: MatrixConfidence[]
}

export interface SessionMatrixData {
  questions: SessionMatrixQuestion[]
  participants: SessionMatrixParticipant[]
  perQuestionAccuracy: (number | null)[]
}

export interface MisconceptionQuestion {
  index: number
  label: string
  answerCount: number
  participants: Array<{ id: string; name: string }>
}

export interface MisconceptionSummary {
  hasConfidenceData: boolean
  answerCount: number
  learnerCount: number
  questionCount: number
  questions: MisconceptionQuestion[]
}

export function normalizeMatrixConfidence(value: unknown): MatrixConfidence {
  return value === 'sure' || value === 'unsure' ? value : null
}

export function buildMisconceptionSummary(data: SessionMatrixData): MisconceptionSummary {
  const affectedLearners = new Set<string>()
  let hasConfidenceData = false

  const questions = data.questions.flatMap((question, column) => {
    const participants: MisconceptionQuestion['participants'] = []
    for (const participant of data.participants) {
      const confidence = participant.confidences[column] ?? null
      if (confidence !== null) hasConfidenceData = true
      if (participant.cells[column] !== 0 || confidence !== 'sure') continue
      participants.push({ id: participant.id, name: participant.name })
      affectedLearners.add(participant.id)
    }
    return participants.length > 0
      ? [{ index: question.index, label: question.label, answerCount: participants.length, participants }]
      : []
  }).sort((a, b) => b.answerCount - a.answerCount || a.index - b.index)

  return {
    hasConfidenceData,
    answerCount: questions.reduce((sum, question) => sum + question.answerCount, 0),
    learnerCount: affectedLearners.size,
    questionCount: questions.length,
    questions,
  }
}
