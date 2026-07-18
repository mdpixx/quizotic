export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { answerableCount, type Question } from '@/lib/scoring'

type Params = { params: Promise<{ slug: string }> }

function isExpired(session: { closesAt: Date | null }): boolean {
  return session.closesAt !== null && new Date() > session.closesAt
}

// GET /api/async/[slug] — public quiz info (no answers exposed)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params

    const session = await prisma.gameSession.findUnique({
      where: { shareSlug: slug },
      select: {
        id: true,
        mode: true,
        status: true,
        allowRetries: true,
        opensAt: true,
        closesAt: true,
        timeLimitMinutes: true,
        quizVersion: { select: { title: true, questionCount: true, subject: true, snapshot: true } },
      },
    })

    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }
    if (session.status !== 'open' || isExpired(session)) {
      return NextResponse.json({ success: false, error: 'Quiz is no longer available', code: 'closed' }, { status: 410 })
    }

    // Scheduled and not yet open: metadata only, so the page can render a
    // countdown. serverNow lets the client compute remaining time without
    // trusting its own clock.
    if (session.opensAt && new Date() < session.opensAt) {
      return NextResponse.json({
        success: true,
        data: {
          state: 'scheduled',
          title: session.quizVersion?.title ?? 'Quiz',
          subject: session.quizVersion?.subject ?? null,
          questionCount: session.quizVersion?.questionCount ?? 0,
          opensAt: session.opensAt,
          closesAt: session.closesAt,
          timeLimitMinutes: session.timeLimitMinutes ?? null,
          serverNow: new Date().toISOString(),
        },
      })
    }

    // Leaderboard flow slides are never served async — exclude them from the
    // count and the time/score estimates (builder slides carry default
    // timer/points that would inflate both).
    const raw = (session.quizVersion?.snapshot as Question[] | null) ?? []
    const snapshot = Array.isArray(raw) ? raw : []
    const questions = snapshot.filter(q => q.type !== 'leaderboard')
    const estimatedSeconds = questions.reduce((sum, q) => sum + (typeof q.timerSeconds === 'number' ? q.timerSeconds : 20), 0)
    const maxBaseScore = questions.reduce((sum, q) => sum + (typeof q.points === 'number' ? q.points : 1000), 0)

    return NextResponse.json({
      success: true,
      data: {
        state: 'open',
        title: session.quizVersion?.title ?? 'Quiz',
        subject: session.quizVersion?.subject ?? null,
        questionCount: snapshot.length > 0 ? answerableCount(snapshot) : (session.quizVersion?.questionCount ?? 0),
        allowRetries: session.allowRetries,
        opensAt: session.opensAt,
        closesAt: session.closesAt,
        timeLimitMinutes: session.timeLimitMinutes ?? null,
        estimatedSeconds,
        maxBaseScore,
        serverNow: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[async/[slug]:GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
