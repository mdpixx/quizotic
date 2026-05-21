export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAnswer, calcPoints, computeStreakBonus, isAsyncScoredType, toPublicQuestion, validateAnswer, type Question } from '@/lib/scoring'
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

    // Validate answer shape before any DB work
    const validated = validateAnswer(question, body.answer)
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error, code: validated.code }, { status: 400 })
    }

    const attendee = await prisma.attendee.findFirst({
      where: { id: attendeeId, sessionId: session.id },
      select: { id: true, leftAt: true, deadlineAt: true },
    })
    if (!attendee) {
      return NextResponse.json({ success: false, error: 'Invalid participant session' }, { status: 403 })
    }
    if (attendee.leftAt) {
      return NextResponse.json({ success: false, error: 'This attempt is already finished.' }, { status: 409 })
    }
    if (attendee.deadlineAt && new Date() > attendee.deadlineAt) {
      return NextResponse.json({ success: false, error: 'Time is up for this attempt.', code: 'time_up' }, { status: 410 })
    }

    // Idempotency: if answer already recorded, return cached result
    const existing = await prisma.answer.findFirst({
      where: { sessionId: session.id, participantId, questionIndex },
    })
    if (existing) {
      const isScored = isAsyncScoredType(question.type)
      const nextQ = questions[questionIndex + 1] ? { ...toPublicQuestion(questions[questionIndex + 1]), index: questionIndex + 1, total: questions.length } : null
      return NextResponse.json({
        success: true,
        data: {
          isCorrect: existing.isCorrect,
          points: existing.points,
          correctAnswer: isScored ? question.correctAnswer ?? null : null,
          correctAnswers: isScored ? question.correctAnswers ?? null : null,
          explanation: question.explanation ?? null,
          nextQuestion: nextQ,
        },
      })
    }

    // Server-side grading
    const isScored = isAsyncScoredType(question.type)
    const isCorrect = isScored ? checkAnswer(question, body.answer) : null
    const basePoints = isCorrect ? calcPoints(question.points, timeMs, question.timerSeconds) : 0

    // Streak: query prior answers in order
    const priorAnswers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      orderBy: { questionIndex: 'asc' },
      select: { isCorrect: true },
    })
    const priorCorrect = priorAnswers
      .filter(a => typeof a.isCorrect === 'boolean')
      .map(a => a.isCorrect ?? false)
    const streakBonus = isCorrect === null ? 0 : computeStreakBonus(priorCorrect, isCorrect)
    const totalPoints = basePoints + streakBonus

    await prisma.answer.create({
      data: {
        sessionId: session.id,
        attendeeId,
        participantId,
        questionIndex,
        answer: validated.value as Prisma.InputJsonValue,
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
        correctAnswer: isScored ? question.correctAnswer ?? null : null,
        correctAnswers: isScored ? question.correctAnswers ?? null : null,
        explanation: question.explanation ?? null,
        nextQuestion: nextQ,
      },
    })
  } catch (err) {
    console.error('[async/answer:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
