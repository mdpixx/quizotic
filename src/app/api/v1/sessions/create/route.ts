export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { apiError, normalizeQuestions, unauthorizedApiKey } from '@/lib/public-api'
import { createLiveSession } from '@/lib/live-control'

/**
 * POST /api/v1/sessions
 * Create a LIVE session from an owned quiz. The session starts in 'lobby'
 * state — participants join with the returned gameCode, and the host drives
 * it via the /control endpoint (or over Socket.IO with a Bearer-authed socket).
 *
 * This is the HTTP counterpart to the socket `create_session` event, added so
 * that the Office/Google Slides add-ins can mint a live session without a
 * cookie-authenticated socket. Single source of truth: both paths share
 * createLiveSessionInternal in server.mjs.
 *
 * Auth: Bearer <api_key>
 * Body: { quizId, sessionMode?, anonymousMode?, teamMode?, teamCount?, displayMode? }
 */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-sessions-create',
    userId: user.id,
    userLimit: 30,
    ipLimit: 60,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const quizId = typeof body.quizId === 'string' ? body.quizId.trim() : ''
  if (!quizId) return apiError('validation_error', 'quizId is required', 400)

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, userId: user.id },
    select: { id: true, title: true, subject: true, language: true, theme: true, questions: true },
  })
  if (!quiz) return apiError('not_found', 'Quiz not found', 404)

  const questions = normalizeQuestions(quiz.questions)
  if (questions.length === 0) {
    return apiError('empty_quiz', 'The quiz has no questions. Add at least one before hosting.', 400)
  }

  const result = await createLiveSession({
    userId: user.id,
    quizData: {
      id: quiz.id,
      title: quiz.title,
      questions: questions as unknown[],
    },
    sessionMode: typeof body.sessionMode === 'string' ? body.sessionMode : undefined,
    anonymousMode: typeof body.anonymousMode === 'boolean' ? body.anonymousMode : undefined,
    teamMode: typeof body.teamMode === 'boolean' ? body.teamMode : undefined,
    teamCount: typeof body.teamCount === 'number' ? body.teamCount : undefined,
    displayMode: typeof body.displayMode === 'string' ? body.displayMode : undefined,
    // HTTP callers never supply a socket; the add-in joins the host room over
    // its own Bearer-authed socket (see getSocketUserId Bearer branch).
    primaryHostSocketId: null,
  })

  if (!result.ok || !result.gameCode) {
    return apiError('session_create_failed', result.error ?? 'Failed to create session.', 503)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.quizotic.live'
  return NextResponse.json(
    {
      data: {
        gameCode: result.gameCode,
        hostControlToken: result.hostResumeToken,
        joinUrl: `${appUrl}/join?code=${result.gameCode}`,
        embedUrl: `${appUrl}/embed/session/${result.gameCode}`,
        phase: 'lobby',
      },
    },
    { status: 201 }
  )
}
