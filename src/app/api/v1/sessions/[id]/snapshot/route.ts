export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { apiError, unauthorizedApiKey } from '@/lib/public-api'
import { snapshotLiveSession, sessionOwnerMatches } from '@/lib/live-control'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/sessions/:id/snapshot
 * Read-only snapshot of a live session: phase, current question (sanitized of
 * correct-answer material), per-option answer counts, connected/answered
 * counts, top-5 leaderboard, and the absolute question window timestamps.
 *
 * `:id` here is the 6-digit game code (the live-control bridge keys on it).
 * Sibling routes under [id] accept either the DB id or the code, but the live
 * control surface is code-only because live sessions live in memory keyed by
 * code, not in the DB.
 *
 * Powers the Google Slides add-on (Apps Script sandbox can't use Socket.IO)
 * and any HTTP polling client. Ownership-gated: only the host who created the
 * session may read its snapshot.
 *
 * Auth: Bearer <api_key>
 */
export async function GET(req: NextRequest, { params }: Params) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-sessions-snapshot',
    userId: user.id,
    // Snapshot is the add-in's polling fallback — allow a higher read rate.
    userLimit: 120,
    ipLimit: 240,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { id: gameCode } = await params
  if (!sessionOwnerMatches(gameCode, user.id)) {
    // Don't leak whether a session exists — same 404 for unknown vs. foreign.
    return apiError('not_found', 'Live session not found.', 404)
  }

  const snapshot = snapshotLiveSession(gameCode)
  if (!snapshot) {
    return apiError('not_found', 'Live session not found.', 404)
  }

  return NextResponse.json({ data: snapshot })
}
