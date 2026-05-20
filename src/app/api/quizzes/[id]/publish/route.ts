export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { ASYNC_GRADEABLE_TYPES } from '@/lib/scoring'

type Params = { params: Promise<{ id: string }> }
type GradeableQuestion = { type: string }

function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(8)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

async function findUniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = generateSlug()
    const clash = await prisma.gameSession.findUnique({ where: { shareSlug: slug }, select: { id: true } })
    if (!clash) return slug
  }
  return generateSlug() // last resort — collision astronomically unlikely
}

async function findUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = String(100000 + Math.floor(Math.random() * 900000))
    const clash = await prisma.gameSession.findUnique({ where: { code }, select: { id: true } })
    if (!clash) return code
  }
  return String(100000 + Math.floor(Math.random() * 900000))
}

function getGradeableQuestions(questions: unknown): GradeableQuestion[] {
  const allQuestions = Array.isArray(questions) ? (questions as GradeableQuestion[]) : []
  return allQuestions.filter(q => ASYNC_GRADEABLE_TYPES.has(q.type))
}

function needsRepublish(quizUpdatedAt: Date, versionCreatedAt: Date | null | undefined): boolean {
  return !versionCreatedAt || quizUpdatedAt.getTime() > versionCreatedAt.getTime()
}

// POST /api/quizzes/[id]/publish — publish quiz as async self-serve link
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const quiz = await prisma.quiz.findFirst({ where: { id, userId: user.id } })
    if (!quiz) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const gradeable = getGradeableQuestions(quiz.questions)
    if (gradeable.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'This quiz has no auto-gradeable questions (MCQ, True/False, or Multi-select). Add at least one to publish it as a self-paced quiz.',
      }, { status: 400 })
    }

    // Idempotent: return existing open async session if one exists
    const existing = await prisma.gameSession.findFirst({
      where: { quizId: id, userId: user.id, mode: 'async', status: 'open' },
      select: {
        id: true,
        shareSlug: true,
        allowRetries: true,
        closesAt: true,
        createdAt: true,
        participantCount: true,
        quizVersionId: true,
        quizVersion: { select: { questionCount: true, createdAt: true } },
      },
    })
    if (existing) {
      const stale = needsRepublish(quiz.updatedAt, existing.quizVersion?.createdAt)
      if (stale) {
        const version = await prisma.quizVersion.create({
          data: {
            quizId: quiz.id,
            title: quiz.title,
            subject: quiz.subject ?? null,
            language: quiz.language ?? null,
            theme: quiz.theme ?? null,
            snapshot: gradeable,
            questionCount: gradeable.length,
          },
        })
        await prisma.gameSession.update({
          where: { id: existing.id },
          data: { quizVersionId: version.id },
        })
        return NextResponse.json({
          success: true,
          data: {
            sessionId: existing.id,
            shareSlug: existing.shareSlug,
            allowRetries: existing.allowRetries,
            closesAt: existing.closesAt,
            questionCount: version.questionCount,
            responseCount: existing.participantCount ?? 0,
            publishedAt: version.createdAt,
            needsRepublish: false,
            republished: true,
          },
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existing.id,
          shareSlug: existing.shareSlug,
          allowRetries: existing.allowRetries,
          closesAt: existing.closesAt,
          questionCount: existing.quizVersion?.questionCount ?? 0,
          responseCount: existing.participantCount ?? 0,
          publishedAt: existing.quizVersion?.createdAt ?? existing.createdAt,
          needsRepublish: false,
          republished: false,
        },
      })
    }

    // Free-tier: max active async quizzes
    const plan = await getUserPlan(user.id)
    const asyncLimit = PLAN_LIMITS[plan].maxAsyncQuizzes
    if (asyncLimit !== Infinity) {
      const activeCount = await prisma.gameSession.count({ where: { userId: user.id, mode: 'async', status: 'open' } })
      if (activeCount >= asyncLimit) {
        return NextResponse.json({
          success: false,
          error: `Free plan allows ${asyncLimit} active self-serve quiz${asyncLimit === 1 ? '' : 'es'}. Close an existing one or upgrade to Pro.`,
        }, { status: 403 })
      }
    }

    const version = await prisma.quizVersion.create({
      data: {
        quizId: quiz.id,
        title: quiz.title,
        subject: quiz.subject ?? null,
        language: quiz.language ?? null,
        theme: quiz.theme ?? null,
        snapshot: gradeable,
        questionCount: gradeable.length,
      },
    })

    const [slug, code] = await Promise.all([findUniqueSlug(), findUniqueCode()])

    const session = await prisma.gameSession.create({
      data: {
        code,
        type: 'quiz',
        mode: 'async',
        status: 'open',
        quizId: quiz.id,
        quizVersionId: version.id,
        userId: user.id,
        shareSlug: slug,
        allowRetries: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        shareSlug: slug,
        questionCount: gradeable.length,
        allowRetries: false,
        closesAt: null,
        responseCount: 0,
        publishedAt: version.createdAt,
        needsRepublish: false,
        republished: false,
      },
    })
  } catch (err) {
    console.error('[publish:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Failed to publish quiz' }, { status: 500 })
  }
}

// PATCH /api/quizzes/[id]/publish — update allowRetries or closesAt
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as Record<string, unknown>

    const session = await prisma.gameSession.findFirst({ where: { quizId: id, userId: user.id, mode: 'async', status: 'open' } })
    if (!session) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const update: { allowRetries?: boolean; closesAt?: Date | null } = {}
    if (typeof body.allowRetries === 'boolean') update.allowRetries = body.allowRetries
    if ('closesAt' in body) update.closesAt = body.closesAt ? new Date(body.closesAt as string) : null

    const updated = await prisma.gameSession.update({ where: { id: session.id }, data: update })

    return NextResponse.json({
      success: true,
      data: { sessionId: updated.id, shareSlug: updated.shareSlug, allowRetries: updated.allowRetries, closesAt: updated.closesAt },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}

// DELETE /api/quizzes/[id]/publish — close (unpublish) the async quiz
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const session = await prisma.gameSession.findFirst({ where: { quizId: id, userId: user.id, mode: 'async', status: 'open' } })
    if (!session) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    await prisma.gameSession.update({ where: { id: session.id }, data: { status: 'ended', endedAt: new Date() } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to close quiz' }, { status: 500 })
  }
}
