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
      select: { id: true, title: true, theme: true, createdAt: true, updatedAt: true },
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
    const { id, title, theme, slides } = body

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
        error: `Free plan allows up to ${maxSlides} slides per presentation. Email info@quizotic.live if you need more — we review every request.`,
      }, { status: 403 })
    }

    // Ownership-scoped lookup — id alone is attacker-controlled.
    const existing = await prisma.presentation.findFirst({ where: { id, userId: user.id } })

    if (!existing) {
      const foreign = await prisma.presentation.findUnique({ where: { id }, select: { id: true } })
      if (foreign) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const maxSaved = PLAN_LIMITS[plan].maxSavedPresentations
      if (maxSaved !== Infinity) {
        const count = await prisma.presentation.count({ where: { userId: user.id } })
        if (count >= maxSaved) {
          return NextResponse.json({
            success: false,
            error: `You've reached the limit of ${maxSaved} saved presentations. Delete some presentations to save new ones, or email info@quizotic.live if you need more — we review every request.`,
          }, { status: 403 })
        }
      }

      const presentation = await prisma.presentation.create({
        data: { id, title, theme, slides, userId: user.id },
      })
      return NextResponse.json({ success: true, data: presentation })
    }

    const presentation = await prisma.presentation.update({
      where: { id: existing.id },
      data: { title, theme, slides },
    })

    return NextResponse.json({ success: true, data: presentation })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save presentation' }, { status: 500 })
  }
}
