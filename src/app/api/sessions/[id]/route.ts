export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

// GET /api/sessions/[id] — single session with full results
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Accept the DB id or the 6-digit game code (the live host screen only
    // knows the code) — same contract as the matrix endpoint.
    const session = await prisma.gameSession.findFirst({
      where: { userId: user.id, OR: [{ id }, { code: id }] },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: session })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load session' }, { status: 500 })
  }
}
