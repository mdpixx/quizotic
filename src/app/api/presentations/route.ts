export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

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
  let userId: string | undefined
  let incomingId: string | undefined
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    userId = user.id

    // Same budget as /api/quizzes: manual saves + builder autosave, no floods.
    const rl = await rateLimitRequest(req, {
      bucket: 'save-presentation',
      userId: user.id,
      userLimit: 30,
      ipLimit: 60,
      windowMs: 60_000,
    })
    if (!rl.ok) return rateLimitResponse(rl)

    const body = await req.json()
    const { id, title, theme, slides } = body
    incomingId = typeof id === 'string' ? id : undefined

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }
    if (!title || !slides) {
      return NextResponse.json({ success: false, error: 'title and slides are required' }, { status: 400 })
    }
    if (!Array.isArray(slides)) {
      return NextResponse.json({ success: false, error: 'slides must be an array' }, { status: 400 })
    }

    const cleanTheme = typeof theme === 'string' && theme.trim() ? theme.trim() : null

    // Enforce slide count limit
    const plan = await getUserPlan(user.id)
    const maxSlides = PLAN_LIMITS[plan].maxSlidesPerPresentation
    if (maxSlides !== Infinity && slides.length > maxSlides) {
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
        data: { id, title, theme: cleanTheme, slides, userId: user.id },
      })
      return NextResponse.json({ success: true, data: presentation })
    }

    const presentation = await prisma.presentation.update({
      where: { id: existing.id },
      data: { title, theme: cleanTheme, slides },
    })

    return NextResponse.json({ success: true, data: presentation })
  } catch (err) {
    const code = (err as { code?: string })?.code
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/presentations:POST] save failed', { userId, incomingId, code, message })

    if (code === 'P2003') {
      return NextResponse.json({ success: false, error: 'Your account is out of sync — please sign out and back in.' }, { status: 409 })
    }
    if (code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Conflict — try Save again.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: `Failed to save presentation: ${message}` }, { status: 500 })
  }
}
