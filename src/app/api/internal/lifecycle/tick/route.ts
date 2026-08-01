export const dynamic = 'force-dynamic'

// The hourly lifecycle tick. Design spec §6.
//
// A Railway cron service POSTs here every hour. It reuses the existing image
// and deploy — no second codebase, no new vendor — and the endpoint is
// authenticated rather than obscure, because "nobody knows the URL" is not
// access control for something that can send mail.
//
// Every run recomputes state from scratch and holds no cursor, so a missed run
// costs nothing and a double-fire is harmless. That is what makes the cron
// safe to retry and safe to deploy through.

import { type NextRequest, NextResponse } from 'next/server'
import { runLifecycleTick } from '@/lib/lifecycle/worker'
import { acquireLock } from '@/lib/lifecycle/lock'

const LOCK_KEY = 'lifecycle:tick'

// Long enough that a slow scan is not cut short, short enough that a replica
// dying mid-tick does not block the next hourly run.
const LOCK_TTL_MS = 10 * 60 * 1000

/**
 * Constant-time comparison. A plain `===` on a secret leaks its length and
 * prefix through timing, and this endpoint is reachable from the internet.
 */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // Fail closed. An unset secret must not mean "open to everyone" on an
    // endpoint that sends email.
    console.warn('[lifecycle] CRON_SECRET is not configured; refusing tick')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !secretMatches(token, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(req: NextRequest) {
  const denied = authorize(req)
  if (denied) return denied

  const lock = await acquireLock(LOCK_KEY, LOCK_TTL_MS)
  if (!lock.acquired) {
    // Another replica is mid-tick. Not an error — the next hourly run picks up
    // anything this one would have done.
    return NextResponse.json({ skipped: 'locked' }, { status: 200 })
  }

  const startedAt = Date.now()
  try {
    const result = await runLifecycleTick()
    const durationMs = Date.now() - startedAt

    // One structured line per run. During the dry-run week this log IS the
    // product: `blocked` is the breakdown of why each candidate was refused.
    console.log('[lifecycle] tick complete', JSON.stringify({ ...result, durationMs }))

    return NextResponse.json({ ok: true, durationMs, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[lifecycle] tick failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    await lock.release()
  }
}

// Some cron providers only issue GETs. Answering 405 with an explicit hint
// beats a silent 404 that looks like a deploy problem.
export async function GET() {
  return NextResponse.json({ error: 'use POST' }, { status: 405 })
}
