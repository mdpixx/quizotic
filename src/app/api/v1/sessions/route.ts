export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'

/**
 * GET /api/v1/sessions
 * List all game sessions for the authenticated user.
 *
 * Auth: Bearer <api_key>
 * Query params:
 *   limit  — max results (default 50, max 200)
 *   offset — pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Pass your API key as: Authorization: Bearer <key>' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50)))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

  const [sessions, total] = await Promise.all([
    prisma.gameSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        quizId: true,
        participantCount: true,
        createdAt: true,
        endedAt: true,
        status: true,
      },
    }),
    prisma.gameSession.count({ where: { userId: user.id } }),
  ])

  return NextResponse.json({
    data: sessions,
    meta: { total, limit, offset },
  })
}
