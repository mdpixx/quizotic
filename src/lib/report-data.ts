// Server-side gatherer for session reports.
//
// One normalisation path for both live sessions and self-paced (async) quizzes,
// so the two export surfaces cannot drift apart again — they did before: the
// session CSV resolved the name-capture identity while the session XLSX didn't.
//
// Everything here is derived from the Answer rows rather than the cached
// results JSON wherever possible, because Answer carries three fields the
// cached stats never persisted: timeMs (average time per question), confidence
// (the mastery/misconception split), and the raw answer (the participant ×
// question grid).

import { prisma } from '@/lib/prisma'
import {
  RESULTS_RENDERER,
  getEffectiveOptions,
  getOptionText,
  isLeaderboardSlide,
  isScoredQuestion,
  type BloomsLevel,
  type MatchPair,
  type Question,
  type QuestionStat,
} from '@/lib/quiz-types'
import { isNameCaptureQuestion } from '@/lib/openended-input.mjs'
import {
  buildMisconceptionSummary,
  normalizeMatrixConfidence,
  type SessionMatrixData,
} from '@/lib/session-matrix'
import { buildTeacherReportInsights } from '@/lib/report-insights'
import {
  BLOOMS_ORDER,
  bloomsLabel,
  type SessionWorkbookData,
  type WorkbookBloomsRow,
  type WorkbookCell,
  type WorkbookParticipant,
  type WorkbookQuestion,
} from '@/lib/report-workbook'

// A matrix cell shows the participant's own answer. Long free-text runs to
// several hundred characters; 120 keeps the column readable while still
// showing enough to recognise a name, a code, or a short sentence.
const CELL_MAX = 120

const TYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple choice',
  multiselect: 'Multi-select',
  truefalse: 'True / false',
  fillblank: 'Fill in the blank',
  matching: 'Matching',
  poll: 'Poll',
  openended: 'Open ended',
  wordcloud: 'Word cloud',
  qa: 'Q&A',
  rating: 'Rating',
  ranking: 'Ranking',
  case: 'Case study',
  drawing: 'Drawing',
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function truncate(value: string, max = CELL_MAX): string {
  const clean = value.trim().replace(/\s+/g, ' ')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function letter(index: number): string {
  return String.fromCharCode(65 + index)
}

// ── Answer rendering ────────────────────────────────────────────────────────
// `Answer.answer` is Json: an option index for choice types, an array for
// multiselect/ranking/matching, a number for rating, a string for text types,
// and a data URL for drawings. Resolve each to something a human can read in a
// spreadsheet cell.

function renderAnswer(q: Question, options: string[], raw: unknown): string {
  if (raw == null) return ''

  if (q.type === 'drawing') return '(drawing)'

  if (q.type === 'multiselect') {
    const list = Array.isArray(raw) ? raw : [raw]
    const labels = list
      .map(v => parseInt(String(v), 10))
      .filter(n => Number.isInteger(n) && n >= 0 && n < options.length)
      .map(n => `${letter(n)}. ${options[n]}`)
    return truncate(labels.join(', '))
  }

  if (q.type === 'ranking') {
    if (!Array.isArray(raw)) return truncate(String(raw))
    const labels = raw
      .map(v => parseInt(String(v), 10))
      .filter(n => Number.isInteger(n) && n >= 0 && n < options.length)
      .map(n => options[n])
    return truncate(labels.join(' → '))
  }

  if (q.type === 'matching') {
    if (!Array.isArray(raw)) return truncate(String(raw))
    const pairs = Array.isArray(q.matchPairs) ? q.matchPairs : []
    const parts = raw.map((right, i) => `${pairs[i]?.left ?? `#${i + 1}`} → ${String(right)}`)
    return truncate(parts.join('; '))
  }

  if (q.type === 'rating') {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
    return Number.isInteger(n) ? String(n) : truncate(String(raw))
  }

  // Choice types store the option index. Text types store the text itself.
  if (options.length > 0 && (typeof raw === 'number' || /^\d+$/.test(String(raw)))) {
    const n = parseInt(String(raw), 10)
    if (Number.isInteger(n) && n >= 0 && n < options.length) return `${letter(n)}. ${options[n]}`
  }

  if (typeof raw === 'object') return truncate(JSON.stringify(raw))
  return truncate(String(raw))
}

// Which option indexes are the answer key — used to bold them on the Answer Key
// sheet. Mirrors the resolution order in the async report route.
function correctIndexesOf(q: Question, optionCount: number): number[] {
  const parse = (v: unknown) => parseInt(String(v), 10)
  if (q.type === 'multiselect') {
    const raw = q.correctAnswers ?? (q.correctAnswer != null ? [q.correctAnswer] : [])
    return (Array.isArray(raw) ? raw : [raw])
      .map(parse)
      .filter(n => Number.isInteger(n) && n >= 0 && n < optionCount)
  }
  if (q.correctAnswer != null && q.correctAnswer !== '') {
    const n = parse(q.correctAnswer)
    return Number.isInteger(n) && n >= 0 && n < optionCount ? [n] : []
  }
  return []
}

function correctAnswerTextOf(q: Question, options: string[]): string | null {
  if (!isScoredQuestion(q)) return null
  if (q.type === 'fillblank') {
    return Array.isArray(q.blankAnswers) && q.blankAnswers.length > 0 ? q.blankAnswers.join(' / ') : null
  }
  if (q.type === 'matching') {
    const pairs = Array.isArray(q.matchPairs) ? (q.matchPairs as MatchPair[]) : []
    return pairs.length > 0 ? pairs.map(p => `${p.left} → ${p.right}`).join('; ') : null
  }
  if (q.type === 'ranking') {
    const order = Array.isArray(q.correctOrder) ? q.correctOrder : []
    if (order.length === 0) return null
    return order.map(v => options[parseInt(String(v), 10)] ?? String(v)).join(' → ')
  }
  const idxs = correctIndexesOf(q, options.length)
  if (idxs.length === 0) return null
  return idxs.map(n => `${letter(n)}. ${options[n]}`).join(', ')
}

// ── Types ───────────────────────────────────────────────────────────────────

interface AnswerRow {
  attendeeId: string | null
  participantId: string
  questionIndex: number
  answer: unknown
  isCorrect: boolean | null
  points: number
  timeMs: number
  confidence: string | null
}

interface AttendeeRow {
  id: string
  nickname: string
  realName: string | null
  email: string | null
  team: string | null
  joinedAt: Date
  leftAt: Date | null
  durationSec: number | null
  finalScore: number
}

export class ReportDataError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ── Main gatherer ───────────────────────────────────────────────────────────

/**
 * Build the workbook payload for a session. `idOrCode` accepts the session id
 * or the six-digit room code — the host session end screen only knows the code,
 * which is why the old export links 404'd.
 */
export async function buildSessionWorkbookData(
  idOrCode: string,
  userId: string,
): Promise<SessionWorkbookData> {
  const session = await prisma.gameSession.findFirst({
    where: { userId, OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: { quizVersion: { select: { title: true, subject: true, snapshot: true } } },
  })
  if (!session) throw new ReportDataError('Session not found', 404)

  const [attendees, answers] = await Promise.all([
    prisma.attendee.findMany({
      where: { sessionId: session.id },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, nickname: true, realName: true, email: true, team: true,
        joinedAt: true, leftAt: true, durationSec: true, finalScore: true,
      },
    }),
    prisma.answer.findMany({
      where: { sessionId: session.id },
      select: {
        attendeeId: true, participantId: true, questionIndex: true, answer: true,
        isCorrect: true, points: true, timeMs: true, confidence: true,
      },
    }),
  ])

  const results = (session.results ?? null) as Record<string, unknown> | null
  const snapshot = session.quizVersion?.snapshot
  const questions: Question[] = Array.isArray(snapshot) ? (snapshot as unknown as Question[]) : []

  if (questions.length === 0 && !results) {
    throw new ReportDataError('No results available for this session', 404)
  }

  const cachedStats = (results?.questionStats as QuestionStat[] | undefined) ?? []

  return assemble({
    session: {
      id: session.id,
      code: session.code,
      hostName: session.hostName,
      mode: session.mode === 'async' ? 'async' : 'live',
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      participantCount: session.participantCount,
      title: session.quizVersion?.title ?? (results?.quizTitle as string | undefined) ?? 'Quiz session',
      subject: session.quizVersion?.subject ?? null,
      durationSec: (results?.duration as number | undefined) ?? null,
    },
    questions,
    cachedStats,
    attendees: attendees as AttendeeRow[],
    answers: answers as unknown as AnswerRow[],
  })
}

interface AssembleInput {
  session: {
    id: string
    code: string | null
    hostName: string | null
    mode: 'live' | 'async'
    createdAt: Date
    endedAt: Date | null
    participantCount: number | null
    title: string
    subject: string | null
    durationSec: number | null
  }
  questions: Question[]
  cachedStats: QuestionStat[]
  attendees: AttendeeRow[]
  answers: AnswerRow[]
}

// Exported for tests: pure given already-loaded rows.
export function assemble(input: AssembleInput): SessionWorkbookData {
  const { session, attendees, answers } = input

  // Questions come from the immutable session snapshot when available; a
  // session run before quizVersion existed falls back to the cached stats.
  const answerable = input.questions.length > 0
    ? input.questions
        .map((q, index) => ({ q, index }))
        .filter(({ q }) => q && typeof q === 'object' && !isLeaderboardSlide(q))
    : input.cachedStats
        .filter(s => !s.isLeaderboard && s.type !== 'leaderboard')
        .map(s => ({
          q: {
            id: String(s.index),
            type: (s.type ?? 'mcq') as Question['type'],
            text: s.text ?? `Question ${s.index + 1}`,
            options: s.options,
            bloomsLevel: s.bloomsLevel ?? undefined,
            explanation: s.explanation ?? undefined,
            timerSeconds: 0,
            points: 1000 as const,
          } as Question,
          index: s.index,
        }))

  const answersByIndex = new Map<number, AnswerRow[]>()
  for (const a of answers) {
    const list = answersByIndex.get(a.questionIndex)
    if (list) list.push(a)
    else answersByIndex.set(a.questionIndex, [a])
  }

  const participantTotal = Math.max(
    session.participantCount ?? 0,
    attendees.length,
    new Set(answers.map(a => a.attendeeId ?? `pid:${a.participantId}`)).size,
  )

  const cachedByIndex = new Map(input.cachedStats.map(s => [s.index, s]))

  // ── Questions ─────────────────────────────────────────────────────────────
  const wbQuestions: WorkbookQuestion[] = answerable.map(({ q, index }, position) => {
    const qAnswers = answersByIndex.get(index) ?? []
    const options = (getEffectiveOptions(q) ?? []).map(getOptionText)
    const scored = isScoredQuestion(q)
    const cached = cachedByIndex.get(index)

    const correct = qAnswers.filter(a => a.isCorrect === true).length
    const wrong = scored ? qAnswers.length - correct : 0
    const responses = qAnswers.length
    const accuracyPct = scored && responses > 0 ? Math.round((correct / responses) * 100) : null

    const timed = qAnswers.filter(a => a.timeMs > 0)
    const avgTimeSec = timed.length > 0
      ? Math.round(timed.reduce((s, a) => s + a.timeMs, 0) / timed.length / 1000)
      : null

    // Confidence quadrants from the raw answers. Falls back to the cached grid
    // for sessions whose answer rows predate the confidence column.
    let confidence = null as WorkbookQuestion['confidence']
    if (scored) {
      const grid = { sureCorrect: 0, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 }
      let any = false
      for (const a of qAnswers) {
        const c = normalizeMatrixConfidence(a.confidence)
        if (!c) continue
        any = true
        const right = a.isCorrect === true
        if (c === 'sure') {
          if (right) grid.sureCorrect++
          else grid.sureWrong++
        } else if (right) {
          grid.unsureCorrect++
        } else {
          grid.unsureWrong++
        }
      }
      confidence = any ? grid : (cached?.confidenceGrid ?? null)
    }

    const optionDistribution = new Array(options.length).fill(0)
    if (options.length > 0) {
      for (const a of qAnswers) {
        if (q.type === 'multiselect' && Array.isArray(a.answer)) {
          for (const v of a.answer as unknown[]) {
            const n = parseInt(String(v), 10)
            if (Number.isInteger(n) && n >= 0 && n < options.length) optionDistribution[n]++
          }
        } else if (q.type === 'rating' || RESULTS_RENDERER[q.type] === 'bars') {
          const n = typeof a.answer === 'number' ? a.answer : parseInt(String(a.answer), 10)
          if (Number.isInteger(n) && n >= 0 && n < options.length) optionDistribution[n]++
        }
      }
    }

    const base: WorkbookQuestion = {
      index,
      position: position + 1,
      text: q.text ?? `Question ${index + 1}`,
      type: q.type,
      typeLabel: typeLabel(q.type),
      isScored: scored,
      // Position, not raw index — matches the matrix route, so the wording
      // heuristic still fires on slide 1 of pre-flag sessions.
      isNameCapture: isNameCaptureQuestion(q, position),
      bloomsLevel: (q.bloomsLevel ?? null) as BloomsLevel | null,
      explanation: q.explanation ?? null,
      correctAnswerText: correctAnswerTextOf(q, options),
      options,
      optionDistribution,
      correctIndexes: correctIndexesOf(q, options.length),
      responses,
      correct,
      wrong,
      unattempted: Math.max(0, participantTotal - responses),
      accuracyPct,
      avgTimeSec,
      confidence,
    }

    if (scored) return base
    return { ...base, ...nonScoredPayload(q, qAnswers, options, attendees) }
  })

  // ── Participants ──────────────────────────────────────────────────────────
  const columnByIndex = new Map(wbQuestions.map((q, col) => [q.index, col]))
  const scoredCount = wbQuestions.filter(q => q.isScored).length

  const rows = new Map<string, WorkbookParticipant>()
  const blankCell = (): WorkbookCell => ({ state: 'blank', display: '', confidence: null, points: 0 })
  const emptyRow = (att?: AttendeeRow): WorkbookParticipant => ({
    rank: 0,
    name: att?.nickname ?? 'Unmatched participant',
    identity: att?.realName ?? null,
    email: att?.email ?? null,
    team: att?.team ?? null,
    score: 0,
    accuracyPct: null,
    correct: 0,
    wrong: 0,
    unattempted: scoredCount,
    answered: 0,
    timeSec: att?.durationSec ?? null,
    joinedAt: att?.joinedAt ?? null,
    leftAt: att?.leftAt ?? null,
    completed: Boolean(att?.leftAt),
    duplicateName: false,
    cells: wbQuestions.map(blankCell),
  })

  for (const att of attendees) rows.set(att.id, emptyRow(att))

  const questionByColumn = new Map(answerable.map(({ q }, col) => [col, q]))

  for (const a of answers) {
    const col = columnByIndex.get(a.questionIndex)
    if (col === undefined) continue
    const key = a.attendeeId && rows.has(a.attendeeId) ? a.attendeeId : `pid:${a.participantId}`
    let row = rows.get(key)
    if (!row) {
      row = emptyRow()
      rows.set(key, row)
    }
    const wbQ = wbQuestions[col]
    const sourceQ = questionByColumn.get(col)
    const state: WorkbookCell['state'] = !wbQ.isScored
      ? 'answered'
      : a.isCorrect === true ? 'correct' : 'wrong'

    row.cells[col] = {
      state,
      display: sourceQ ? renderAnswer(sourceQ, wbQ.options, a.answer) : truncate(String(a.answer ?? '')),
      confidence: normalizeMatrixConfidence(a.confidence),
      points: a.points,
    }
    row.score += a.points
    row.answered += 1
    if (wbQ.isScored) {
      if (a.isCorrect === true) row.correct += 1
      else row.wrong += 1
    }
    // The name-capture slide answer is the host's bridge from a typed nickname
    // back to a real person — promote it over the stored realName.
    if (sourceQ && isNameCaptureQuestion(sourceQ, col) && typeof a.answer === 'string') {
      const typed = a.answer.trim()
      if (typed) row.identity = typed
    }
  }

  const nameCounts = new Map<string, number>()
  for (const row of rows.values()) {
    const key = row.name.trim().toLowerCase()
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }

  const participants = Array.from(rows.values())
    .map(row => ({
      ...row,
      unattempted: Math.max(0, scoredCount - row.correct - row.wrong),
      accuracyPct: scoredCount > 0 ? Math.round((row.correct / scoredCount) * 100) : null,
      duplicateName: (nameCounts.get(row.name.trim().toLowerCase()) ?? 0) > 1,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((row, i) => ({ ...row, rank: i + 1 }))

  // ── Derived summaries ─────────────────────────────────────────────────────
  const matrixData: SessionMatrixData = {
    questions: wbQuestions.map(q => ({
      index: q.index,
      label: q.text.slice(0, 120),
      type: q.type,
      isScored: q.isScored,
    })),
    participants: participants.map(p => ({
      id: `${p.rank}-${p.name}`,
      name: p.name,
      score: p.score,
      correct: p.correct,
      answered: p.answered,
      accuracy: p.accuracyPct,
      cells: p.cells.map(c => (c.state === 'blank' ? null : c.state === 'correct' ? 1 : c.state === 'wrong' ? 0 : 2)),
      points: p.cells.map(c => c.points),
      confidences: p.cells.map(c => c.confidence),
    })),
    perQuestionAccuracy: wbQuestions.map(q => q.accuracyPct),
  }
  const misconceptionSummary = buildMisconceptionSummary(matrixData)

  const statsForInsights: QuestionStat[] = wbQuestions.map(q => ({
    index: q.index,
    text: q.text,
    type: q.type,
    correctPct: q.accuracyPct,
    confidenceGrid: q.confidence,
    bloomsLevel: q.bloomsLevel,
    explanation: q.explanation,
    isNonScored: !q.isScored,
    totalResponses: q.responses,
  }))

  const completedCount = participants.filter(p => p.completed).length
  const scoredQuestions = wbQuestions.filter(q => q.isScored && q.accuracyPct != null)
  const classAccuracyPct = scoredQuestions.length > 0
    ? Math.round(scoredQuestions.reduce((s, q) => s + (q.accuracyPct ?? 0), 0) / scoredQuestions.length)
    : null
  const avgScore = participants.length > 0
    ? Math.round(participants.reduce((s, p) => s + p.score, 0) / participants.length)
    : null

  return {
    meta: {
      quizTitle: session.title,
      subject: session.subject,
      code: session.code,
      hostName: session.hostName,
      mode: session.mode,
      startedAt: session.createdAt,
      endedAt: session.endedAt,
      durationSec: session.durationSec ?? durationFromAttendees(attendees, session),
      participantCount: participantTotal,
      questionCount: wbQuestions.length,
      classAccuracyPct,
      avgScore,
      completedCount,
      generatedAt: new Date(),
    },
    questions: wbQuestions,
    participants,
    misconceptions: misconceptionSummary.answerCount > 0 ? misconceptionSummary : null,
    blooms: rollUpBlooms(wbQuestions),
    insights: buildTeacherReportInsights({
      questionStats: statsForInsights,
      totalParticipants: participantTotal,
      finishedCount: completedCount || participants.length,
    }),
  }
}

function durationFromAttendees(attendees: AttendeeRow[], session: AssembleInput['session']): number | null {
  if (session.endedAt) {
    return Math.max(0, Math.round((session.endedAt.getTime() - session.createdAt.getTime()) / 1000))
  }
  const durations = attendees.map(a => a.durationSec).filter((v): v is number => typeof v === 'number')
  if (durations.length === 0) return null
  return Math.max(...durations)
}

function rollUpBlooms(questions: WorkbookQuestion[]): WorkbookBloomsRow[] {
  const tagged = questions.filter(q => q.bloomsLevel && q.isScored)
  if (tagged.length === 0) return []
  return BLOOMS_ORDER.flatMap(level => {
    const forLevel = tagged.filter(q => q.bloomsLevel === level)
    if (forLevel.length === 0) return []
    const correct = forLevel.reduce((s, q) => s + q.correct, 0)
    const wrong = forLevel.reduce((s, q) => s + q.wrong, 0)
    const total = correct + wrong
    return [{
      level,
      label: bloomsLabel(level),
      questionCount: forLevel.length,
      correct,
      wrong,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    }]
  })
}

// Poll / word cloud / rating / ranking / open-ended payloads. A scores-only
// export drops all of this — these slides show up as a bare "N/A" row today.
function nonScoredPayload(
  q: Question,
  qAnswers: AnswerRow[],
  options: string[],
  attendees: AttendeeRow[],
): Partial<WorkbookQuestion> {
  const renderer = RESULTS_RENDERER[q.type] ?? 'bars'
  const nameById = new Map(attendees.map(a => [a.id, a.nickname]))

  if (renderer === 'cloud') {
    const freq: Record<string, number> = {}
    for (const a of qAnswers) {
      for (const w of String(a.answer ?? '').toLowerCase().split(/\s+/).filter(t => t.length > 1)) {
        freq[w] = (freq[w] ?? 0) + 1
      }
    }
    return { wordFrequencies: freq }
  }

  if (renderer === 'list') {
    return {
      textResponses: qAnswers.map(a => ({
        name: a.attendeeId ? nameById.get(a.attendeeId) ?? null : null,
        answer: String(a.answer ?? ''),
      })),
    }
  }

  if (renderer === 'histogram') {
    const ratingMax = options.length || 5
    const histogram = new Array(ratingMax).fill(0)
    for (const a of qAnswers) {
      const n = typeof a.answer === 'number' ? a.answer : parseInt(String(a.answer), 10)
      if (Number.isInteger(n) && n >= 0 && n < ratingMax) histogram[n]++
    }
    const total = histogram.reduce((s: number, n: number) => s + n, 0)
    const ratingAverage = total > 0
      ? parseFloat((histogram.reduce((s: number, n: number, i: number) => s + n * (i + 1), 0) / total).toFixed(2))
      : null
    return { ratingHistogram: histogram, ratingAverage, ratingMax }
  }

  if (renderer === 'ordered') {
    const count = options.length
    const positionSums = new Array(count).fill(0)
    const firstPlace = new Array(count).fill(0)
    let respondents = 0
    for (const a of qAnswers) {
      if (!Array.isArray(a.answer) || a.answer.length !== count) continue
      respondents++
      ;(a.answer as unknown[]).forEach((itemIdx, pos) => {
        const n = parseInt(String(itemIdx), 10)
        if (Number.isInteger(n) && n >= 0 && n < count) {
          positionSums[n] += pos + 1
          if (pos === 0) firstPlace[n]++
        }
      })
    }
    return {
      rankingItems: options,
      rankingAverages: positionSums.map((s: number) => (respondents > 0 ? parseFloat((s / respondents).toFixed(2)) : 0)),
      rankingFirstPlaceCounts: firstPlace,
    }
  }

  return {}
}
