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
  /**
   * Per-participant answer-option jumbling, on by default for scheduled
   * quizzes. Display-only: tiles render in a permuted order and the tapped
   * slot is mapped back before `onSubmit`, so everything the server sees —
   * grading, the report, the workbook — stays in authored-option space.
   * See lib/option-shuffle.ts.
   */
  shuffleOptions?: boolean
  /** Seeds the permutation. Stable per attempt, so a refresh re-renders the same order. */
  participantId?: string | null
}

export function optText(o: unknown): string {
  if (typeof o === 'string') return o
  if (o && typeof o === 'object' && 'text' in o) return String((o as { text: string }).text)
  return String(o)
}

export function optImage(o: unknown): string | undefined {
  if (o && typeof o === 'object' && 'imageUrl' in o) {
    const url = (o as { imageUrl?: unknown }).imageUrl
    return typeof url === 'string' && url ? url : undefined
  }
  return undefined
}
