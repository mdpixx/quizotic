// Pure scoring utilities — canonical implementations used by async routes and tests.
// server.mjs mirrors these functions for live sessions; keep them in sync.

import { isLeaderboardSlide, normalizeRatingValue } from './quiz-types'

export interface Question {
  type: string
  correctAnswer?: string | string[]
  correctAnswers?: string[]
  correctOrder?: string[]
  blankAnswers?: string[]
  matchPairs?: { left: string; right: string }[]
  timerSeconds: number
  points: number
  explanation?: string
  options?: unknown[]
  imageUrl?: string
  text?: string
}

// Canonical normalizer for free-text answer comparison. Mirrors
// normalizeText in src/lib/quiz-types.ts — keep the two in sync.
function normalizeText(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface Participant {
  score: number
  streakCount: number
  answers: Record<number, unknown>
}

export type PublicQuestion = Omit<Question, 'correctAnswer' | 'correctAnswers' | 'correctOrder' | 'blankAnswers' | 'matchPairs'> & {
  matchLefts?: string[]   // matching: left prompts in order
  matchRights?: string[]  // matching: right options, shuffled (no alignment to lefts)
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export const ASYNC_GRADEABLE_TYPES = new Set(['mcq', 'truefalse', 'multiselect', 'fillblank', 'matching'])
export const ASYNC_PARTICIPATION_TYPES = new Set(['poll', 'openended', 'wordcloud', 'qa', 'rating', 'ranking', 'case', 'drawing'])

export function isAsyncScoredType(type: string): boolean {
  return ASYNC_GRADEABLE_TYPES.has(type)
}

export function isScoredQuestion(q: Question): boolean {
  if (ASYNC_GRADEABLE_TYPES.has(q.type)) return true
  if (q.type === 'ranking') return Array.isArray(q.correctOrder) && q.correctOrder.length > 0
  return false
}

export function isAsyncScoredQuestion(q: Question): boolean {
  return isScoredQuestion(q)
}

export interface RankingScore {
  isCorrect: boolean
  correctPositions: number
  totalPositions: number
  basePoints: number
}

// All-or-nothing ranking scorer. answer must be an array of original option
// indices (the order the participant placed them, in original-index space).
// correctOrder holds stringified positional indices ["0","1","2",...].
// speedMultiplier: pass 0 for late answers, 1 for accuracy formula.
export function scoreRanking(question: Question, answer: unknown, speedMultiplier: number): RankingScore {
  const correctOrder = Array.isArray(question.correctOrder) ? question.correctOrder : []
  const totalPositions = correctOrder.length
  const zero: RankingScore = { isCorrect: false, correctPositions: 0, totalPositions, basePoints: 0 }
  if (totalPositions === 0 || !Array.isArray(answer)) return zero
  const submitted = (answer as unknown[]).map(String)
  const correct = correctOrder.map(String)
  let correctPositions = 0
  for (let i = 0; i < totalPositions; i++) {
    if (submitted[i] !== undefined && submitted[i] === correct[i]) correctPositions++
  }
  const isCorrect = correctPositions === totalPositions && submitted.length === totalPositions
  const basePoints = isCorrect ? Math.round((question.points || 1000) * speedMultiplier) : 0
  return { isCorrect, correctPositions, totalPositions, basePoints }
}

export function stripAnswers(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { correctAnswer, correctAnswers, correctOrder, blankAnswers, matchPairs, ...safe } = q
  return withMatchingColumns(safe, matchPairs)
}

// Splits a matching question's answer key into a left prompt list (in order)
// and a shuffled right-option pool, so the answer alignment never reaches the
// client. No-op for every other type.
function withMatchingColumns(safe: PublicQuestion, matchPairs?: { left: string; right: string }[]): PublicQuestion {
  if (safe.type !== 'matching' || !Array.isArray(matchPairs)) return safe
  return {
    ...safe,
    matchLefts: matchPairs.map(p => p.left),
    matchRights: shuffled(matchPairs.map(p => p.right)),
  }
}

// Like stripAnswers but also backfills options for types that omit them
// (truefalse is stored without options; callers must never get undefined).
export function toPublicQuestion(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { correctAnswer, correctAnswers, correctOrder, blankAnswers, matchPairs, ...safe } = q
  const options = (safe.options && (safe.options as unknown[]).length > 0)
    ? safe.options
    : q.type === 'truefalse' ? ['True', 'False'] : safe.options
  return withMatchingColumns({ ...safe, options }, matchPairs)
}

// ─── Self-paced serving ──────────────────────────────────────────────────────
// Leaderboard flow slides are live-session markers and must never be served
// to the async player (it has no renderer for them — serving one wedges the
// attempt). Snapshot indices stay raw because Answer rows key on questionIndex;
// ordinal/total give the client display numbering among answerable questions.

export function nextAnswerableIndex(questions: Question[], from: number): number {
  return questions.findIndex((q, i) => i >= from && !isLeaderboardSlide(q))
}

export function answerableCount(questions: Question[]): number {
  return questions.filter(q => !isLeaderboardSlide(q)).length
}

export type ServedQuestion = PublicQuestion & { index: number; ordinal: number; total: number }

export function toServedQuestion(questions: Question[], index: number): ServedQuestion {
  const ordinal = answerableCount(questions.slice(0, index)) + 1
  return { ...toPublicQuestion(questions[index]!), index, ordinal, total: answerableCount(questions) }
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
    // Integer stars only (1..ratingMax). Legacy 0-based option-index strings
    // ("0".."N-1") are converted to 1-based values so old sessions still
    // aggregate. The shared helper is mirrored verbatim in server.mjs.
    const ratingMax = opts.length || 5
    const value = normalizeRatingValue(raw, ratingMax)
    if (value === null)
      return { ok: false, error: 'Answer must be a valid rating value', code: 'invalid_answer' }
    return { ok: true, value: String(value) }
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

  if (type === 'fillblank') {
    if (typeof raw !== 'string' || raw.trim() === '')
      return { ok: false, error: 'Answer must be a non-empty string', code: 'invalid_answer' }
    return { ok: true, value: raw.trim().slice(0, 200) }
  }

  if (type === 'matching') {
    // Answer is an array of chosen right-column values (strings), one per left
    // item, in the order the left items are presented.
    const pairs = Array.isArray(question.matchPairs) ? question.matchPairs : []
    if (!Array.isArray(raw) || raw.length !== pairs.length || pairs.length === 0)
      return { ok: false, error: 'Matching answer must have one choice per left item', code: 'invalid_answer' }
    const value = (raw as unknown[]).map(x => String(x ?? '').slice(0, 200))
    return { ok: true, value }
  }

  return { ok: false, error: `Unsupported question type: ${type}`, code: 'invalid_answer' }
}

export function checkAnswer(question: Question, answer: unknown): boolean {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'fillblank') {
    const accepted = Array.isArray(question.blankAnswers) ? question.blankAnswers : []
    if (accepted.length === 0) return false
    const given = normalizeText(answer)
    if (!given) return false
    return accepted.some(a => normalizeText(a) === given)
  }
  if (question.type === 'matching') {
    const pairs = Array.isArray(question.matchPairs) ? question.matchPairs : []
    if (pairs.length === 0 || !Array.isArray(answer) || answer.length !== pairs.length) return false
    return pairs.every((p, i) => normalizeText((answer as unknown[])[i]) === normalizeText(p.right))
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
