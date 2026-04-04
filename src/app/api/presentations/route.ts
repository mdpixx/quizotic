import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/presentations — list all presentations
export async function GET() {
  try {
    const presentations = await prisma.presentation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, slides: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: presentations })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load presentations' }, { status: 500 })
  }
}

// POST /api/presentations — create or update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, title, slides } = body

    if (!title || !slides) {
      return NextResponse.json({ success: false, error: 'title and slides are required' }, { status: 400 })
    }

    const presentation = await prisma.presentation.upsert({
      where: { id: id ?? '' },
      update: { title, slides },
      create: { id, title, slides },
    })

    return NextResponse.json({ success: true, data: presentation })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save presentation' }, { status: 500 })
  }
}
