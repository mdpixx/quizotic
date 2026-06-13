export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'
import type { Question } from '@/lib/quiz-types'

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
      select: {
        id: true,
        title: true,
        subject: true,
        language: true,
        theme: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          where: { mode: 'async', status: 'open' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            shareSlug: true,
            allowRetries: true,
            opensAt: true,
            closesAt: true,
            createdAt: true,
            participantCount: true,
            quizVersion: { select: { questionCount: true, createdAt: true } },
          },
        },
      },
    })

    // Compute questionCount + coverImageUrl in Postgres instead of selecting
    // the full questions JSONB for every quiz — for a user with 50 image-heavy
    // quizzes that column alone was megabytes per dashboard load.
    const stats = await prisma.$queryRaw<
      { id: string; questionCount: number; coverImageUrl: string | null }[]
    >`
      SELECT id,
             CASE WHEN jsonb_typeof(questions) = 'array'
                  THEN jsonb_array_length(questions) ELSE 0 END AS "questionCount",
             CASE WHEN jsonb_typeof(questions) = 'array' THEN (
               SELECT q->>'imageUrl' FROM jsonb_array_elements(questions) AS q
               WHERE coalesce(trim(q->>'imageUrl'), '') <> '' LIMIT 1
             ) ELSE NULL END AS "coverImageUrl"
      FROM "Quiz" WHERE "userId" = ${user.id}
    `
    const statsById = new Map(stats.map(s => [s.id, s]))

    const data = quizzes.map(q => {
      const asyncSession = q.sessions[0]
      const stat = statsById.get(q.id)
      return {
        id: q.id,
        title: q.title,
        subject: q.subject,
        language: q.language,
        theme: q.theme,
        coverImageUrl: stat?.coverImageUrl ?? null,
        questionCount: Number(stat?.questionCount ?? 0),
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        asyncShareSlug: asyncSession?.shareSlug ?? null,
        asyncAllowRetries: asyncSession?.allowRetries ?? false,
        asyncOpensAt: asyncSession?.opensAt ?? null,
        asyncClosesAt: asyncSession?.closesAt ?? null,
        asyncPublishedAt: asyncSession?.quizVersion?.createdAt ?? asyncSession?.createdAt ?? null,
        asyncQuestionCount: asyncSession?.quizVersion?.questionCount ?? 0,
        asyncResponseCount: asyncSession?.participantCount ?? 0,
        asyncNeedsRepublish: asyncSession?.quizVersion?.createdAt
          ? q.updatedAt.getTime() > asyncSession.quizVersion.createdAt.getTime()
          : false,
      }
    })
    return NextResponse.json({ success: true, data })
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

    // 30 saves/min per user absorbs aggressive manual saving + the builder's
    // background autosave while stopping write floods (full-payload upserts).
    const rl = await rateLimitRequest(req, {
      bucket: 'save-quiz',
      userId: user.id,
      userLimit: 30,
      ipLimit: 60,
      windowMs: 60_000,
    })
    if (!rl.ok) return rateLimitResponse(rl)

    const body = await req.json()
    const { id, title, subject, language, theme, questions, selfPaced, timeLimitMinutes, allowRetries } = body
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
    const validationIssues = validateQuizQuestions(questions as Question[])
    if (hasQuizValidationErrors(validationIssues)) {
      return NextResponse.json({
        success: false,
        error: 'Some questions need attention before saving.',
        issues: validationIssues,
      }, { status: 400 })
    }

    // Normalise optional fields — empty strings would trip Postgres length/
    // pattern checks for some deployments and add noise to search indexes.
    const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : null
    const cleanLanguage = typeof language === 'string' && language.trim() ? language.trim() : null
    const cleanTheme = typeof theme === 'string' && theme.trim() ? theme.trim() : null
    // Self-paced preference — coerce/clamp; undefined means "leave unchanged" on update.
    const cleanSelfPaced = typeof selfPaced === 'boolean' ? selfPaced : undefined
    const cleanAllowRetries = typeof allowRetries === 'boolean' ? allowRetries : undefined
    const cleanTimeLimit = timeLimitMinutes === null
      ? null
      : (Number.isFinite(timeLimitMinutes) && timeLimitMinutes > 0 ? Math.min(Math.round(timeLimitMinutes), 600) : undefined)

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
        data: {
          id, title, subject: cleanSubject, language: cleanLanguage, theme: cleanTheme, questions, userId: user.id,
          ...(cleanSelfPaced !== undefined ? { selfPaced: cleanSelfPaced } : {}),
          ...(cleanTimeLimit !== undefined ? { timeLimitMinutes: cleanTimeLimit } : {}),
          ...(cleanAllowRetries !== undefined ? { allowRetries: cleanAllowRetries } : {}),
        },
      })
      return NextResponse.json({ success: true, data: quiz })
    }

    const quiz = await prisma.quiz.update({
      where: { id: existing.id },
      data: {
        title, subject: cleanSubject, language: cleanLanguage, theme: cleanTheme, questions,
        ...(cleanSelfPaced !== undefined ? { selfPaced: cleanSelfPaced } : {}),
        ...(cleanTimeLimit !== undefined ? { timeLimitMinutes: cleanTimeLimit } : {}),
        ...(cleanAllowRetries !== undefined ? { allowRetries: cleanAllowRetries } : {}),
      },
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
