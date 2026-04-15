/**
 * Pure scoring utilities shared between server (server.mjs) and tests.
 * These are the canonical implementations — server.mjs should match these.
 */

export interface Question {
  type: string
  correctAnswer?: string | string[]
  correctAnswers?: string[]
  timerSeconds: number
  points: number
}

export interface Participant {
  score: number
  streakCount: number
  answers: Record<number, unknown>
}

/**
 * Check whether a submitted answer is correct for a question.
 * Returns false for non-scored question types.
 */
export function checkAnswer(question: Question, answer: unknown): boolean {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    const correctRaw = question.correctAnswers ?? question.correctAnswer
    if (!correctRaw) return false
    const correctArr = Array.isArray(correctRaw) ? correctRaw : [correctRaw]
    const givenArr = Array.isArray(answer) ? answer : [answer]
    if (correctArr.length === 0 || givenArr.length === 0) return false
    const correctSet = [...correctArr].map(String).sort().join(',')
    const givenSet = [...givenArr].map(String).sort().join(',')
    return correctSet === givenSet
  }
  return false
}

/**
 * Calculate points earned for a correct answer.
 * Applies a speed bonus of up to 500 pts on top of the base point value.
 */
export function calcPoints(base: number, timeMs: number, timerSeconds: number): number {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  const speedBonus = Math.round(500 * speedRatio)
  return base + speedBonus
}

/**
 * Apply streak bonus. Mutates participant.streakCount.
 * Returns bonus points to add (0 if no bonus).
 */
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
