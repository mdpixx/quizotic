export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET — list feedback for the admin triage panel, newest first.
// ?status=new|seen|done filters; default shows everything still open.
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const where = statusParam ? { status: statusParam } : { status: { in: ['new', 'seen'] } }

  const [items, counts] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  return NextResponse.json({
    items,
    counts: Object.fromEntries(counts.map(c => [c.status, c._count._all])),
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
