export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

// GET /api/scheduled — the host's async (self-paced) sessions for the
// Scheduled dashboard page: upcoming, open now, and recently closed.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sessions = await prisma.gameSession.findMany({
      where: {
        userId: user.id,
        mode: 'async',
        OR: [
          { status: 'open' },
          { status: 'ended', endedAt: { gte: cutoff } },
        ],
      },
      select: {
        id: true,
        quizId: true,
        shareSlug: true,
        status: true,
        opensAt: true,
        closesAt: true,
        timeLimitMinutes: true,
        allowRetries: true,
        participantCount: true,
        createdAt: true,
        endedAt: true,
        quizVersion: { select: { title: true, questionCount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const ids = sessions.map(s => s.id)
    const [joinCounts, scoreAggs] = ids.length === 0 ? [[], []] : await Promise.all([
      prisma.attendee.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.attendee.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: ids }, leftAt: { not: null } },
        _count: { _all: true },
        _avg: { finalScore: true },
      }),
    ])
    const joinsBySession = new Map(joinCounts.map(j => [j.sessionId, j._count._all]))
    const scoresBySession = new Map(scoreAggs.map(s => [s.sessionId, { finished: s._count._all, avgScore: s._avg.finalScore }]))

    const now = Date.now()
    const data = sessions.map(s => {
      // Derived lifecycle state for the UI: upcoming → open → ended
      const phase = s.status === 'ended' ? 'ended'
        : s.opensAt && now < s.opensAt.getTime() ? 'upcoming'
        : 'open'
      const scores = scoresBySession.get(s.id)
      return {
        sessionId: s.id,
        quizId: s.quizId,
        title: s.quizVersion?.title ?? 'Quiz',
        questionCount: s.quizVersion?.questionCount ?? 0,
        shareSlug: s.shareSlug,
        phase,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        timeLimitMinutes: s.timeLimitMinutes,
        allowRetries: s.allowRetries,
        joinedCount: joinsBySession.get(s.id) ?? 0,
        finishedCount: scores?.finished ?? 0,
        avgScore: scores?.avgScore != null ? Math.round(scores.avgScore) : null,
        createdAt: s.createdAt,
        endedAt: s.endedAt,
      }
    })

    return NextResponse.json({ success: true, data: { sessions: data, serverNow: new Date().toISOString() } })
  } catch (err) {
    console.error('[scheduled:GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/scheduled?sessionId=...  — end an async session by its own id.
// Keyed on sessionId (not quizId) so orphaned sessions whose quiz was deleted
// — or any legacy session with a null quizId — are still closeable from the
// Scheduled dashboard. The 60s sweep then finalizes scores and writes results.
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })

    // Ownership-scoped: only the host's own open async sessions can be ended.
    const result = await prisma.gameSession.updateMany({
      where: { id: sessionId, userId: user.id, mode: 'async', status: 'open' },
      data: { status: 'ended', endedAt: new Date() },
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[scheduled:DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
