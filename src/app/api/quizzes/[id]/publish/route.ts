export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'
import { hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'
import { nudgeAsyncSweep } from '@/lib/sweep-nudge'
import type { Question } from '@/lib/quiz-types'

type Params = { params: Promise<{ id: string }> }

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

function getSnapshotQuestions(questions: unknown): Question[] {
  return Array.isArray(questions) ? (questions as Question[]) : []
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function needsRepublish(quizUpdatedAt: Date, versionCreatedAt: Date | null | undefined): boolean {
  return !versionCreatedAt || quizUpdatedAt.getTime() > versionCreatedAt.getTime()
}

// Scheduled quizzes: opensAt gates participant entry, closesAt is when the
// background sweep ends the session. A scheduled quiz must have both bounds —
// "runs without a host" requires a defined end.
const OPENS_AT_PAST_GRACE_MS = 60 * 1000

function parseScheduleFields(
  body: Record<string, unknown>,
  existing?: { opensAt: Date | null; closesAt: Date | null },
): { ok: true; opensAt?: Date | null; closesAt?: Date | null } | { ok: false; error: string } {
  const out: { opensAt?: Date | null; closesAt?: Date | null } = {}

  if ('opensAt' in body) {
    if (body.opensAt === null) out.opensAt = null
    else if (typeof body.opensAt === 'string') {
      const d = new Date(body.opensAt)
      if (isNaN(d.getTime())) return { ok: false, error: 'Invalid opensAt date' }
      out.opensAt = d
    } else return { ok: false, error: 'Invalid opensAt date' }
  }
  if ('closesAt' in body) {
    if (body.closesAt === null) out.closesAt = null
    else if (typeof body.closesAt === 'string') {
      const d = new Date(body.closesAt)
      if (isNaN(d.getTime())) return { ok: false, error: 'Invalid closesAt date' }
      out.closesAt = d
    } else return { ok: false, error: 'Invalid closesAt date' }
  }

  const effectiveOpens = 'opensAt' in out ? out.opensAt : existing?.opensAt ?? null
  const effectiveCloses = 'closesAt' in out ? out.closesAt : existing?.closesAt ?? null

  if (effectiveOpens) {
    if (!effectiveCloses) return { ok: false, error: 'A scheduled quiz needs a close time' }
    if (effectiveOpens.getTime() >= effectiveCloses.getTime()) {
      return { ok: false, error: 'Close time must be after the open time' }
    }
    // Only reject past opensAt when the caller is actually setting it now
    if ('opensAt' in out && out.opensAt && out.opensAt.getTime() < Date.now() - OPENS_AT_PAST_GRACE_MS) {
      return { ok: false, error: 'Open time is in the past' }
    }
  }
  if (effectiveCloses && effectiveCloses.getTime() <= Date.now()) {
    if ('closesAt' in out) return { ok: false, error: 'Close time is in the past' }
  }

  return { ok: true, ...out }
}

// POST /api/quizzes/[id]/publish — publish quiz as async self-serve link
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const rawTlm = body.timeLimitMinutes
    const timeLimitMinutes = (typeof rawTlm === 'number' && Number.isInteger(rawTlm) && rawTlm > 0)
      ? rawTlm
      : null
    const schedule = parseScheduleFields(body)
    if (!schedule.ok) {
      return NextResponse.json({ success: false, error: schedule.error }, { status: 400 })
    }

    const quiz = await prisma.quiz.findFirst({ where: { id, userId: user.id } })
    if (!quiz) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const snapshot = getSnapshotQuestions(quiz.questions)
    if (snapshot.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'This quiz has no questions. Add at least one question to publish it as a self-paced quiz.',
      }, { status: 400 })
    }
    const validationIssues = validateQuizQuestions(snapshot)
    if (hasQuizValidationErrors(validationIssues)) {
      return NextResponse.json({
        success: false,
        error: 'Some questions need attention before publishing.',
        issues: validationIssues,
      }, { status: 400 })
    }

    // Idempotent: return existing open async session if one exists
    const existing = await prisma.gameSession.findFirst({
      where: { quizId: id, userId: user.id, mode: 'async', status: 'open' },
      select: {
        id: true,
        shareSlug: true,
        allowRetries: true,
        opensAt: true,
        closesAt: true,
        createdAt: true,
        participantCount: true,
        timeLimitMinutes: true,
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
            snapshot: asJson(snapshot),
            questionCount: snapshot.length,
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
            opensAt: existing.opensAt,
            closesAt: existing.closesAt,
            questionCount: version.questionCount,
            responseCount: existing.participantCount ?? 0,
            publishedAt: version.createdAt,
            needsRepublish: false,
            republished: true,
            timeLimitMinutes: existing.timeLimitMinutes ?? null,
          },
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          sessionId: existing.id,
          shareSlug: existing.shareSlug,
          allowRetries: existing.allowRetries,
          opensAt: existing.opensAt,
          closesAt: existing.closesAt,
          questionCount: existing.quizVersion?.questionCount ?? 0,
          responseCount: existing.participantCount ?? 0,
          publishedAt: existing.quizVersion?.createdAt ?? existing.createdAt,
          needsRepublish: false,
          republished: false,
          timeLimitMinutes: existing.timeLimitMinutes ?? null,
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
            snapshot: asJson(snapshot),
            questionCount: snapshot.length,
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
        timeLimitMinutes,
        opensAt: schedule.opensAt ?? null,
        closesAt: schedule.closesAt ?? null,
      },
    })
    nudgeAsyncSweep()

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        shareSlug: slug,
        questionCount: snapshot.length,
        allowRetries: false,
        opensAt: session.opensAt,
        closesAt: session.closesAt,
        timeLimitMinutes,
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

    const schedule = parseScheduleFields(body, { opensAt: session.opensAt, closesAt: session.closesAt })
    if (!schedule.ok) {
      return NextResponse.json({ success: false, error: schedule.error }, { status: 400 })
    }

    const update: { allowRetries?: boolean; opensAt?: Date | null; closesAt?: Date | null; timeLimitMinutes?: number | null } = {}
    if (typeof body.allowRetries === 'boolean') update.allowRetries = body.allowRetries
    if ('opensAt' in body) update.opensAt = schedule.opensAt ?? null
    if ('closesAt' in body) update.closesAt = schedule.closesAt ?? null
    if ('timeLimitMinutes' in body) {
      const tlm = body.timeLimitMinutes
      update.timeLimitMinutes = (typeof tlm === 'number' && Number.isInteger(tlm) && tlm > 0) ? tlm : null
    }

    const updated = await prisma.gameSession.update({ where: { id: session.id }, data: update })
    nudgeAsyncSweep()

    return NextResponse.json({
      success: true,
      data: { sessionId: updated.id, shareSlug: updated.shareSlug, allowRetries: updated.allowRetries, opensAt: updated.opensAt, closesAt: updated.closesAt, timeLimitMinutes: updated.timeLimitMinutes },
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
    nudgeAsyncSweep()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to close quiz' }, { status: 500 })
  }
}
