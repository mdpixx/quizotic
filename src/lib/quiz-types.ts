export type QuestionType =
  | 'mcq'
  | 'truefalse'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'

export interface Question {
  id: string
  type: QuestionType
  text: string
  options?: string[]        // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
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
