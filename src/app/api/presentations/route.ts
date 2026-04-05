export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

// GET /api/presentations — list presentations for current user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const presentations = await prisma.presentation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: presentations })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load presentations' }, { status: 500 })
  }
}

// POST /api/presentations — create or update
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, title, slides } = body

    if (!title || !slides) {
      return NextResponse.json({ success: false, error: 'title and slides are required' }, { status: 400 })
    }

    let presentation
    if (id) {
      const existing = await prisma.presentation.findFirst({ where: { id, userId: user.id } })
      if (!existing) return NextResponse.json({ success: false, error: 'Presentation not found' }, { status: 404 })
      presentation = await prisma.presentation.update({ where: { id }, data: { title, slides } })
    } else {
      presentation = await prisma.presentation.create({ data: { title, slides, userId: user.id } })
    }

    return NextResponse.json({ success: true, data: presentation })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save presentation' }, { status: 500 })
  }
}
