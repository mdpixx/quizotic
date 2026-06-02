export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'
import { apiError, normalizeQuestions, unauthorizedApiKey } from '@/lib/public-api'

type Params = { params: Promise<{ id: string }> }

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

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
  return generateSlug()
}

async function findUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = String(100000 + Math.floor(Math.random() * 900000))
    const clash = await prisma.gameSession.findUnique({ where: { code }, select: { id: true } })
    if (!clash) return code
  }
  return String(100000 + Math.floor(Math.random() * 900000))
}

function quizChangedAfterVersion(quizUpdatedAt: Date, versionCreatedAt: Date | null | undefined): boolean {
  return !versionCreatedAt || quizUpdatedAt.getTime() > versionCreatedAt.getTime()
}

// POST /api/v1/quizzes/:id/publish — publish an owned quiz as a self-paced link.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-quiz-publish',
    userId: user.id,
    userLimit: 30,
    ipLimit: 60,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const allowRetries = typeof body.allowRetries === 'boolean' ? body.allowRetries : false
  const closesAt = typeof body.closesAt === 'string' && body.closesAt ? new Date(body.closesAt) : null
  const rawTimeLimit = body.timeLimitMinutes
  const timeLimitMinutes = typeof rawTimeLimit === 'number' && Number.isInteger(rawTimeLimit) && rawTimeLimit > 0
    ? rawTimeLimit
    : null

  const { id } = await params
  const quiz = await prisma.quiz.findFirst({ where: { id, userId: user.id } })
  if (!quiz) return apiError('not_found', 'Quiz not found', 404)

  const questions = normalizeQuestions(quiz.questions)
  if (questions.length === 0) return apiError('empty_quiz', 'Add at least one question before publishing.', 400)
  const issues = validateQuizQuestions(questions)
  if (hasQuizValidationErrors(issues)) {
    return apiError('quiz_validation_error', 'Some questions need attention before publishing.', 400, issues)
  }

  const existing = await prisma.gameSession.findFirst({
    where: { quizId: id, userId: user.id, mode: 'async', status: 'open' },
    select: {
      id: true,
      shareSlug: true,
      allowRetries: true,
      closesAt: true,
      createdAt: true,
      participantCount: true,
      timeLimitMinutes: true,
      quizVersion: { select: { questionCount: true, createdAt: true } },
    },
  })

  if (existing) {
    let questionCount = existing.quizVersion?.questionCount ?? questions.length
    let publishedAt = existing.quizVersion?.createdAt ?? existing.createdAt
    let republished = false
    if (quizChangedAfterVersion(quiz.updatedAt, existing.quizVersion?.createdAt)) {
      const version = await prisma.quizVersion.create({
        data: {
          quizId: quiz.id,
          title: quiz.title,
          subject: quiz.subject ?? null,
          language: quiz.language ?? null,
          theme: quiz.theme ?? null,
          snapshot: asJson(questions),
          questionCount: questions.length,
        },
      })
      await prisma.gameSession.update({
        where: { id: existing.id },
        data: { quizVersionId: version.id, allowRetries, closesAt, timeLimitMinutes },
      })
      questionCount = version.questionCount
      publishedAt = version.createdAt
      republished = true
    } else {
      await prisma.gameSession.update({
        where: { id: existing.id },
        data: { allowRetries, closesAt, timeLimitMinutes },
      })
    }
    return NextResponse.json({
      data: {
        sessionId: existing.id,
        shareSlug: existing.shareSlug,
        shareUrl: `/q/${existing.shareSlug}`,
        allowRetries,
        closesAt,
        timeLimitMinutes,
        questionCount,
        responseCount: existing.participantCount ?? 0,
        publishedAt,
        republished,
      },
    })
  }

  const plan = await getUserPlan(user.id)
  const asyncLimit = PLAN_LIMITS[plan].maxAsyncQuizzes
  if (asyncLimit !== Infinity) {
    const activeCount = await prisma.gameSession.count({ where: { userId: user.id, mode: 'async', status: 'open' } })
    if (activeCount >= asyncLimit) {
      return apiError('plan_limit_reached', `Your plan allows ${asyncLimit} active self-paced quiz link${asyncLimit === 1 ? '' : 's'}.`, 403)
    }
  }

  const version = await prisma.quizVersion.create({
    data: {
      quizId: quiz.id,
      title: quiz.title,
      subject: quiz.subject ?? null,
      language: quiz.language ?? null,
      theme: quiz.theme ?? null,
      snapshot: asJson(questions),
      questionCount: questions.length,
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
      allowRetries,
      closesAt,
      timeLimitMinutes,
    },
  })

  return NextResponse.json({
    data: {
      sessionId: session.id,
      shareSlug: slug,
      shareUrl: `/q/${slug}`,
      allowRetries,
      closesAt,
      timeLimitMinutes,
      questionCount: questions.length,
      responseCount: 0,
      publishedAt: version.createdAt,
      republished: false,
    },
  })
}
