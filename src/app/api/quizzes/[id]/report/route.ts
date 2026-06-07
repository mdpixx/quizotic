export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { RESULTS_RENDERER, getEffectiveOptions, getOptionText, isScoredQuestion, type Question, type QuestionStat } from '@/lib/quiz-types'
import type { Prisma } from '@prisma/client'
import { buildTeacherReportInsights } from '@/lib/report-insights'

type Params = { params: Promise<{ id: string }> }

type AnswerRow = {
  questionIndex: number
  isCorrect: boolean | null
  points: number
  attendeeId: string | null
  answer: Prisma.JsonValue
  submittedAt: Date
}

type AttendeeRow = {
  id: string
  nickname: string
  joinedAt: Date
  leftAt: Date | null
  finalScore: number
}

type LeaderboardEntry = {
  name: string
  score: number
  correctCount: number
  answeredCount: number
  accuracy: number | null
  status: 'finished' | 'in_progress'
  timeSec: number | null
}

// GET /api/quizzes/[id]/report — teacher report for an async quiz
// ?format=csv → CSV download (Pro only)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const csv = new URL(req.url).searchParams.get('format') === 'csv'

    // Get the async session with its quiz version
    const session = await prisma.gameSession.findFirst({
      where: { quizId: id, userId: user.id, mode: 'async' },
      select: {
        id: true,
        shareSlug: true,
        status: true,
        allowRetries: true,
        closesAt: true,
        participantCount: true,
        createdAt: true,
        quizVersion: { select: { title: true, subject: true, questionCount: true, snapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: 'No async session found for this quiz' }, { status: 404 })
    }

    // Pro gate for CSV export
    if (csv) {
      const plan = await getUserPlan(user.id)
      if (plan === 'free') {
        return NextResponse.json({ success: false, error: 'CSV export is a Pro feature' }, { status: 403 })
      }
    }

    const questions = (session.quizVersion?.snapshot as Question[] | null) ?? []

    // Fetch attendees and answers in parallel
    const [attendees, rawAnswers] = await Promise.all([
      prisma.attendee.findMany({
        where: { sessionId: session.id },
        select: { id: true, nickname: true, joinedAt: true, leftAt: true, finalScore: true },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.answer.findMany({
        where: { sessionId: session.id },
        select: { questionIndex: true, isCorrect: true, points: true, attendeeId: true, answer: true, submittedAt: true },
      }),
    ])

    const answers = rawAnswers as AnswerRow[]

    // ── Leaderboard ─────────────────────────────────────────────────────────────

    // Group answers by attendeeId to compute live score per attendee
    const scoreByAttendee = new Map<string, { score: number; correct: number; answered: number }>()
    for (const a of answers) {
      if (!a.attendeeId) continue
      const cur = scoreByAttendee.get(a.attendeeId) ?? { score: 0, correct: 0, answered: 0 }
      cur.score += a.points
      if (a.isCorrect === true) cur.correct++
      cur.answered++
      scoreByAttendee.set(a.attendeeId, cur)
    }

    const leaderboard: LeaderboardEntry[] = (attendees as AttendeeRow[])
      .map(att => {
        const stats = scoreByAttendee.get(att.id) ?? { score: 0, correct: 0, answered: 0 }
        const status: 'finished' | 'in_progress' = att.leftAt ? 'finished' : 'in_progress'
        const timeSec = att.leftAt
          ? Math.round((att.leftAt.getTime() - att.joinedAt.getTime()) / 1000)
          : null
        const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null
        return { name: att.nickname, score: stats.score, correctCount: stats.correct, answeredCount: stats.answered, accuracy, status, timeSec }
      })
      .sort((a, b) => b.score - a.score)

    // ── Summary ─────────────────────────────────────────────────────────────────

    const finished = leaderboard.filter(e => e.status === 'finished')
    const totalResponses = attendees.length
    const avgScore = finished.length > 0
      ? Math.round(finished.reduce((s, e) => s + e.score, 0) / finished.length)
      : null
    const avgAccuracy = finished.length > 0
      ? Math.round(finished.reduce((s, e) => s + (e.accuracy ?? 0), 0) / finished.length)
      : null

    // ── Per-question stats ───────────────────────────────────────────────────────

    const answersByIndex = new Map<number, AnswerRow[]>()
    for (const a of answers) {
      const arr = answersByIndex.get(a.questionIndex) ?? []
      arr.push(a)
      answersByIndex.set(a.questionIndex, arr)
    }

    // Name lookup for drawing thumbnails (attendeeId → nickname)
    const nameByAttendee = new Map(attendees.map(a => [a.id, a.nickname]))

    const questionStats: QuestionStat[] = questions.map((q, i) => {
      const qAnswers = answersByIndex.get(i) ?? []
      const totalResponses = qAnswers.length
      const renderer = RESULTS_RENDERER[q.type] ?? 'bars'
      const opts = getEffectiveOptions(q)
      const optLabels = opts?.map(o => getOptionText(o)) ?? []
      const optCount = optLabels.length
      const isScored = isScoredQuestion(q)

      const correctCount = qAnswers.filter(a => a.isCorrect === true).length
      const correctPct = totalResponses > 0 && isScored
        ? Math.round((correctCount / totalResponses) * 100)
        : null

      const base: Partial<QuestionStat> = {
        index: i,
        text: q.text,
        type: q.type,
        correctPct,
        confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null,
        explanation: q.explanation ?? null,
        isNonScored: !isScored,
        totalResponses,
      }

      if (renderer === 'bars') {
        const dist = new Array(optCount).fill(0)
        for (const a of qAnswers) {
          if (q.type === 'multiselect' && Array.isArray(a.answer)) {
            for (const idx of a.answer as string[]) {
              const n = parseInt(String(idx), 10)
              if (n >= 0 && n < optCount) dist[n]++
            }
          } else {
            const n = typeof a.answer === 'number' ? a.answer : parseInt(String(a.answer), 10)
            if (Number.isInteger(n) && n >= 0 && n < optCount) dist[n]++
          }
        }
        return { ...base, options: optLabels, optionDistribution: dist } as QuestionStat
      }

      if (renderer === 'cloud') {
        const freq: Record<string, number> = {}
        for (const a of qAnswers) {
          const words = String(a.answer).toLowerCase().split(/\s+/).filter(w => w.length > 1)
          for (const w of words) freq[w] = (freq[w] ?? 0) + 1
        }
        return { ...base, wordFrequencies: freq } as QuestionStat
      }

      if (renderer === 'list') {
        const textResponses = qAnswers.slice(0, 200).map(a => ({ answer: String(a.answer) }))
        return { ...base, textResponses } as QuestionStat
      }

      if (renderer === 'histogram') {
        const ratingMax = optCount || 5
        const histogram = new Array(ratingMax).fill(0)
        for (const a of qAnswers) {
          const n = typeof a.answer === 'number' ? a.answer : parseInt(String(a.answer), 10)
          if (Number.isInteger(n) && n >= 0 && n < ratingMax) histogram[n]++
        }
        const total = histogram.reduce((s, c) => s + c, 0)
        const ratingAverage = total > 0
          ? parseFloat((histogram.reduce((s, c, idx) => s + c * (idx + 1), 0) / total).toFixed(2))
          : null
        return { ...base, ratingHistogram: histogram, ratingAverage, ratingMax } as QuestionStat
      }

      if (renderer === 'ordered') {
        const rankingItems = optLabels
        const positionSums = new Array(optCount).fill(0)
        const firstPlaceCounts = new Array(optCount).fill(0)
        let respondents = 0
        for (const a of qAnswers) {
          if (!Array.isArray(a.answer)) continue
          const order = a.answer as number[]
          if (order.length !== optCount) continue
          respondents++
          for (let pos = 0; pos < order.length; pos++) {
            const itemIdx = order[pos]
            if (typeof itemIdx === 'number' && itemIdx >= 0 && itemIdx < optCount) {
              positionSums[itemIdx] += pos + 1
              if (pos === 0) firstPlaceCounts[itemIdx]++
            }
          }
        }
        const rankingAverages = positionSums.map(s => respondents > 0 ? parseFloat((s / respondents).toFixed(2)) : 0)
        const correctOrder = Array.isArray(q.correctOrder) && q.correctOrder.length > 0
          ? q.correctOrder
          : undefined
        return {
          ...base,
          rankingItems,
          rankingAverages,
          rankingFirstPlaceCounts: firstPlaceCounts,
          correctOrder,
          fullCorrectCount: correctOrder ? correctCount : undefined,
        } as QuestionStat
      }

      if (renderer === 'grid') {
        const drawingThumbnails = qAnswers.slice(0, 50).map(a => ({
          name: a.attendeeId ? nameByAttendee.get(a.attendeeId) : undefined,
          dataUrl: String(a.answer),
        }))
        return { ...base, drawingThumbnails } as QuestionStat
      }

      // inner (case) and fallback — treat as bars with the question's options
      return { ...base, options: optLabels, optionDistribution: new Array(optCount).fill(0) } as QuestionStat
    })

    // ── CSV export ───────────────────────────────────────────────────────────────

    if (csv) {
      const rows = [
        'Name,Score,Correct,Answered,Accuracy,Status,TimeSec',
        ...leaderboard.map(e =>
          [e.name, e.score, e.correctCount, e.answeredCount,
           e.accuracy !== null ? `${e.accuracy}%` : '',
           e.status,
           e.timeSec ?? ''].join(',')
        ),
      ].join('\n')
      return new Response(rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="quiz-report-${id}.csv"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        quizId: id,
        sessionId: session.id,
        title: session.quizVersion?.title ?? 'Quiz',
        subject: session.quizVersion?.subject ?? null,
        shareSlug: session.shareSlug,
        status: session.status,
        closesAt: session.closesAt,
        createdAt: session.createdAt,
        summary: { totalResponses, finishedCount: finished.length, avgScore, avgAccuracy },
        leaderboard,
        questionStats,
        insights: buildTeacherReportInsights({
          questionStats,
          totalParticipants: totalResponses,
          finishedCount: finished.length,
        }),
      },
    })
  } catch (err) {
    console.error('[report:GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
