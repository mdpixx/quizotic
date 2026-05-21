export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toPublicQuestion, type Question } from '@/lib/scoring'

type Params = { params: Promise<{ slug: string }> }

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
    const questionCount = session.quizVersion?.questionCount ?? questions.length

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
        select: { points: true, isCorrect: true },
      })
      const finalScore = answers.reduce((s, a) => s + a.points, 0)
      const finalized = await prisma.attendee.updateMany({
        where: { id: attendeeId, sessionId: session.id, leftAt: null },
        data: { leftAt: new Date(), finalScore },
      })
      if (finalized.count > 0) {
        await prisma.gameSession.update({ where: { id: session.id }, data: { participantCount: { increment: 1 } } })
      }
      return NextResponse.json({
        success: true,
        data: {
          status: 'time_up',
          result: {
            finalScore,
            correctCount: answers.filter(a => a.isCorrect === true).length,
            answeredCount: answers.length,
            questionCount,
          },
        },
      })
    }

    // Session closed — player cannot continue
    if (session.status !== 'open' || (session.closesAt && new Date() > session.closesAt)) {
      return NextResponse.json({ success: true, data: { status: 'closed' } })
    }

    // In progress — find next unanswered question
    const answers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      select: { questionIndex: true },
    })
    const answeredIndices = new Set(answers.map(a => a.questionIndex))
    const nextIndex = questions.findIndex((_, i) => !answeredIndices.has(i))
    const nextQuestion = nextIndex >= 0
      ? { ...toPublicQuestion(questions[nextIndex]), index: nextIndex, total: questionCount }
      : null

    return NextResponse.json({
      success: true,
      data: {
        status: 'in_progress',
        deadlineAt: attendee.deadlineAt,
        answeredCount: answeredIndices.size,
        total: questionCount,
        nextQuestion,
        result: null,
      },
    })
  } catch (err) {
    console.error('[async/state:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
