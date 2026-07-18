export type QuizQuestion = {
  id?: string
  type: string
  text: string
  imageUrl?: string
  options?: (string | { text: string; imageUrl?: string })[]
  timerSeconds?: number
  points?: number
  explanation?: string
  scenarioText?: string
  supportingDetail?: string
  matchLefts?: string[]   // matching — left prompts (ordered)
  matchRights?: string[]  // matching — right options (shuffled)
  index: number   // raw snapshot index — the answer-submission key
  ordinal?: number // 1-based display position among answerable questions
  total: number
}

export type AnswerValue = number | string | string[] | number[]

export interface AsyncInputProps {
  question: QuizQuestion
  disabled: boolean
  onSubmit: (answer: AnswerValue) => void
}

export function optText(o: unknown): string {
  if (typeof o === 'string') return o
  if (o && typeof o === 'object' && 'text' in o) return String((o as { text: string }).text)
  return String(o)
}
