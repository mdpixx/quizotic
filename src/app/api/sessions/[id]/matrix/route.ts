export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { isScoredQuestion, isLeaderboardSlide, type Question } from '@/lib/quiz-types'

// GET /api/sessions/[id]/matrix — participant × question pivot for reports.
// Cell codes: 1 = correct, 0 = wrong, 2 = answered (non-scored), null = unattempted.
export type MatrixCell = 1 | 0 | 2 | null

export interface MatrixQuestion {
  index: number // original questionIndex in the quiz (answers key off this)
  label: string
  type: string
  isScored: boolean
}

export interface MatrixParticipant {
  id: string
  name: string
  score: number
  correct: number
  answered: number
  accuracy: number | null // % of scored questions answered correctly (unattempted count as missed)
  cells: MatrixCell[]
  points: number[]
}

interface QuestionStatLike {
  index: number
  text?: string
  type?: string
  isNonScored?: boolean
  isLeaderboard?: boolean
}

function questionsFromSnapshot(snapshot: unknown): MatrixQuestion[] | null {
  if (!Array.isArray(snapshot)) return null
  return (snapshot as Question[])
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => q && typeof q === 'object' && !isLeaderboardSlide(q))
    .map(({ q, index }) => ({
      index,
      label: typeof q.text === 'string' ? q.text.slice(0, 120) : `Question ${index + 1}`,
      type: q.type ?? 'mcq',
      isScored: isScoredQuestion(q),
    }))
}

function questionsFromStats(stats: unknown): MatrixQuestion[] | null {
  if (!Array.isArray(stats)) return null
  return (stats as QuestionStatLike[])
    .filter(s => s && typeof s.index === 'number' && !s.isLeaderboard && s.type !== 'leaderboard')
    .map(s => ({
      index: s.index,
      label: s.text ? String(s.text).slice(0, 120) : `Question ${s.index + 1}`,
      type: s.type ?? 'mcq',
      isScored: s.isNonScored !== true,
    }))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const session = await prisma.gameSession.findFirst({
      where: { userId: user.id, OR: [{ id }, { code: id }] },
      include: { quizVersion: { select: { snapshot: true } } },
    })
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const [attendees, answers] = await Promise.all([
      prisma.attendee.findMany({
        where: { sessionId: session.id },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: { id: true, nickname: true, finalScore: true },
      }),
      prisma.answer.findMany({
        where: { sessionId: session.id },
        select: { attendeeId: true, participantId: true, questionIndex: true, isCorrect: true, points: true },
      }),
    ])

    // Question headers: prefer the immutable session snapshot, fall back to the
    // persisted questionStats, finally derive bare labels from answer indexes.
    const results = (session.results ?? null) as { questionStats?: unknown } | null
    let questions =
      questionsFromSnapshot(session.quizVersion?.snapshot) ??
      questionsFromStats(results?.questionStats) ??
      null
    if (!questions) {
      const maxIndex = answers.reduce((m, a) => Math.max(m, a.questionIndex), -1)
      questions = Array.from({ length: maxIndex + 1 }, (_, index) => ({
        index,
        label: `Question ${index + 1}`,
        type: 'mcq',
        isScored: true,
      }))
    }

    // Map original questionIndex → column position (leaderboard slides removed).
    const columnByIndex = new Map<number, number>()
    questions.forEach((q, col) => columnByIndex.set(q.index, col))
    const scoredTotal = questions.filter(q => q.isScored).length

    const emptyRow = (rowId: string, name: string): MatrixParticipant => ({
      id: rowId,
      name,
      score: 0,
      correct: 0,
      answered: 0,
      accuracy: null,
      cells: questions.map(() => null),
      points: questions.map(() => 0),
    })

    const rows = new Map<string, MatrixParticipant>()
    for (const att of attendees) {
      rows.set(att.id, emptyRow(att.id, att.nickname))
    }

    // Answers whose attendee row is missing (best-effort attendee insert failed)
    // still surface, grouped by their durable participantId.
    const correctByCol = questions.map(() => 0)
    const wrongByCol = questions.map(() => 0)
    for (const a of answers) {
      const col = columnByIndex.get(a.questionIndex)
      if (col === undefined) continue
      const key = a.attendeeId && rows.has(a.attendeeId) ? a.attendeeId : `pid:${a.participantId}`
      let row = rows.get(key)
      if (!row) {
        row = emptyRow(key, 'Unmatched participant')
        rows.set(key, row)
      }
      const scored = questions[col].isScored
      row.cells[col] = scored ? (a.isCorrect === true ? 1 : 0) : 2
      row.points[col] = a.points
      row.score += a.points
      row.answered += 1
      if (scored) {
        if (a.isCorrect === true) {
          row.correct += 1
          correctByCol[col] += 1
        } else {
          wrongByCol[col] += 1
        }
      }
    }

    const participants = Array.from(rows.values())
      .map(row => ({
        ...row,
        accuracy: scoredTotal > 0 ? Math.round((row.correct / scoredTotal) * 100) : null,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    // Per-question accuracy over those who answered (unattempted excluded).
    const perQuestionAccuracy = questions.map((q, col) => {
      if (!q.isScored) return null
      const total = correctByCol[col] + wrongByCol[col]
      return total > 0 ? Math.round((correctByCol[col] / total) * 100) : null
    })

    return NextResponse.json({
      success: true,
      data: { questions, participants, perQuestionAccuracy },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to build matrix' }, { status: 500 })
  }
}
