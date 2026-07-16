export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import type { Question } from '@/lib/quiz-types'

type Params = { params: Promise<{ token: string }> }

// POST /api/import/[token] — clone the shared quiz into the caller's library.
// The copy is a snapshot: a brand-new Quiz row fully owned by the importer,
// with fresh question ids. Machine-readable `code` lets the import page
// branch on outcomes without matching error strings.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const rl = await rateLimitRequest(req, {
      bucket: 'import-quiz',
      userId: user.id,
      userLimit: 10,
      ipLimit: 30,
      windowMs: 60_000,
    })
    if (!rl.ok) return rateLimitResponse(rl)

    const { token } = await params
    const link = await prisma.quizShareLink.findUnique({
      where: { token },
      select: {
        id: true,
        revokedAt: true,
        quiz: {
          select: {
            userId: true,
            title: true,
            subject: true,
            language: true,
            theme: true,
            questions: true,
            selfPaced: true,
            timeLimitMinutes: true,
            allowRetries: true,
          },
        },
      },
    })
    if (!link || !link.quiz) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', error: 'This share link is invalid.' }, { status: 404 })
    }
    if (link.revokedAt) {
      return NextResponse.json({ success: false, code: 'REVOKED', error: 'This share link has been turned off by its owner.' }, { status: 410 })
    }
    if (link.quiz.userId === user.id) {
      return NextResponse.json({ success: false, code: 'SELF_IMPORT', error: 'This is your own quiz — it is already in your library.' }, { status: 409 })
    }

    const plan = await getUserPlan(user.id)
    const limit = PLAN_LIMITS[plan].maxSavedQuizzes
    if (limit !== Infinity) {
      const count = await prisma.quiz.count({ where: { userId: user.id } })
      if (count >= limit) {
        return NextResponse.json({
          success: false,
          code: 'LIBRARY_FULL',
          error: `You've reached the limit of ${limit} saved quizzes. Delete some quizzes to make room, or upgrade your plan.`,
        }, { status: 403 })
      }
    }

    // Fresh ids keep the copy fully independent of the source. Explicit field
    // allowlist — never spread the source row, so id/userId/timestamps can't leak.
    const sourceQuestions = Array.isArray(link.quiz.questions) ? (link.quiz.questions as unknown as Question[]) : []
    const clonedQuestions = sourceQuestions.map(q => ({ ...q, id: randomUUID() }))

    const [newQuiz] = await prisma.$transaction([
      prisma.quiz.create({
        data: {
          title: link.quiz.title,
          subject: link.quiz.subject,
          language: link.quiz.language,
          theme: link.quiz.theme,
          questions: clonedQuestions as unknown as Prisma.InputJsonValue,
          selfPaced: link.quiz.selfPaced,
          timeLimitMinutes: link.quiz.timeLimitMinutes,
          allowRetries: link.quiz.allowRetries,
          userId: user.id,
        },
        select: { id: true },
      }),
      prisma.quizShareLink.update({
        where: { id: link.id },
        data: { importCount: { increment: 1 } },
      }),
    ])

    return NextResponse.json({ success: true, data: { quizId: newQuiz.id } })
  } catch (err) {
    console.error('[import:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Failed to import quiz' }, { status: 500 })
  }
}
