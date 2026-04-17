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
      select: { id: true, title: true, subject: true, language: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: quizzes })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load quizzes' }, { status: 500 })
  }
}

// POST /api/quizzes — create or update a quiz
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, title, subject, language, questions } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }
    if (!title || !questions) {
      return NextResponse.json({ success: false, error: 'title and questions are required' }, { status: 400 })
    }

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
        data: { id, title, subject, language, questions, userId: user.id },
      })
      return NextResponse.json({ success: true, data: quiz })
    }

    const quiz = await prisma.quiz.update({
      where: { id: existing.id },
      data: { title, subject, language, questions },
    })

    return NextResponse.json({ success: true, data: quiz })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save quiz' }, { status: 500 })
  }
}
