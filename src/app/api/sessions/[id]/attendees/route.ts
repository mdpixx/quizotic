export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const attendees = await prisma.attendee.findMany({
      where: { sessionId: session.id },
      orderBy: { joinedAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: attendees })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load attendees' }, { status: 500 })
  }
}
