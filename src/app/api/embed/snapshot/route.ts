export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { rateLimitRequest, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { publicSnapshotLiveSession } from '@/lib/live-control'

/**
 * GET /api/embed/snapshot?code=XXXXXX
 * Public, unauthenticated read-only snapshot of a live session — the data the
 * on-slide embed view (/embed/session/:code) polls to render lobby / question
 * / standings / ended phases without a Socket.IO subscription.
 *
 * Returns ONLY what an audience member can already see: join code, title,
 * current question text + options (correct answers stripped), aggregate answer
 * counts, connected/total participant counts. No leaderboard names, no PII.
 *
 * Rate-limited per IP to keep a polling client from hammering the server.
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimitRequest(req, {
    bucket: 'embed-snapshot',
    // No userId — public endpoint. IP-only bucket, generous for a 1.5s poll.
    ipLimit: 180,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const code = String(new URL(req.url).searchParams.get('code') || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'code must be a 6-digit game code' },
      { status: 400 }
    )
  }

  const snapshot = publicSnapshotLiveSession(code)
  if (!snapshot) {
    // 404, not 200 — distinct from the session-exists route which always
    // returns 200 with { exists: false }. The embed view treats 404 as
    // "session not live, show waiting state".
    return NextResponse.json(
      { error: 'Live session not found', exists: false },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { data: snapshot },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// Re-export for tests that want to bypass the route layer.
export { getClientIp }
