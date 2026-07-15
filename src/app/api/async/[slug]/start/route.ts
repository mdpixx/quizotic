export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { toPublicQuestion, type Question } from '@/lib/scoring'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { nudgeAsyncSweep } from '@/lib/sweep-nudge'

type Params = { params: Promise<{ slug: string }> }

// POST /api/async/[slug]/start
// Body: { name: string, existingParticipantId?: string }
// Returns first question (stripped) + fresh participantId + attendeeId
export async function POST(req: NextRequest, { params }: Params) {
  // Rate limit: 15 starts per 10 min per IP (anti-abuse for public endpoint)
  const rl = await rateLimitRequest(req, { bucket: 'async-start', ipLimit: 15, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) return rateLimitResponse(rl, 'Too many attempts. Please try again in a few minutes.')

  try {
    const { slug } = await params
    const body = await req.json() as Record<string, unknown>

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 50) : ''
    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })

    const existingParticipantId = typeof body.existingParticipantId === 'string' ? body.existingParticipantId : null

    const session = await prisma.gameSession.findUnique({
      where: { shareSlug: slug },
      include: { quizVersion: { select: { snapshot: true, questionCount: true } } },
    })

    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }
    if (session.status !== 'open') {
      return NextResponse.json({ success: false, error: 'This quiz has ended', code: 'closed' }, { status: 410 })
    }
    if (session.opensAt && new Date() < session.opensAt) {
      // Server-authoritative gate — the countdown screen is cosmetic.
      return NextResponse.json({
        success: false,
        error: 'This quiz has not opened yet',
        code: 'not_open_yet',
        opensAt: session.opensAt,
        serverNow: new Date().toISOString(),
      }, { status: 403 })
    }
    if (session.closesAt && new Date() > session.closesAt) {
      return NextResponse.json({ success: false, error: 'This quiz has closed', code: 'closed' }, { status: 410 })
    }

    // Response cap (free tier)
    if (session.userId) {
      const plan = await getUserPlan(session.userId)
      const cap = PLAN_LIMITS[plan].maxAsyncResponsesPerQuiz
      if (cap !== Infinity) {
        const responseCount = await prisma.attendee.count({ where: { sessionId: session.id } })
        if (responseCount >= cap) {
          return NextResponse.json({ success: false, error: 'This quiz has reached its response limit.' }, { status: 403 })
        }
      }
    }

    // Single-attempt enforcement: block if this participantId already has answers
    if (!session.allowRetries && existingParticipantId) {
      const priorAnswers = await prisma.answer.count({
        where: { sessionId: session.id, participantId: existingParticipantId },
      })
      if (priorAnswers > 0) {
        return NextResponse.json({ success: false, error: 'already_completed', message: "You've already completed this quiz." }, { status: 409 })
      }
    }

    const deadlineAt = session.timeLimitMinutes
      ? new Date(Date.now() + session.timeLimitMinutes * 60 * 1000)
      : null

    const attendee = await prisma.attendee.create({
      data: { sessionId: session.id, nickname: name, realName: name, deadlineAt },
    })
    // A fresh attempt deadline may be the sweeper's next wake-up point.
    if (deadlineAt) nudgeAsyncSweep()

    const participantId = randomUUID()
    const questions = (session.quizVersion?.snapshot as Question[] | null) ?? []
    const firstQ = questions[0] ? toPublicQuestion(questions[0]) : null

    return NextResponse.json({
      success: true,
      data: {
        attendeeId: attendee.id,
        participantId,
        total: questions.length,
        deadlineAt,
        question: firstQ ? { ...firstQ, index: 0, total: questions.length } : null,
      },
    })
  } catch (err) {
    console.error('[async/start:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
