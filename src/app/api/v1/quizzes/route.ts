export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'
import { apiError, normalizeQuestions, parsePagination, unauthorizedApiKey } from '@/lib/public-api'

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

/**
 * GET /api/v1/quizzes
 * List all quizzes for the authenticated user.
 *
 * Auth: Bearer <api_key>
 * Query params:
 *   limit  — max results (default 50, max 200)
 *   offset — pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req)
  if (!user) {
    return unauthorizedApiKey()
  }

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-quizzes',
    userId: user.id,
    userLimit: 60,
    ipLimit: 120,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { limit, offset } = parsePagination(new URL(req.url))

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        subject: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        questions: true,
      },
    }),
    prisma.quiz.count({ where: { userId: user.id } }),
  ])

  return NextResponse.json({
    data: quizzes,
    meta: { total, limit, offset },
  })
}

/**
 * POST /api/v1/quizzes
 * Create or update a quiz for the authenticated API-key owner.
 *
 * Auth: Bearer <api_key>
 */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-quizzes-write',
    userId: user.id,
    userLimit: 30,
    ipLimit: 60,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('invalid_json', 'Request body must be valid JSON', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return apiError('validation_error', 'title is required', 400)

  const questions = normalizeQuestions(body.questions)
  if (questions.length === 0) return apiError('validation_error', 'questions must contain at least one question', 400)

  const issues = validateQuizQuestions(questions)
  if (hasQuizValidationErrors(issues)) {
    return apiError('quiz_validation_error', 'Some questions need attention before saving.', 400, issues)
  }

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID()
  const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : null
  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : null
  const theme = typeof body.theme === 'string' && body.theme.trim() ? body.theme.trim() : null

  const existing = await prisma.quiz.findFirst({ where: { id, userId: user.id }, select: { id: true } })
  if (!existing) {
    const foreign = await prisma.quiz.findUnique({ where: { id }, select: { id: true } })
    if (foreign) return apiError('forbidden', 'A quiz with this id belongs to another user.', 403)

    const plan = await getUserPlan(user.id)
    const limit = PLAN_LIMITS[plan].maxSavedQuizzes
    if (limit !== Infinity) {
      const count = await prisma.quiz.count({ where: { userId: user.id } })
      if (count >= limit) {
        return apiError('plan_limit_reached', `Your plan allows ${limit} saved quizzes. Delete an older quiz or upgrade.`, 403)
      }
    }

    const quiz = await prisma.quiz.create({
      data: { id, title, subject, language, theme, questions: asJson(questions), userId: user.id },
    })
    return NextResponse.json({ data: quiz }, { status: 201, headers: { Location: `/api/v1/quizzes/${quiz.id}` } })
  }

  const quiz = await prisma.quiz.update({
    where: { id: existing.id },
    data: { title, subject, language, theme, questions: asJson(questions) },
  })
  return NextResponse.json({ data: quiz })
}
