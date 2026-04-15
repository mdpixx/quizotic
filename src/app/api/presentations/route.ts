export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

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

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }
    if (!title || !slides) {
      return NextResponse.json({ success: false, error: 'title and slides are required' }, { status: 400 })
    }

    // Enforce slide count limit
    const plan = await getUserPlan(user.id)
    const maxSlides = PLAN_LIMITS[plan].maxSlidesPerPresentation
    if (Array.isArray(slides) && maxSlides !== Infinity && slides.length > maxSlides) {
      return NextResponse.json({
        success: false,
        error: `Free plan allows up to ${maxSlides} slides per presentation. ${plan === 'free' ? 'Upgrade to Pro for unlimited slides.' : ''}`,
      }, { status: 403 })
    }

    // Check whether this is a new row (upsert — use client-generated id)
    const existing = await prisma.presentation.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      const maxSaved = PLAN_LIMITS[plan].maxSavedPresentations
      if (maxSaved !== Infinity) {
        const count = await prisma.presentation.count({ where: { userId: user.id } })
        if (count >= maxSaved) {
          return NextResponse.json({
            success: false,
            error: `You've reached the limit of ${maxSaved} saved presentations. ${plan === 'free' ? 'Upgrade to Pro for unlimited presentations.' : 'Delete some presentations to save new ones.'}`,
          }, { status: 403 })
        }
      }
    }

    const presentation = await prisma.presentation.upsert({
      where: { id },
      create: { id, title, slides, userId: user.id },
      update: { title, slides },
    })

    return NextResponse.json({ success: true, data: presentation })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save presentation' }, { status: 500 })
  }
}
