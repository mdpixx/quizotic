export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { answerableCount, toServedQuestion, type Question } from '@/lib/scoring'
import { isLeaderboardSlide } from '@/lib/quiz-types'

type Params = { params: Promise<{ slug: string }> }

type AnswerRow = { questionIndex: number; points: number; isCorrect: boolean | null }

// Marks the attempt finished exactly once (leftAt guard) and bumps the
// session participant count only for the request that won the race.
async function finalizeAttempt(sessionId: string, attendeeId: string, answers: AnswerRow[]) {
  const finalScore = answers.reduce((s, a) => s + a.points, 0)
  const finalized = await prisma.attendee.updateMany({
    where: { id: attendeeId, sessionId, leftAt: null },
    data: { leftAt: new Date(), finalScore },
  })
  if (finalized.count > 0) {
    await prisma.gameSession.update({ where: { id: sessionId }, data: { participantCount: { increment: 1 } } })
  }
  return {
    finalScore,
    correctCount: answers.filter(a => a.isCorrect === true).length,
    answeredCount: answers.length,
  }
}

// POST /api/async/[slug]/state
// Body: { participantId, attendeeId }
// Returns current attempt status so the player can resume after refresh/close.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params
    const body = await req.json() as Record<string, unknown>

    const participantId = typeof body.participantId === 'string' ? body.participantId : null
    const attendeeId = typeof body.attendeeId === 'string' ? body.attendeeId : null

    if (!participantId || !attendeeId) {
      return NextResponse.json({ success: false, error: 'Missing participantId or attendeeId' }, { status: 400 })
    }

    const session = await prisma.gameSession.findUnique({
      where: { shareSlug: slug },
      select: {
        id: true,
        mode: true,
        status: true,
        closesAt: true,
        quizVersion: { select: { snapshot: true, questionCount: true } },
      },
    })

    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }

    const attendee = await prisma.attendee.findFirst({
      where: { id: attendeeId, sessionId: session.id },
      select: { id: true, leftAt: true, finalScore: true, deadlineAt: true },
    })

    if (!attendee) {
      return NextResponse.json({ success: false, error: 'Invalid attendee' }, { status: 403 })
    }

    const questions = (session.quizVersion?.snapshot as Question[] | null) ?? []
    // Leaderboard flow slides are never served async, so every count the
    // player sees must exclude them.
    const questionCount = questions.length > 0
      ? answerableCount(questions)
      : (session.quizVersion?.questionCount ?? 0)

    // Already finished — return result regardless of session state
    if (attendee.leftAt) {
      const answers = await prisma.answer.findMany({
        where: { sessionId: session.id, participantId },
        select: { points: true, isCorrect: true },
      })
      const finalScore = attendee.finalScore ?? 0
      return NextResponse.json({
        success: true,
        data: {
          status: 'finished',
          result: {
            finalScore,
            correctCount: answers.filter(a => a.isCorrect === true).length,
            answeredCount: answers.length,
            questionCount,
          },
        },
      })
    }

    // Timed out — auto-finalize and return
    if (attendee.deadlineAt && new Date() > attendee.deadlineAt) {
      const answers = await prisma.answer.findMany({
        where: { sessionId: session.id, participantId },
        select: { questionIndex: true, points: true, isCorrect: true },
      })
      const result = await finalizeAttempt(session.id, attendeeId, answers)
      return NextResponse.json({
        success: true,
        data: { status: 'time_up', result: { ...result, questionCount } },
      })
    }

    // Session closed — player cannot continue
    if (session.status !== 'open' || (session.closesAt && new Date() > session.closesAt)) {
      return NextResponse.json({ success: true, data: { status: 'closed' } })
    }

    // In progress — find next unanswered answerable question (never a slide)
    const answers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      select: { questionIndex: true, points: true, isCorrect: true },
    })
    const answeredIndices = new Set(answers.map(a => a.questionIndex))
    const nextIndex = questions.findIndex((q, i) => !answeredIndices.has(i) && !isLeaderboardSlide(q))

    // Every answerable question answered (only slides remain, e.g. a trailing
    // auto-leaderboard): finalize here. Returning in_progress with a null
    // nextQuestion would send the client back to the entry form and let it
    // create a duplicate attempt.
    if (nextIndex === -1) {
      const result = await finalizeAttempt(session.id, attendeeId, answers)
      return NextResponse.json({
        success: true,
        data: { status: 'finished', result: { ...result, questionCount } },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'in_progress',
        deadlineAt: attendee.deadlineAt,
        answeredCount: answeredIndices.size,
        total: questionCount,
        nextQuestion: toServedQuestion(questions, nextIndex),
        result: null,
      },
    })
  } catch (err) {
    console.error('[async/state:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
