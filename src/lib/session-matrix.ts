export type MatrixCell = 1 | 0 | 2 | null
export type MatrixConfidence = 'sure' | 'unsure' | null

export interface SessionMatrixQuestion {
  index: number
  label: string
  type: string
  isScored: boolean
  hasText?: boolean       // answers are short strings worth rendering in-cell
  isNameCapture?: boolean // identity slide — promoted to a sub-line under the name
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
  // Identity extras. The matrix route always populates these; they are optional
  // on the type because the confidence-focused consumers (misconception summary,
  // its fixtures) have no use for them and should not have to fabricate them.
  texts?: (string | null)[] // truncated typed answer per column; null when none
  identity?: string | null  // answer to the name-capture slide, if the quiz had one
  duplicateName?: boolean   // another row shares this display name
}

export interface SessionMatrixData {
  questions: SessionMatrixQuestion[]
  participants: SessionMatrixParticipant[]
  perQuestionAccuracy: (number | null)[]
  duplicateNameCount?: number  // how many display names are shared by >1 row
  hasIdentityColumn?: boolean  // the quiz had a name-capture slide
}

export interface MisconceptionQuestion {
  index: number
  label: string
  answerCount: number
  respondentCount: number
  affectedPct: number
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
    let respondentCount = 0
    for (const participant of data.participants) {
      const confidence = participant.confidences[column] ?? null
      if (confidence !== null) hasConfidenceData = true
      if (participant.cells[column] !== null) respondentCount += 1
      if (participant.cells[column] !== 0 || confidence !== 'sure') continue
      participants.push({ id: participant.id, name: participant.name })
      affectedLearners.add(participant.id)
    }
    return participants.length > 0
      ? [{
          index: question.index,
          label: question.label,
          answerCount: participants.length,
          respondentCount,
          affectedPct: respondentCount > 0 ? Math.round((participants.length / respondentCount) * 100) : 0,
          participants,
        }]
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
