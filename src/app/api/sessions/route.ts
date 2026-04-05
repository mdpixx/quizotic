export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

// GET /api/sessions — list user's game sessions
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await prisma.gameSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        participantCount: true,
        results: true,
        createdAt: true,
        endedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: sessions })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load sessions' }, { status: 500 })
  }
}
