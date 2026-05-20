export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
        closesAt: true,
        quizVersion: { select: { title: true, questionCount: true, subject: true, snapshot: true } },
      },
    })

    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }
    if (session.status !== 'open' || isExpired(session)) {
      return NextResponse.json({ success: false, error: 'Quiz is no longer available', code: 'closed' }, { status: 410 })
    }

    const questions = Array.isArray(session.quizVersion?.snapshot)
      ? (session.quizVersion?.snapshot as Array<{ timerSeconds?: number; points?: number }>)
      : []
    const estimatedSeconds = questions.reduce((sum, q) => sum + (typeof q.timerSeconds === 'number' ? q.timerSeconds : 20), 0)
    const maxBaseScore = questions.reduce((sum, q) => sum + (typeof q.points === 'number' ? q.points : 1000), 0)

    return NextResponse.json({
      success: true,
      data: {
        title: session.quizVersion?.title ?? 'Quiz',
        subject: session.quizVersion?.subject ?? null,
        questionCount: session.quizVersion?.questionCount ?? 0,
        allowRetries: session.allowRetries,
        closesAt: session.closesAt,
        estimatedSeconds,
        maxBaseScore,
      },
    })
  } catch (err) {
    console.error('[async/[slug]:GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
