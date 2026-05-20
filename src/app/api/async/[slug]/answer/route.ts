export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnswer, calcPoints, computeStreakBonus, toPublicQuestion, type Question } from '@/lib/scoring'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import type { Prisma } from '@prisma/client'

type Params = { params: Promise<{ slug: string }> }

// POST /api/async/[slug]/answer
// Body: { participantId, attendeeId, questionIndex, answer, timeMs }
export async function POST(req: NextRequest, { params }: Params) {
  const rl = await rateLimitRequest(req, { bucket: 'async-answer', ipLimit: 120, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { slug } = await params
    const body = await req.json() as Record<string, unknown>

    const participantId = typeof body.participantId === 'string' ? body.participantId : null
    const attendeeId = typeof body.attendeeId === 'string' ? body.attendeeId : null
    const questionIndex = typeof body.questionIndex === 'number' ? body.questionIndex : -1
    const timeMs = typeof body.timeMs === 'number' ? Math.max(0, body.timeMs) : 0

    if (!participantId || !attendeeId || questionIndex < 0 || body.answer === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const session = await prisma.gameSession.findUnique({
      where: { shareSlug: slug },
      include: { quizVersion: { select: { snapshot: true } } },
    })

    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }
    if (session.status !== 'open' || (session.closesAt && new Date() > session.closesAt)) {
      return NextResponse.json({ success: false, error: 'Quiz is no longer available', code: 'closed' }, { status: 410 })
    }

    const questions = (session.quizVersion?.snapshot as Question[] | null) ?? []
    const question = questions[questionIndex]
    if (!question) return NextResponse.json({ success: false, error: 'Invalid question index' }, { status: 400 })

    const attendee = await prisma.attendee.findFirst({
      where: { id: attendeeId, sessionId: session.id },
      select: { id: true, leftAt: true },
    })
    if (!attendee) {
      return NextResponse.json({ success: false, error: 'Invalid participant session' }, { status: 403 })
    }
    if (attendee.leftAt) {
      return NextResponse.json({ success: false, error: 'This attempt is already finished.' }, { status: 409 })
    }

    // Idempotency: if answer already recorded, return cached result
    const existing = await prisma.answer.findFirst({
      where: { sessionId: session.id, participantId, questionIndex },
    })
    if (existing) {
      const nextQ = questions[questionIndex + 1] ? { ...toPublicQuestion(questions[questionIndex + 1]), index: questionIndex + 1, total: questions.length } : null
      return NextResponse.json({
        success: true,
        data: {
          isCorrect: existing.isCorrect,
          points: existing.points,
          correctAnswer: question.correctAnswer,
          correctAnswers: question.correctAnswers,
          explanation: question.explanation ?? null,
          nextQuestion: nextQ,
        },
      })
    }

    // Server-side grading
    const isCorrect = checkAnswer(question, body.answer)
    const basePoints = isCorrect ? calcPoints(question.points, timeMs, question.timerSeconds) : 0

    // Streak: query prior answers in order
    const priorAnswers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      orderBy: { questionIndex: 'asc' },
      select: { isCorrect: true },
    })
    const priorCorrect = priorAnswers.map(a => a.isCorrect ?? false)
    const streakBonus = computeStreakBonus(priorCorrect, isCorrect)
    const totalPoints = basePoints + streakBonus

    await prisma.answer.create({
      data: {
        sessionId: session.id,
        attendeeId,
        participantId,
        questionIndex,
        answer: body.answer as Prisma.InputJsonValue,
        isCorrect,
        basePoints,
        streakBonus,
        points: totalPoints,
        timeMs,
      },
    })

    const nextQ = questions[questionIndex + 1]
      ? { ...toPublicQuestion(questions[questionIndex + 1]), index: questionIndex + 1, total: questions.length }
      : null

    return NextResponse.json({
      success: true,
      data: {
        isCorrect,
        points: totalPoints,
        correctAnswer: question.correctAnswer ?? null,
        correctAnswers: question.correctAnswers ?? null,
        explanation: question.explanation ?? null,
        nextQuestion: nextQ,
      },
    })
  } catch (err) {
    console.error('[async/answer:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
