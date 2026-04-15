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

    // Check whether this is a new row (upsert — use client-generated id)
    const existing = await prisma.quiz.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      const plan = await getUserPlan(user.id)
      const limit = PLAN_LIMITS[plan].maxSavedQuizzes
      if (limit !== Infinity) {
        const count = await prisma.quiz.count({ where: { userId: user.id } })
        if (count >= limit) {
          return NextResponse.json({
            success: false,
            error: `You've reached the limit of ${limit} saved quizzes. ${plan === 'free' ? 'Upgrade to Pro for unlimited quizzes.' : 'Delete some quizzes to save new ones.'}`,
          }, { status: 403 })
        }
      }
    }

    const quiz = await prisma.quiz.upsert({
      where: { id },
      create: { id, title, subject, language, questions, userId: user.id },
      update: { title, subject, language, questions },
    })

    return NextResponse.json({ success: true, data: quiz })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save quiz' }, { status: 500 })
  }
}
