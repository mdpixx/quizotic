/**
 * csv-import.ts — pure CSV → Question[] conversion.
 *
 * Extracted from the legacy /host/create builder (create/page.tsx:1550-1609).
 * Returns structured results instead of calling alert() so callers can handle
 * errors in any UI context.
 *
 * Expected CSV columns (case-insensitive, order-independent):
 *   question, optionA, optionB, optionC, optionD,
 *   correctAnswer (letter A–D), timer, points
 */

import type { Question } from './quiz-types'

export const SAMPLE_CSV = `question,optionA,optionB,optionC,optionD,correctAnswer,timer,points
"What is 2+2?",3,4,5,6,B,20,1000
"Is the Earth round?",True,False,,,A,15,500
"Describe the water cycle.",,,,,,30,1000`

export const VALID_TIMERS = [10, 15, 20, 30, 60] as const
export const VALID_POINTS = [500, 1000, 2000] as const

const DEFAULT_TIMER = 20
const DEFAULT_POINTS = 1000

type ValidTimer = typeof VALID_TIMERS[number]
type ValidPoints = typeof VALID_POINTS[number]

// How many distinct coercions to name before summarising. Long imports can
// produce the same warning on 200 rows; the host only needs to see it once.
const MAX_WARNINGS = 4

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  result.push(cur.trim())
  return result
}

export interface CsvParseResult {
  questions: Partial<Question>[]
  error?: string
  /**
   * Non-blocking notices about values that were silently changed on the way in
   * (an off-list `timer` or `points`). The import still succeeds — but a host
   * who typed 25 should not have to discover on quiz night that it became 20.
   */
  warnings?: string[]
}

export function parseCsvToQuestions(text: string): CsvParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { questions: [], error: 'The CSV file appears to be empty or has only a header row.' }
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const qIdx = headers.findIndex(h => h === 'question')
  if (qIdx === -1) {
    return {
      questions: [],
      error: 'Required column "question" not found. Download the template to see the correct format.',
    }
  }

  const aIdx = headers.findIndex(h => h === 'optiona' || h === 'option_a' || h === 'a')
  const bIdx = headers.findIndex(h => h === 'optionb' || h === 'option_b' || h === 'b')
  const cIdx = headers.findIndex(h => h === 'optionc' || h === 'option_c' || h === 'c')
  const dIdx = headers.findIndex(h => h === 'optiond' || h === 'option_d' || h === 'd')
  const correctIdx = headers.findIndex(
    h => h === 'correctanswer' || h === 'correct_answer' || h === 'correct' || h === 'answer',
  )
  const timerIdx = headers.findIndex(h => h === 'timer' || h === 'time')
  const pointsIdx = headers.findIndex(h => h === 'points')

  const questions: Partial<Question>[] = []
  // Keyed by the coerced-from value so 200 identical rows warn once.
  const timerCoercions = new Set<string>()
  const pointsCoercions = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const questionText = cols[qIdx]
    if (!questionText) continue

    const options: string[] = []
    if (aIdx >= 0 && cols[aIdx]) options.push(cols[aIdx])
    if (bIdx >= 0 && cols[bIdx]) options.push(cols[bIdx])
    if (cIdx >= 0 && cols[cIdx]) options.push(cols[cIdx])
    if (dIdx >= 0 && cols[dIdx]) options.push(cols[dIdx])

    const correctLetter = correctIdx >= 0 ? cols[correctIdx]?.toUpperCase() : undefined
    const letterToIdx: Record<string, string> = { A: '0', B: '1', C: '2', D: '3' }
    const rawIdx = correctLetter ? letterToIdx[correctLetter] : undefined
    const correctIndex =
      rawIdx !== undefined && options.length > parseInt(rawIdx) ? rawIdx : undefined

    const rawTimerCell = timerIdx >= 0 ? cols[timerIdx] : ''
    const rawTimer = timerIdx >= 0 ? parseInt(rawTimerCell) : DEFAULT_TIMER
    let timerSeconds: ValidTimer = DEFAULT_TIMER
    if ((VALID_TIMERS as readonly number[]).includes(rawTimer)) {
      timerSeconds = rawTimer as ValidTimer
    } else if (rawTimerCell.trim() !== '') {
      timerCoercions.add(rawTimerCell.trim())
    }

    const rawPointsCell = pointsIdx >= 0 ? cols[pointsIdx] : ''
    const rawPts = pointsIdx >= 0 ? parseInt(rawPointsCell) : DEFAULT_POINTS
    let points: ValidPoints = DEFAULT_POINTS
    if ((VALID_POINTS as readonly number[]).includes(rawPts)) {
      points = rawPts as ValidPoints
    } else if (rawPointsCell.trim() !== '') {
      pointsCoercions.add(rawPointsCell.trim())
    }

    questions.push({
      type: options.length > 0 ? 'mcq' : 'openended',
      text: questionText,
      options: options.length > 0 ? options : undefined,
      correctAnswer: correctIndex,
      timerSeconds,
      points,
    })
  }

  if (questions.length === 0) {
    return { questions: [], error: 'No valid questions found in the CSV. Check the format and try again.' }
  }

  const warnings: string[] = []
  if (timerCoercions.size > 0) {
    warnings.push(
      `${describeValues(timerCoercions)} isn't a supported timer — set to ${DEFAULT_TIMER}s. Use ${VALID_TIMERS.join(', ')}.`,
    )
  }
  if (pointsCoercions.size > 0) {
    warnings.push(
      `${describeValues(pointsCoercions)} isn't a supported points value — set to ${DEFAULT_POINTS}. Use ${VALID_POINTS.join(', ')}.`,
    )
  }

  return warnings.length > 0 ? { questions, warnings } : { questions }
}

function describeValues(values: Set<string>): string {
  const list = [...values]
  const shown = list.slice(0, MAX_WARNINGS).map(v => `"${v}"`).join(', ')
  const rest = list.length - MAX_WARNINGS
  return rest > 0 ? `${shown} and ${rest} other value${rest === 1 ? '' : 's'}` : shown
}
