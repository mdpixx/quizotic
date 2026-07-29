export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET — list feedback for the admin triage panel, newest first.
// ?status=new|seen|done filters; default shows everything still open.
// ?type=feature|bug|general filters by kind so roadmap requests can be read
// without wading through support noise. Type counts are returned unfiltered by
// status so the tab badge shows the true backlog, not just the open slice.
const FEEDBACK_TYPES = ['general', 'feature', 'bug']

export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const typeParam = url.searchParams.get('type')
  const where = {
    ...(statusParam ? { status: statusParam } : { status: { in: ['new', 'seen'] } }),
    // Ignore an unrecognised ?type rather than returning an empty list — a
    // stale bookmark shouldn't look like "no feedback exists".
    ...(typeParam && FEEDBACK_TYPES.includes(typeParam) ? { type: typeParam } : {}),
  }

  const [items, counts, typeCounts] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.feedback.groupBy({
      by: ['type'],
      where: { status: { in: ['new', 'seen'] } },
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({
    items,
    counts: Object.fromEntries(counts.map(c => [c.status, c._count._all])),
    typeCounts: Object.fromEntries(typeCounts.map(c => [c.type, c._count._all])),
  })
}

// PATCH — mark a feedback item seen/done.
const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(['new', 'seen', 'done']),
})

export async function PATCH(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const item = await prisma.feedback.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  })
  return NextResponse.json({ item })
}
