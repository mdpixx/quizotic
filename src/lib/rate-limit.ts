import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Lazy ioredis client — created on first use, reused across invocations.
// Falls back to in-memory if REDIS_URL is missing or connection fails.
type RedisClient = {
  incr: (key: string) => Promise<number>
  pexpire: (key: string, ms: number) => Promise<number>
  pttl: (key: string) => Promise<number>
  status?: string
}

let redisClient: RedisClient | null = null
let redisInitTried = false

async function getRedis(): Promise<RedisClient | null> {
  if (redisClient) return redisClient
  if (redisInitTried) return null
  redisInitTried = true
  if (!process.env.REDIS_URL) return null
  try {
    const mod = await import('ioredis')
    const Redis = mod.Redis ?? mod.default
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: false,
    })
    client.on('error', (err: Error) => {
      console.warn('[rate-limit] redis error — falling back to memory:', err.message)
    })
    redisClient = client as unknown as RedisClient
    return redisClient
  } catch (err) {
    console.warn('[rate-limit] failed to init redis, using memory:', (err as Error).message)
    return null
  }
}

// ─── In-memory fallback ────────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function memoryIncrement(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now()
  const existing = memoryStore.get(key)
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs }
    memoryStore.set(key, entry)
    return entry
  }
  existing.count += 1
  return existing
}

// Lightweight periodic cleanup to prevent unbounded memory growth.
let lastSweep = 0
function maybeSweepMemory() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, v] of memoryStore) {
    if (v.resetAt <= now) memoryStore.delete(k)
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  limit: number
}

export interface RateLimitOptions {
  /** Human-readable bucket name, e.g. "generate-quiz". */
  bucket: string
  /** Stable identifier for the requester (userId or ip). */
  identifier: string
  /** Max requests allowed per window. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { bucket, identifier, limit, windowMs } = opts
  const key = `rl:${bucket}:${identifier}`

  const redis = await getRedis()
  if (redis) {
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.pexpire(key, windowMs)
      }
      const ttl = await redis.pttl(key)
      const resetAt = Date.now() + (ttl > 0 ? ttl : windowMs)
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
        limit,
      }
    } catch (err) {
      console.warn('[rate-limit] redis op failed, falling back to memory:', (err as Error).message)
    }
  }

  maybeSweepMemory()
  const entry = memoryIncrement(key, windowMs)
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    limit,
  }
}

/** Extract the best-available client IP from a Next.js request. */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/**
 * Convenience helper: check both a user-scoped and an IP-scoped bucket.
 * Returns the first failing result, or the stricter-remaining success.
 * Pass `userId=null` for anonymous endpoints (IP-only).
 */
export async function rateLimitRequest(
  req: NextRequest,
  opts: {
    bucket: string
    userId?: string | null
    userLimit?: number
    ipLimit: number
    windowMs: number
  }
): Promise<RateLimitResult> {
  const { bucket, userId, userLimit, ipLimit, windowMs } = opts
  const ip = getClientIp(req)

  const checks: Promise<RateLimitResult>[] = [
    rateLimit({ bucket: `${bucket}:ip`, identifier: ip, limit: ipLimit, windowMs }),
  ]
  if (userId && typeof userLimit === 'number') {
    checks.push(rateLimit({ bucket: `${bucket}:user`, identifier: userId, limit: userLimit, windowMs }))
  }

  const results = await Promise.all(checks)
  const failed = results.find(r => !r.ok)
  if (failed) return failed
  return results.reduce((a, b) => (a.remaining < b.remaining ? a : b))
}

/** Build a 429 response with standard headers. */
export function rateLimitResponse(result: RateLimitResult, message?: string): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: message ?? 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
