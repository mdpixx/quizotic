// Pure scoring utilities — canonical implementations used by async routes and tests.
// server.mjs mirrors these functions for live sessions; keep them in sync.

export interface Question {
  type: string
  correctAnswer?: string | string[]
  correctAnswers?: string[]
  correctOrder?: string[]
  timerSeconds: number
  points: number
  explanation?: string
  options?: unknown[]
  imageUrl?: string
  text?: string
}

export interface Participant {
  score: number
  streakCount: number
  answers: Record<number, unknown>
}

export type PublicQuestion = Omit<Question, 'correctAnswer' | 'correctAnswers' | 'correctOrder'>

export const ASYNC_GRADEABLE_TYPES = new Set(['mcq', 'truefalse', 'multiselect'])

export function stripAnswers(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { correctAnswer, correctAnswers, correctOrder, ...safe } = q
  return safe
}

export function checkAnswer(question: Question, answer: unknown): boolean {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    const correctRaw = question.correctAnswers ?? question.correctAnswer
    if (!correctRaw) return false
    const correctArr = Array.isArray(correctRaw) ? correctRaw : [correctRaw]
    const givenArr = Array.isArray(answer) ? (answer as unknown[]) : [answer]
    if (correctArr.length === 0 || givenArr.length === 0) return false
    const correctSet = [...correctArr].map(String).sort().join(',')
    const givenSet = [...givenArr].map(String).sort().join(',')
    return correctSet === givenSet
  }
  return false
}

// Kahoot-style classic scoring: correct answer worth between base/2 (slow) and
// base (instant). formula='accuracy' awards base for every correct answer.
export function calcPoints(base: number, timeMs: number, timerSeconds: number, formula = 'classic'): number {
  if (formula === 'accuracy') return base
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  return Math.round(base * (0.5 + 0.5 * speedRatio))
}

export function applyStreak(participant: Participant, isCorrect: boolean, isNonScored: boolean): number {
  if (isNonScored) return 0
  if (!isCorrect) {
    participant.streakCount = 0
    return 0
  }
  participant.streakCount = (participant.streakCount || 0) + 1
  const s = participant.streakCount
  if (s >= 4) return 500
  if (s === 3) return 200
  if (s === 2) return 100
  return 0
}

// Stateless streak bonus computation from prior answer history.
// priorCorrect: ordered by questionIndex ascending.
export function computeStreakBonus(priorCorrect: boolean[], isCorrect: boolean): number {
  if (!isCorrect) return 0
  let streak = 0
  for (let i = priorCorrect.length - 1; i >= 0; i--) {
    if (priorCorrect[i]) streak++
    else break
  }
  streak++ // include current correct answer
  if (streak >= 4) return 500
  if (streak === 3) return 200
  if (streak === 2) return 100
  return 0
}
