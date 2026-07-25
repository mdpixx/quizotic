export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { readSessionFeedbackHealth } from '@/lib/session-feedback-health'

// GET — aggregate + recent smiley ratings for the admin "Session ratings" panel.
// Aggregates come from a single groupBy; recent rows carry the (optional) text.
//
// Also returns a `health` block. A ratings panel showing nothing is ambiguous
// on its own — it could mean the feature is new, or that nobody taps, or that
// the write path is broken. `health` supplies the denominator (sessions that
// actually ended and therefore showed the prompt) and the ingest counters, so
// the panel can say which of those it is.

type Bucket = { count: number; sum: number; avg: number; distribution: Record<number, number> }
const blank = (): Bucket => ({ count: 0, sum: 0, avg: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })

const WINDOW_DAYS = 7

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [grouped, recent, latest, endedSessions, ratingsInWindow] = await Promise.all([
    prisma.sessionFeedback.groupBy({ by: ['role', 'rating'], _count: { _all: true } }),
    prisma.sessionFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 150 }),
    prisma.sessionFeedback.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    // The denominator: every ended session showed the prompt to its host, and
    // to each participant who reached the podium.
    prisma.gameSession.count({ where: { status: 'ended', endedAt: { gte: since } } }),
    prisma.sessionFeedback.count({ where: { createdAt: { gte: since } } }),
  ])

  const summary: Record<'all' | 'host' | 'participant', Bucket> = {
    all: blank(),
    host: blank(),
    participant: blank(),
  }

  for (const g of grouped) {
    const c = g._count._all
    const r = g.rating
    const targets: Array<'all' | 'host' | 'participant'> =
      g.role === 'host' || g.role === 'participant' ? ['all', g.role] : ['all']
    for (const t of targets) {
      const b = summary[t]
      b.count += c
      b.sum += r * c
      b.distribution[r] = (b.distribution[r] ?? 0) + c
    }
  }
  for (const key of ['all', 'host', 'participant'] as const) {
    const b = summary[key]
    b.avg = b.count ? Math.round((b.sum / b.count) * 100) / 100 : 0
  }

  const ingest = readSessionFeedbackHealth()

  return NextResponse.json({
    summary,
    items: recent,
    health: {
      windowDays: WINDOW_DAYS,
      lastReceivedAt: latest?.createdAt ?? null,
      endedSessions,
      ratingsInWindow,
      // Host-only floor: at minimum one prompt per ended session. Participants
      // push the true exposure higher, so this rate is deliberately generous.
      hostResponseRate: endedSessions > 0 ? Math.round((ratingsInWindow / endedSessions) * 100) : null,
      ...ingest,
    },
  })
}
