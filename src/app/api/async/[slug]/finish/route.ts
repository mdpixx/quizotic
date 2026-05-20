export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

type Params = { params: Promise<{ slug: string }> }

// POST /api/async/[slug]/finish
// Body: { participantId, attendeeId }
// Finalizes the Attendee row and returns score + rank.
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
      select: { id: true, mode: true },
    })
    if (!session || session.mode !== 'async') {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 })
    }

    // Sum all Answer points for this participant
    const answers = await prisma.answer.findMany({
      where: { sessionId: session.id, participantId },
      select: { points: true },
    })
    const finalScore = answers.reduce((s, a) => s + a.points, 0)

    const now = new Date()
    await Promise.all([
      prisma.attendee.update({
        where: { id: attendeeId },
        data: { leftAt: now, finalScore },
      }),
      prisma.gameSession.update({
        where: { id: session.id },
        data: { participantCount: { increment: 1 } },
      }),
    ])

    // Compute rank among all finished attendees
    const allFinished = await prisma.attendee.findMany({
      where: { sessionId: session.id, leftAt: { not: null } },
      select: { finalScore: true },
      orderBy: { finalScore: 'desc' },
    })
    const total = allFinished.length
    const rank = allFinished.findIndex(a => a.finalScore <= finalScore) + 1

    return NextResponse.json({ success: true, data: { finalScore, rank, total } })
  } catch (err) {
    console.error('[async/finish:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
