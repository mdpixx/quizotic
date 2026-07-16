export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

// 128 bits — this token mints Quiz rows in the importer's account, so
// enumeration must be impossible (the async play slug's 40 bits are not
// enough here). 22 chars, URL-safe.
function generateShareToken(): string {
  return randomBytes(16).toString('base64url')
}

// POST /api/quizzes/[id]/share-link — create-or-reuse the active share link.
// Idempotent: the Share modal calls this on open; an existing active link is
// returned unchanged so repeated opens never rotate the token.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const rl = await rateLimitRequest(req, {
      bucket: 'share-link',
      userId: user.id,
      userLimit: 20,
      ipLimit: 40,
      windowMs: 60_000,
    })
    if (!rl.ok) return rateLimitResponse(rl)

    const { id } = await params
    const quiz = await prisma.quiz.findFirst({
      where: { id, userId: user.id },
      select: { id: true, questions: true },
    })
    if (!quiz) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'This quiz has no questions. Add at least one question before sharing it.',
      }, { status: 400 })
    }

    const active = await prisma.quizShareLink.findFirst({
      where: { quizId: id, revokedAt: null },
      select: { token: true, importCount: true, createdAt: true },
    })
    if (active) {
      return NextResponse.json({
        success: true,
        data: { token: active.token, url: `/import/${active.token}`, importCount: active.importCount, createdAt: active.createdAt, created: false },
      })
    }

    // Token collisions are astronomically unlikely at 128 bits; retry on the
    // unique-constraint error anyway so a fluke never surfaces as a 500.
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const link = await prisma.quizShareLink.create({
          data: { quizId: id, token: generateShareToken() },
          select: { token: true, importCount: true, createdAt: true },
        })
        return NextResponse.json({
          success: true,
          data: { token: link.token, url: `/import/${link.token}`, importCount: link.importCount, createdAt: link.createdAt, created: true },
        })
      } catch (err) {
        lastErr = err
        const code = (err as { code?: string }).code
        if (code !== 'P2002') throw err
      }
    }
    throw lastErr
  } catch (err) {
    console.error('[share-link:POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Failed to create share link' }, { status: 500 })
  }
}

// DELETE /api/quizzes/[id]/share-link — revoke the active link. Idempotent;
// a later POST issues a fresh token (revoked rows keep their import counts).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const quiz = await prisma.quiz.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!quiz) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    await prisma.quizShareLink.updateMany({
      where: { quizId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[share-link:DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Failed to revoke share link' }, { status: 500 })
  }
}
