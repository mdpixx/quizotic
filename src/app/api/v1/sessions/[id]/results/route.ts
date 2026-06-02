export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { buildTeacherReportInsights } from '@/lib/report-insights'
import type { QuestionStat } from '@/lib/quiz-types'
import { unauthorizedApiKey } from '@/lib/public-api'

/**
 * GET /api/v1/sessions/:id/results
 * Full session results including leaderboard, question stats, and attendee list.
 *
 * Auth: Bearer <api_key>
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateApiKey(req)
  if (!user) {
    return unauthorizedApiKey()
  }

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-session-results',
    userId: user.id,
    userLimit: 60,
    ipLimit: 120,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { id } = await params
  const session = await prisma.gameSession.findFirst({
    where: { id, userId: user.id },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const attendees = await prisma.attendee.findMany({
    where: { sessionId: id },
    orderBy: { joinedAt: 'asc' },
    select: {
      nickname: true,
      email: true,
      joinedAt: true,
      leftAt: true,
      durationSec: true,
      finalScore: true,
      team: true,
    },
  })

  const results = session.results as Record<string, unknown> | null
  const questionStats = (results?.questionStats ?? []) as QuestionStat[]
  const finishedCount = attendees.filter(a => !!a.leftAt).length
  const insights = buildTeacherReportInsights({
    questionStats,
    totalParticipants: attendees.length || session.participantCount || 0,
    finishedCount,
  })

  return NextResponse.json({
    data: {
      id: session.id,
      quizId: session.quizId,
      participantCount: session.participantCount,
      createdAt: session.createdAt,
      leaderboard: (results?.leaderboard ?? []) as unknown[],
      questionStats,
      sessionMode: (results?.sessionMode as string) ?? 'competitive',
      duration: (results?.duration as number) ?? null,
      attendees,
      insights,
    },
  })
}
