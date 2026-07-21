export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { apiError, unauthorizedApiKey } from '@/lib/public-api'
import { controlLiveSession, sessionOwnerMatches, type LiveControlAction } from '@/lib/live-control'

type Params = { params: Promise<{ id: string }> }

const VALID_ACTIONS: ReadonlySet<LiveControlAction> = new Set([
  'start',
  'next',
  'end_question',
  'show_standings',
  'end',
])

/**
 * POST /api/v1/sessions/:id/control
 * Drive a live session with a host action. Mutates the same in-memory session
 * the socket layer uses and emits the same Socket.IO events to participants,
 * so an HTTP-driven advance and a socket-driven advance are indistinguishable
 * to anyone in the room.
 *
 * `:id` is the 6-digit game code (see snapshot route for the routing note).
 *
 * This is the polling-friendly control surface the Google Slides add-on needs
 * (Apps Script can't speak Socket.IO) and a fallback for any HTTP client.
 *
 * Auth: Bearer <api_key>  (must own the session)
 * Body: { action: 'start'|'next'|'end_question'|'show_standings'|'end' }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-sessions-control',
    userId: user.id,
    userLimit: 120,
    ipLimit: 240,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: gameCode } = await params
  if (!sessionOwnerMatches(gameCode, user.id)) {
    return apiError('not_found', 'Live session not found.', 404)
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : ''
  if (!VALID_ACTIONS.has(action as LiveControlAction)) {
    return apiError(
      'validation_error',
      `action must be one of: ${[...VALID_ACTIONS].join(', ')}`,
      400
    )
  }

  const result = await controlLiveSession({
    action: action as LiveControlAction,
    gameCode,
    actor: 'http:add-in',
  })

  if (!result.ok) {
    // Map the common control errors to 409 Conflict (state transition not
    // allowed) — keeps the add-in's error handling simple.
    const status = result.error === 'Session not found.' ? 404 : 409
    return apiError('control_failed', result.error ?? 'Action failed.', status)
  }

  return NextResponse.json({ data: result })
}
