export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

// GET /api/quizzes — list quizzes for current user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const quizzes = await prisma.quiz.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, subject: true, language: true, theme: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: quizzes })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load quizzes' }, { status: 500 })
  }
}

// POST /api/quizzes — create or update a quiz
export async function POST(req: NextRequest) {
  let userId: string | undefined
  let incomingId: string | undefined
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const body = await req.json()
    const { id, title, subject, language, theme, questions } = body
    incomingId = typeof id === 'string' ? id : undefined

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }
    if (!title || !questions) {
      return NextResponse.json({ success: false, error: 'title and questions are required' }, { status: 400 })
    }
    if (!Array.isArray(questions)) {
      return NextResponse.json({ success: false, error: 'questions must be an array' }, { status: 400 })
    }

    // Normalise optional fields — empty strings would trip Postgres length/
    // pattern checks for some deployments and add noise to search indexes.
    const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : null
    const cleanLanguage = typeof language === 'string' && language.trim() ? language.trim() : null
    const cleanTheme = typeof theme === 'string' && theme.trim() ? theme.trim() : null

    // Ownership-scoped lookup — id alone is attacker-controlled.
    const existing = await prisma.quiz.findFirst({ where: { id, userId: user.id } })

    // Reject writes to an id that exists but belongs to another user.
    if (!existing) {
      const foreign = await prisma.quiz.findUnique({ where: { id }, select: { id: true } })
      if (foreign) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const plan = await getUserPlan(user.id)
      const limit = PLAN_LIMITS[plan].maxSavedQuizzes
      if (limit !== Infinity) {
        const count = await prisma.quiz.count({ where: { userId: user.id } })
        if (count >= limit) {
          return NextResponse.json({
            success: false,
            error: `You've reached the limit of ${limit} saved quizzes. Delete some quizzes to save new ones, or email info@quizotic.live if you need more — we review every request.`,
          }, { status: 403 })
        }
      }

      const quiz = await prisma.quiz.create({
        data: { id, title, subject: cleanSubject, language: cleanLanguage, theme: cleanTheme, questions, userId: user.id },
      })
      return NextResponse.json({ success: true, data: quiz })
    }

    const quiz = await prisma.quiz.update({
      where: { id: existing.id },
      data: { title, subject: cleanSubject, language: cleanLanguage, theme: cleanTheme, questions },
    })

    return NextResponse.json({ success: true, data: quiz })
  } catch (err) {
    // Surface the actual failure so we can diagnose in Railway logs and hand
    // an actionable message to the client. Prior to this, every DB/validation
    // failure collapsed into an opaque "Failed to save quiz" 500.
    const code = (err as { code?: string })?.code
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/quizzes:POST] save failed', { userId, incomingId, code, message })

    // Foreign key violation on userId = stale session against a deleted user.
    if (code === 'P2003') {
      return NextResponse.json({ success: false, error: 'Your account is out of sync — please sign out and back in.' }, { status: 409 })
    }
    // Unique constraint (duplicate id across users shouldn't happen with our
    // 403 Forbidden gate, but log it if it does).
    if (code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Conflict — try Save again.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: `Failed to save quiz: ${message}` }, { status: 500 })
  }
}
