export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

const LOW_BALANCE_THRESHOLD = 5 // remaining credits below this → "low" warning
const CACHE_TTL_MS = 10 * 60 * 1000 // OpenRouter balance moves slowly + the endpoint is rate-limited

interface CreditsResult {
  remaining: number
  totalCredits: number
  totalUsage: number
  low: boolean
  cachedAt: string
}

// Module-level cache: serve the same balance for 10 minutes across requests.
let cache: { value: CreditsResult; ts: number } | null = null

// GET /api/admin/openrouter-credits — remaining OpenRouter account balance.
// Uses the same OPENROUTER_API_KEY the AI generation routes use; the key is
// account-scoped so /credits returns the account's purchased-vs-used totals.
export async function GET() {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.value, cached: true })
  }

  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json({ error: `OpenRouter responded ${res.status}`, detail: detail.slice(0, 200) }, { status: 502 })
    }

    const body = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } }
    const data = body.data
    // Surface a shape mismatch as an error rather than a misleading $0 balance.
    if (!data || typeof data.total_credits !== 'number' || typeof data.total_usage !== 'number') {
      return NextResponse.json({ error: 'Unexpected OpenRouter response shape' }, { status: 502 })
    }

    const remaining = Math.round((data.total_credits - data.total_usage) * 100) / 100
    const value: CreditsResult = {
      remaining,
      totalCredits: data.total_credits,
      totalUsage: data.total_usage,
      low: remaining < LOW_BALANCE_THRESHOLD,
      cachedAt: new Date().toISOString(),
    }
    cache = { value, ts: Date.now() }
    return NextResponse.json({ ...value, cached: false })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch OpenRouter credits' },
      { status: 502 },
    )
  }
}
