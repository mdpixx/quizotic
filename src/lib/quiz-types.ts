export type QuestionType =
  | 'mcq'
  | 'truefalse'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'
  | 'case'

// All six levels of Anderson & Krathwohl's revised Bloom's Taxonomy (2001)
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create'

export interface Question {
  id: string
  type: QuestionType
  text: string
  options?: string[]        // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc
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

export type SessionMode = 'competitive' | 'reflection'

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
  correctPct: number                     // 0–100
  confidenceGrid: ConfidenceGrid | null  // null if no participants answered
  bloomsLevel: BloomsLevel | null
  explanation: string | null
}
