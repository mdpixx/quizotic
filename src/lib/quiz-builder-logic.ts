/**
 * quiz-builder-logic.ts
 *
 * Pure constants and pure functions shared between the legacy builder
 * (src/app/host/create/page.tsx) and the new Slido-style builder
 * (src/components/host/builder/).
 *
 * No React, no JSX, no side-effects — just data and transforms.
 * SVG icons live in quiz-type-icons.tsx (separate file to keep this pure .ts).
 */

import type { Question, QuestionType } from './quiz-types'

// Re-export answer colors so the new builder doesn't need a separate import.
export { ANSWER_COLORS } from './answer-colors'

// Re-export validation so builders get a consistent surface.
export {
  validateQuizQuestions,
  hasQuizValidationErrors,
  formatQuizValidationIssues,
} from './quiz-validation'

// ── Timer / Points options ────────────────────────────────────────────────────

export const TIMER_OPTIONS = [10, 15, 20, 30, 60] as const
export type TimerSeconds = (typeof TIMER_OPTIONS)[number]

export const POINTS_OPTIONS = [500, 1000, 2000] as const
export type PointsValue = (typeof POINTS_OPTIONS)[number]

// ── Question type metadata (no SVG — see quiz-type-icons.tsx) ─────────────────

export interface TypePill {
  value: QuestionType
  label: string
  /** Compact label for narrow screens (mobile header). Falls back to `label`. */
  shortLabel?: string
  color: string
  bg: string
  tooltip: string
}

export const TYPE_PILLS: TypePill[] = [
  { value: 'mcq', label: 'MCQ', color: '#2563EB', bg: '#EFF6FF', tooltip: 'Classic quiz format — 2-4 options, one correct answer.' },
  { value: 'multiselect', label: 'Multi-select', shortLabel: 'Multi', color: '#7C3AED', bg: '#F5F3FF', tooltip: 'Choose one or more correct answers.' },
  { value: 'truefalse', label: 'True/False', shortLabel: 'T/F', color: '#16A34A', bg: '#F0FDF4', tooltip: 'Simple binary choice.' },
  { value: 'fillblank', label: 'Fill in the Blank', shortLabel: 'Blank', color: '#0D9488', bg: '#F0FDFA', tooltip: 'Participants type the missing word. Accepts multiple correct spellings.' },
  { value: 'matching', label: 'Matching', shortLabel: 'Match', color: '#DB2777', bg: '#FDF2F8', tooltip: 'Match each item on the left to its pair on the right.' },
  { value: 'poll', label: 'Poll', color: '#0F1B3D', bg: '#F3F4F6', tooltip: 'Gather opinions — no right or wrong answer.' },
  { value: 'openended', label: 'Open-ended', shortLabel: 'Open', color: '#D97706', bg: '#FFFBEB', tooltip: 'Free-text responses.' },
  { value: 'wordcloud', label: 'Word Cloud', shortLabel: 'Cloud', color: '#FF8A47', bg: '#FFF7ED', tooltip: 'Participants submit words forming a live cloud.' },
  { value: 'qa', label: 'Q&A', color: '#0891B2', bg: '#ECFEFF', tooltip: 'Open Q&A — participants ask questions.' },
  { value: 'rating', label: 'Rating', color: '#EA580C', bg: '#FFF7ED', tooltip: 'Star rating (1-5). Collect satisfaction scores.' },
  { value: 'ranking', label: 'Ranking', shortLabel: 'Rank', color: '#4F46E5', bg: '#EEF2FF', tooltip: 'Drag-to-rank items in order.' },
  { value: 'case', label: 'Scenario', shortLabel: 'Case', color: '#DC2626', bg: '#FFF1F2', tooltip: 'Present a real-world scenario with context.' },
  { value: 'leaderboard', label: 'Leaderboard', shortLabel: 'Board', color: '#92400E', bg: '#FEF3C7', tooltip: 'Show live standings. Drop it anywhere to reveal the rankings during play.' },
]

