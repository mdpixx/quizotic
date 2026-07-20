export type QuestionType =
  | 'mcq'
  | 'multiselect'
  | 'truefalse'
  | 'fillblank'
  | 'matching'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'
  | 'case'
  | 'drawing'
  | 'leaderboard'  // flow slide: shows live standings; not answerable, not scored

// Question types that award points. Everything else is participation-only.
// Keep in sync with the `nonScored` set in server.mjs (emitQuestionEnded / buildQuestionStats / computeMaxScore).
export const SCORED_TYPES: readonly QuestionType[] = ['mcq', 'multiselect', 'truefalse', 'fillblank', 'matching'] as const

// Non-scored types that still need a host-visible reveal screen + dashboard card.
// Keep order-stable for switch dispatch in QuestionResultsView.
export const NON_SCORED_TYPES: readonly QuestionType[] = [
  'poll', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'case', 'drawing',
] as const

export function isScoredType(type: QuestionType): boolean {
  return SCORED_TYPES.includes(type)
}

export function isSequenceRanking(q: Question): boolean {
  return q.type === 'ranking' && Array.isArray(q.correctOrder) && q.correctOrder.length > 0
}

export function isScoredQuestion(q: Pick<Question, 'type' | 'correctOrder'>): boolean {
  if (isScoredType(q.type)) return true
  return q.type === 'ranking' && Array.isArray(q.correctOrder) && q.correctOrder.length > 0
}

// Leaderboard "flow" slides live in the same questions[] array so they drag,
// reorder, and delete like any slide — but they are not answerable and never
// scored. Everywhere that iterates questions as answerable must skip these.
// Structurally typed (not Pick<Question, 'type'>) so callers holding
// scoring.ts's string-typed Question shape can use it without casts.
export function isLeaderboardSlide(q: { type: string }): boolean {
  return q.type === 'leaderboard'
}

// Maps each question type to the visualization used by QuestionResultsView.
//   bars       → option distribution bar chart (poll, mcq, multiselect, truefalse)
//   cloud      → word cloud sized by frequency (wordcloud)
//   list       → scrolling text response list (openended, qa)
//   histogram  → 1..N rating histogram + average (rating)
//   ordered    → sorted list with avg rank pill (ranking)
//   grid       → drawing thumbnail grid (drawing)
//   inner      → case study; renderer recurses into inner question type
//   answerkey  → fill-in-the-blank: typed-answer list + accepted-answer key
//   pairs      → matching: left→right answer key with per-question correct %
export type ResultsRenderer = 'bars' | 'cloud' | 'list' | 'histogram' | 'ordered' | 'grid' | 'inner' | 'answerkey' | 'pairs'

export const RESULTS_RENDERER: Record<QuestionType, ResultsRenderer> = {
  mcq: 'bars',
  multiselect: 'bars',
  truefalse: 'bars',
  fillblank: 'answerkey',
  matching: 'pairs',
  poll: 'bars',
  wordcloud: 'cloud',
  openended: 'list',
  qa: 'list',
  rating: 'histogram',
  ranking: 'ordered',
  case: 'inner',
  drawing: 'grid',
  // Placeholder only — leaderboard slides are filtered out before the results
  // renderer (see buildQuestionStats in server.mjs). Key required for exhaustiveness.
  leaderboard: 'bars',
}

// Default option arrays per question type. Used to backfill AI-generated
// questions (where rating legitimately omits options) and as a render-time
// fallback so the live session UI always has something to show.
export function defaultOptionsForType(type: QuestionType): string[] | undefined {
  if (type === 'truefalse') return ['True', 'False']
  if (type === 'rating') return ['1', '2', '3', '4', '5']
  return undefined
}

// Safe accessor for rendering: returns the question's own options, or the
// type-appropriate defaults if missing. Returns undefined for text-only types
// (openended, wordcloud, qa) so callers can branch on "no options" correctly.
export function getEffectiveOptions(q: Pick<Question, 'type' | 'options'>): QuestionOption[] | undefined {
  if (q.options && q.options.length > 0) return q.options
  return defaultOptionsForType(q.type)
}

// All six levels of Anderson & Krathwohl's revised Bloom's Taxonomy (2001)
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create'

// Option can be a plain string (backward compat) or an object with optional image
export interface OptionItem {
  text: string
  imageUrl?: string         // CDN URL for image-based answer option
}

export type QuestionOption = string | OptionItem

// One left↔right pair for a matching question. The stored order is the
// answer key (left[i] matches right[i]); the right column is shuffled before
// it reaches participants (see sanitizeQuestion in server.mjs).
export interface MatchPair {
  left: string
  right: string
}

