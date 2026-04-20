export type QuestionType =
  | 'mcq'
  | 'multiselect'
  | 'truefalse'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'
  | 'case'
  | 'drawing'

// Question types that award points. Everything else is participation-only.
// Keep in sync with the `nonScored` set in server.mjs (emitQuestionEnded / buildQuestionStats / computeMaxScore).
export const SCORED_TYPES: readonly QuestionType[] = ['mcq', 'multiselect', 'truefalse'] as const

export function isScoredType(type: QuestionType): boolean {
  return SCORED_TYPES.includes(type)
}

// All six levels of Anderson & Krathwohl's revised Bloom's Taxonomy (2001)
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create'

// Option can be a plain string (backward compat) or an object with optional image
export interface OptionItem {
  text: string
  imageUrl?: string         // CDN URL for image-based answer option
}

export type QuestionOption = string | OptionItem

export function getOptionText(opt: QuestionOption): string {
  return typeof opt === 'string' ? opt : opt.text
}

export function getOptionImage(opt: QuestionOption): string | undefined {
  return typeof opt === 'string' ? undefined : opt.imageUrl
}

export interface Question {
  id: string
  type: QuestionType
  text: string
  imageUrl?: string         // question context image (CDN URL)
  options?: QuestionOption[] // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc (legacy single-correct)
  correctAnswers?: string[] // multiselect: array of option-index strings (e.g. ["0","2"])
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
  explanation?: string      // shown to host + participant after answer reveal; for 'case' type = debrief text
  bloomsLevel?: BloomsLevel // optional tag for session report Bloom's distribution
  scenarioText?: string     // 'case' type: the situation narrative (up to 500 chars)
  supportingDetail?: string // 'case' type: optional bold callout (stat, quote, data point)
}

export interface Quiz {
  id: string
  title: string
  subject?: string
  language?: string
  createdAt: string         // ISO timestamp
  updatedAt: string         // ISO timestamp
  questions: Question[]
}

export type SessionMode = 'competitive' | 'reflection' | 'selfpaced' | 'assessment'

// ─── Learning Science types ───────────────────────────────────────────────────

export interface ConfidenceGrid {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

export interface QuestionStat {
  index: number
  text: string
  type?: string
  correctPct: number | null              // 0–100, null for non-scored (poll, wordcloud, etc.)
  confidenceGrid: ConfidenceGrid | null  // null if no participants answered
  bloomsLevel: BloomsLevel | null
  explanation: string | null
  isNonScored?: boolean
  optionDistribution?: number[] | null
  options?: string[]
}