export const QUESTION_TYPE_GROUPS: { label: string; types: QuestionType[] }[] = [
  { label: 'Scored', types: ['mcq', 'multiselect', 'truefalse', 'fillblank', 'matching'] },
  { label: 'Feedback', types: ['poll', 'rating', 'ranking'] },
  { label: 'Text', types: ['openended', 'wordcloud', 'qa'] },
  { label: 'Creative', types: ['case'] },
  { label: 'Flow', types: ['leaderboard'] },
]

// ── Type helpers ──────────────────────────────────────────────────────────────

export function getTypePill(type: QuestionType): TypePill {
  return TYPE_PILLS.find(t => t.value === type) ?? TYPE_PILLS[0]!
}

export function isKnownQuestionType(value: string | null | undefined): value is QuestionType {
  return !!value && TYPE_PILLS.some(t => t.value === value)
}

export function hasCorrectAnswer(type: QuestionType, question?: Question): boolean {
  if (type === 'mcq' || type === 'truefalse') return !!question?.correctAnswer
  if (type === 'multiselect') return (question?.correctAnswers?.length ?? 0) > 0
  if (type === 'ranking' && question?.correctOrder && question.correctOrder.length > 0) return true
  if (type === 'fillblank') return (question?.blankAnswers?.some(a => a.trim() !== '') ?? false)
  if (type === 'matching') return (question?.matchPairs?.some(p => p.left.trim() !== '' && p.right.trim() !== '') ?? false)
  return false
}

export function needsCorrectAnswer(type: QuestionType): boolean {
  return type === 'mcq' || type === 'truefalse' || type === 'multiselect'
}

// ── Question construction ─────────────────────────────────────────────────────

/**
 * Returns the canonical default options for a given type, or undefined for
 * free-text / option-less types (openended, wordcloud, qa, drawing).
 */
export function optionsForType(type: QuestionType): string[] | undefined {
  if (type === 'truefalse') return ['True', 'False']
  if (type === 'mcq') return ['', '', '', '']
  if (type === 'multiselect') return ['', '', '', '']
  if (type === 'rating') return ['1', '2', '3', '4', '5']
  if (type === 'case') return ['', '', '', '']
  if (type === 'poll') return ['', '', '', '']
  if (type === 'ranking') return ['', '', '']
  return undefined
}

export function makeQuestion(overrides?: Partial<Question>): Question {
  // Leaderboard flow slides carry no options/answers — build a clean object so
  // they never inherit the MCQ defaults below.
  if (overrides?.type === 'leaderboard') {
    return {
      id: crypto.randomUUID(),
      type: 'leaderboard',
      text: '',
      timerSeconds: 20,
      points: 1000,
      topN: 5,
      ...overrides,
    }
  }
  return {
    id: crypto.randomUUID(),
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: undefined,
    timerSeconds: 20,
    points: 1000,
    ...overrides,
  }
}

/**
 * Switches a question to a new type while preserving its text.
 * Resets options, correctAnswer, correctAnswers, and correctOrder to defaults.
 */
export function convertQuestionType(question: Question, type: QuestionType): Question {
  return {
    ...question,
    type,
    options: optionsForType(type),
    correctAnswer: undefined,
    correctAnswers: type === 'multiselect' ? [] : undefined,
    correctOrder: undefined,
    blankAnswers: type === 'fillblank' ? [''] : undefined,
    matchPairs: type === 'matching' ? [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] : undefined,
    topN: type === 'leaderboard' ? (question.topN ?? 5) : undefined,
  }
}

// ── Presentation helpers ──────────────────────────────────────────────────────

/**
 * Picks a responsive Tailwind text size class based on question text length so
 * long questions don't overflow the canvas card or live-session header.
 */
export function questionTextSizeClass(text: string): string {
  const len = text.length
  if (len > 240) return 'text-base md:text-lg'
  if (len > 180) return 'text-lg md:text-xl'
  if (len > 120) return 'text-xl md:text-2xl'
  if (len > 70) return 'text-xl md:text-3xl'
  return 'text-2xl md:text-4xl'
}