// Canonical normalizer for free-text answer comparison (fill-in-the-blank and
// the right column of a matching question). Lower-cases, trims, and collapses
// internal whitespace so "  New  Delhi " matches "new delhi".
export function normalizeText(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getOptionText(opt: QuestionOption): string {
  return typeof opt === 'string' ? opt : opt.text
}

export function getOptionImage(opt: QuestionOption): string | undefined {
  return typeof opt === 'string' ? undefined : opt.imageUrl
}

// ─── Rating helpers ──────────────────────────────────────────────────────────
// Half-stars ship only for the default 5-point scale; 7/10-point scales keep
// integer steps (10+ buckets of half-stars would be too fine to read). The
// builder never lets authors configure step/min/max, so we derive it here.
export function ratingStepFor(ratingMax: number): number {
  return ratingMax <= 5 ? 0.5 : 1
}

// Normalizes a raw rating answer to a float value in [1, ratingMax].
//
// Legacy submissions sent a 0-based option-index STRING ("0".."N-1"); new
// submissions send the real float value as a NUMBER (1.0, 1.5, …). The type
// cleanly disambiguates the two — a string integer in index range is legacy
// (value = idx + 1); anything else is treated as a real value that must land
// on the rating's step grid within [1, ratingMax]. Returns null when the
// value can't be coerced. scoring.ts and server.mjs share this logic.
export function normalizeRatingValue(raw: unknown, ratingMax: number): number | null {
  const step = ratingStepFor(ratingMax)
  // Legacy: a pure-integer STRING is a 0-based option index ("0".."N-1"). New
  // submissions send a NUMBER, so the type cleanly disambiguates — if a string
  // integer is outside the legacy index range it is rejected (no fall-through
  // to the float path, which would otherwise accept "5" as the value 5.0 on a
  // 5-point scale even though 5 was never a valid legacy index).
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const idx = parseInt(raw, 10)
    return idx >= 0 && idx < ratingMax ? idx + 1 : null
  }
  // New: real float value (number, or a stringified float like "3.5"),
  // snapped to the step grid within [1, ratingMax].
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN
  if (!Number.isFinite(n) || n < 1 || n > ratingMax) return null
  const snapped = 1 + Math.round((n - 1) / step) * step
  if (Math.abs(snapped - n) > 1e-9) return null
  return snapped
}

export interface Question {
  id: string
  type: QuestionType
  text: string
  imageUrl?: string         // question context image (CDN URL)
  options?: QuestionOption[] // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc (legacy single-correct)
  correctAnswers?: string[] // multiselect: array of option-index strings (e.g. ["0","2"])
  correctOrder?: string[]   // ranking: array of option ids in the correct sequence (when set, ranking is scored)
  blankAnswers?: string[]   // fillblank: accepted answers (case-insensitive); stripped before broadcast
  matchPairs?: MatchPair[]  // matching: left↔right answer key; transformed/shuffled before broadcast
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
  explanation?: string      // shown to host + participant after answer reveal; for 'case' type = debrief text
  bloomsLevel?: BloomsLevel // optional tag for session report Bloom's distribution
  scenarioText?: string     // 'case' type: the situation narrative (up to 500 chars)
  supportingDetail?: string // 'case' type: optional bold callout (stat, quote, data point)
  topN?: number             // 'leaderboard' type: how many top players to show (default 5)
}

export interface Quiz {
  id: string
  title: string
  subject?: string
  language?: string
  theme?: string            // theme id from src/lib/quiz-themes.ts; undefined = default
  createdAt: string         // ISO timestamp
  updatedAt: string         // ISO timestamp
  questions: Question[]
  // Self-paced preference (builder settings gear). Live hosting stays default.
  selfPaced?: boolean
  timeLimitMinutes?: number | null
  allowRetries?: boolean
  // When true (default), adding a scored question auto-seeds a leaderboard slide
  // after it. Hosts can still move/delete those slides or add more manually.
  autoLeaderboard?: boolean
}

export type SessionMode = 'competitive' | 'reflection' | 'selfpaced' | 'assessment' | 'accuracy'

// ─── Learning Science types ───────────────────────────────────────────────────

export interface ConfidenceGrid {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

// One entry per text submission (openended, qa, wordcloud raw stream).
export interface TextResponse {
  name?: string
  archetype?: string
  answer: string
  submittedAt: number
}

// One drawing submission (data URL kept compact at submission time).
export interface DrawingThumbnail {
  name?: string
  archetype?: string
  dataUrl: string
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
  isLeaderboard?: boolean                 // true for leaderboard flow slides — report UIs skip these
  totalResponses?: number                 // total participants who submitted (any type)
  // Answer key (scored questions only; null for poll/openended/etc.)
  correctIndex?: number | null           // single correct option index — used to highlight the bar chart (mcq/truefalse)
  correctAnswerText?: string | null      // resolved, human-readable correct answer (e.g. "B. Paris", "A, C", "A → C → B")
  // Bar-chart types (poll, mcq, multiselect, truefalse)
  optionDistribution?: number[] | null
  options?: string[]
  // Wordcloud
  wordFrequencies?: Record<string, number>
  // Text responses (openended, qa, wordcloud raw stream)
  textResponses?: TextResponse[]
  // Rating
  ratingHistogram?: number[]              // one slot per step (1.0, 1.5, … when half-step)
  ratingAverage?: number | null
  ratingMax?: number                      // 5 / 7 / 10 etc
  ratingStep?: number                     // 0.5 for ≤5-point scales (half-stars), else 1
  // Ranking
  rankingItems?: string[]                 // labels in original order
  rankingAverages?: number[]              // average position per item (1-based)
  rankingFirstPlaceCounts?: number[]      // # of #1 votes per item
  correctOrder?: string[]                 // sequence ranking: array of option indices in correct order
  fullCorrectCount?: number               // sequence ranking: count of participants who got all positions right
  // Drawing
  drawingThumbnails?: DrawingThumbnail[]
  // Matching (answer key for the results "pairs" renderer)
  matchPairs?: MatchPair[]
}
