export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { isAsyncScoredType, ASYNC_PARTICIPATION_TYPES, type Question } from '@/lib/scoring'

type Params = { params: Promise<{ slug: string }> }

// POST /api/async/[slug]/finish
// Body: { participantId, attendeeId }
// Finalizes the Attendee row and returns a personal learning summary.
export async function POST(req: NextRequest, { params }: Params) {
  const rl = await rateLimitRequest(req, { bucket: 'async-finish', ipLimit: 30, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) return rateLimitResponse(rl)

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
      select: { id: true, mode: true, quizVersion: { select: { questionCount: true, snapshot: true } } },
    })
    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }

    const attendee = await prisma.attendee.findFirst({
      where: { id: attendeeId, sessionId: session.id },
      select: { id: true, leftAt: true, finalScore: true },
    })
    if (!attendee) {
      return NextResponse.json({ success: false, error: 'Invalid participant session' }, { status: 403 })
    }

    // Sum all Answer points for this participant
    const answers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      select: { points: true, isCorrect: true, questionIndex: true },
    })
    const finalScore = answers.reduce((s, a) => s + a.points, 0)
    const correctCount = answers.filter(a => a.isCorrect === true).length
    const answeredCount = answers.length
    const snapshot = (session.quizVersion?.snapshot as Question[] | null) ?? []
    const questionCount = session.quizVersion?.questionCount ?? answeredCount
    const scoredQuestionCount = snapshot.filter(q => isAsyncScoredType(q.type)).length
    const answeredIndexSet = new Set(answers.map(a => a.questionIndex))
    const participationAnsweredCount = snapshot.filter(
      (q, i) => answeredIndexSet.has(i) && ASYNC_PARTICIPATION_TYPES.has(q.type),
    ).length

    const now = new Date()
    const finalized = await prisma.attendee.updateMany({
      where: { id: attendeeId, sessionId: session.id, leftAt: null },
      data: { leftAt: now, finalScore },
    })
    if (finalized.count > 0) {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { participantCount: { increment: 1 } },
      })
    }

    return NextResponse.json({ success: true, data: { finalScore, correctCount, answeredCount, questionCount, scoredQuestionCount, participationAnsweredCount } })
  } catch (err) {
    console.error('[async/finish:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