export const QUESTION_CHAR_LIMIT = 160
export const OPTION_CHAR_LIMIT = 100

// ── Audience presets (cascades timer/points/difficulty) ───────────────────────

export type AudiencePresetId = 'classroom' | 'coaching' | 'corporate' | 'event'

export interface AudiencePreset {
  id: AudiencePresetId
  label: string
  note: string
  timerSeconds: TimerSeconds
  points: PointsValue
  difficulty: 'easy' | 'medium' | 'hard'
}

export const AUDIENCE_PRESETS: AudiencePreset[] = [
  { id: 'classroom', label: 'Classroom', note: 'Readable pace for live teaching', timerSeconds: 20, points: 1000, difficulty: 'medium' },
  { id: 'coaching', label: 'Coaching test', note: 'Assessment pace with fewer repeats', timerSeconds: 30, points: 2000, difficulty: 'hard' },
  { id: 'corporate', label: 'Corporate training', note: 'Calm timing with retakes', timerSeconds: 30, points: 1000, difficulty: 'medium' },
  { id: 'event', label: 'Event pulse', note: 'Fast, lightweight engagement', timerSeconds: 15, points: 500, difficulty: 'easy' },
]

// ── AI type-mix helpers ───────────────────────────────────────────────────────

export interface TypeMix {
  mcq: number
  multiselect: number
  truefalse: number
  poll: number
  openended: number
  wordcloud: number
  qa: number
  rating: number
  ranking: number
  case: number
}

export const EMPTY_TYPE_MIX: TypeMix = {
  mcq: 0, multiselect: 0, truefalse: 0, poll: 0, openended: 0,
  wordcloud: 0, qa: 0, rating: 0, ranking: 0, case: 0,
}

/**
 * Distributes `count` questions across weighted types; remainder goes to the
 * highest-weight type. Used to seed the AI mix from an intent preset.
 */
export function distributeTypeMix(weights: Partial<TypeMix>, count: number): TypeMix {
  const keys = (Object.keys(weights) as (keyof TypeMix)[]).filter(k => (weights[k] ?? 0) > 0)
  if (keys.length === 0 || count <= 0) return { ...EMPTY_TYPE_MIX, mcq: Math.max(0, count) }
  const totalWeight = keys.reduce((sum, k) => sum + (weights[k] ?? 0), 0)
  const next: TypeMix = { ...EMPTY_TYPE_MIX }
  let assigned = 0
  keys.forEach(k => {
    const share = Math.floor((count * (weights[k] ?? 0)) / totalWeight)
    next[k] = share
    assigned += share
  })
  next[keys[0]!] += count - assigned
  return next
}

// ── Generated-question hydration ─────────────────────────────────────────────

/**
 * Takes a raw array returned by the AI API and ensures every question has a
 * fresh UUID and options backfilled for types the AI might legitimately omit.
 * Safe to call outside of React — no side-effects.
 */
export function hydrateGeneratedQuestions(raw: Partial<Question>[]): Question[] {
  return raw.map(q => {
    const base: Question = {
      id: crypto.randomUUID(),
      type: (q.type as QuestionType) || 'mcq',
      text: q.text ?? '',
      timerSeconds: q.timerSeconds ?? 20,
      points: q.points ?? 1000,
      options: q.options,
      correctAnswer: q.correctAnswer,
      correctAnswers: q.correctAnswers,
      correctOrder: q.correctOrder,
      blankAnswers: q.blankAnswers,
      matchPairs: q.matchPairs,
      imageUrl: q.imageUrl,
      explanation: q.explanation,
      bloomsLevel: q.bloomsLevel,
      scenarioText: q.scenarioText,
      supportingDetail: q.supportingDetail,
    }
    if (!base.options || base.options.length === 0) {
      const defaults = optionsForType(base.type)
      if (defaults) return { ...base, options: defaults }
    }
    return base
  })
}
