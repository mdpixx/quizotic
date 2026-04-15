export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

// GET /api/sessions/ghost-candidates?quizId=<id>
// Returns the user's past completed sessions for a given quiz, for Ghost Mode selection.
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const quizId = searchParams.get('quizId')

    const sessions = await prisma.gameSession.findMany({
      where: {
        userId: user.id,
        status: 'ended',
        ...(quizId ? { quizId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        participantCount: true,
        results: true,
      },
    })

    const candidates = sessions.map(s => {
      const results = s.results as Record<string, unknown> | null
      const topPlayer = (results?.leaderboard as Array<{ name: string; score: number }> | null)?.[0]
      return {
        id: s.id,
        date: s.createdAt.toISOString().split('T')[0],
        participantCount: s.participantCount ?? 0,
        topScore: topPlayer?.score ?? 0,
        topName: topPlayer?.name ?? 'Unknown',
      }
    })

    return NextResponse.json({ success: true, data: candidates })
  } catch (err) {
    if (err instanceof Error && err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
  }
}
