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
export const ASYNC_PARTICIPATION_TYPES = new Set(['poll', 'openended', 'wordcloud', 'qa', 'rating', 'ranking', 'case', 'drawing'])

export function isAsyncScoredType(type: string): boolean {
  return ASYNC_GRADEABLE_TYPES.has(type)
}

export function stripAnswers(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { correctAnswer, correctAnswers, correctOrder, ...safe } = q
  return safe
}

// Like stripAnswers but also backfills options for types that omit them
// (truefalse is stored without options; callers must never get undefined).
export function toPublicQuestion(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { correctAnswer, correctAnswers, correctOrder, ...safe } = q
  const options = (safe.options && (safe.options as unknown[]).length > 0)
    ? safe.options
    : q.type === 'truefalse' ? ['True', 'False'] : safe.options
  return { ...safe, options }
}

// Returns the effective options array for a question, with type-appropriate defaults.
function getOpts(q: Question): unknown[] {
  if (q.options && (q.options as unknown[]).length > 0) return q.options as unknown[]
  if (q.type === 'truefalse') return ['True', 'False']
  if (q.type === 'rating') return ['1', '2', '3', '4', '5']
  return []
}

export function validateAnswer(
  question: Question,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string; code: string } {
  const type = question.type
  const opts = getOpts(question)

  if (type === 'mcq' || type === 'truefalse' || type === 'poll' || type === 'case') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
    if (!Number.isInteger(n) || n < 0 || n >= opts.length)
      return { ok: false, error: 'Answer must be a valid option index', code: 'invalid_answer' }
    return { ok: true, value: n }
  }

  if (type === 'multiselect') {
    if (!Array.isArray(raw) || raw.length === 0)
      return { ok: false, error: 'Answer must be a non-empty array of option indices', code: 'invalid_answer' }
    const indices = [...new Set((raw as unknown[]).map(x => (typeof x === 'number' ? x : parseInt(String(x), 10))))]
    if (indices.some(n => !Number.isInteger(n) || n < 0 || n >= opts.length))
      return { ok: false, error: 'Answer contains invalid option index', code: 'invalid_answer' }
    return { ok: true, value: indices.map(String) }
  }

  if (type === 'openended' || type === 'wordcloud' || type === 'qa') {
    if (typeof raw !== 'string' || raw.trim() === '')
      return { ok: false, error: 'Answer must be a non-empty string', code: 'invalid_answer' }
    return { ok: true, value: raw.trim().slice(0, 2000) }
  }

  if (type === 'rating') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN
    if (!Number.isInteger(n) || n < 0 || n >= opts.length)
      return { ok: false, error: 'Answer must be a valid rating index', code: 'invalid_answer' }
    return { ok: true, value: String(n) }
  }

  if (type === 'ranking') {
    const len = opts.length
    if (!Array.isArray(raw) || (raw as unknown[]).length !== len)
      return { ok: false, error: 'Ranking answer must have the same length as options', code: 'invalid_answer' }
    const nums = (raw as unknown[]).map(x => (typeof x === 'number' ? x : parseInt(String(x), 10)))
    if (nums.some(n => !Number.isInteger(n) || n < 0 || n >= len))
      return { ok: false, error: 'Ranking contains invalid index', code: 'invalid_answer' }
    const sorted = [...nums].sort((a, b) => a - b)
    if (sorted.some((n, i) => n !== i))
      return { ok: false, error: 'Ranking must be a permutation of all option indices', code: 'invalid_answer' }
    return { ok: true, value: nums }
  }

  if (type === 'drawing') {
    if (typeof raw !== 'string' || !raw.startsWith('data:image/'))
      return { ok: false, error: 'Drawing answer must be an image data URL', code: 'invalid_answer' }
    if (raw.length > 200000)
      return { ok: false, error: 'Drawing answer is too large', code: 'answer_too_large' }
    return { ok: true, value: raw }
  }

  return { ok: false, error: `Unsupported question type: ${type}`, code: 'invalid_answer' }
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
