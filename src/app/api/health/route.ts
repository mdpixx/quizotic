import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Lightweight readiness probe for Railway. Pings the database with a
// 3-second budget so a half-dead Neon connection causes an unhealthy
// status (and a Railway restart) instead of letting traffic hit a
// process that can't actually serve requests. Returning HTML 200 from
// `/` doesn't catch this — the page renders fine while every API
// hits a DB timeout, and users see "site unreachable".
export async function GET() {
  const startedAt = Date.now()
  try {
    const dbCheck = prisma.$queryRaw`SELECT 1`
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('db_timeout_3s')), 3000),
    )
    await Promise.race([dbCheck, timeout])
    return NextResponse.json(
      { ok: true, db: 'up', uptimeMs: Date.now() - startedAt },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, db: 'down', error: message },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
