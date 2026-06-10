export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const session = await prisma.gameSession.findFirst({
      where: { userId: user.id, OR: [{ id }, { code: id }] },
    })
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    // Cursor pagination so a 1000+ participant session doesn't materialise
    // every row in one response. Existing callers get the first page with the
    // same shape as before, plus meta.nextCursor when there's more.
    const url = new URL(req.url)
    const rawLimit = Number(url.searchParams.get('limit'))
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 500
    const cursor = url.searchParams.get('cursor') || undefined

    const attendees = await prisma.attendee.findMany({
      where: { sessionId: session.id },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = attendees.length > limit
    const page = hasMore ? attendees.slice(0, limit) : attendees
    return NextResponse.json({
      success: true,
      data: page,
      meta: { nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load attendees' }, { status: 500 })
  }
}
