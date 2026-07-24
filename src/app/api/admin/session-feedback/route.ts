export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET — aggregate + recent smiley ratings for the admin "Session ratings" panel.
// Aggregates come from a single groupBy; recent rows carry the (optional) text.

type Bucket = { count: number; sum: number; avg: number; distribution: Record<number, number> }
const blank = (): Bucket => ({ count: 0, sum: 0, avg: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const [grouped, recent] = await Promise.all([
    prisma.sessionFeedback.groupBy({ by: ['role', 'rating'], _count: { _all: true } }),
    prisma.sessionFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 150 }),
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

  return NextResponse.json({ summary, items: recent })
}
