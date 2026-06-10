// Server-side guard helpers shared by server.mjs (Socket.IO custom server).
// Kept in a standalone module (no server import side-effects) so vitest can
// exercise them directly.

import { randomInt } from 'crypto'

export function generateGameCode() {
  // crypto.randomInt: Math.random() codes were statistically predictable,
  // making live sessions enumerable by an attacker who sampled a few codes.
  return randomInt(100000, 1000000).toString()
}

// ─── Socket event rate limiting ────────────────────────────────
// Fixed-window counters keyed by `${bucket}:${event}`. HTTP routes already
// go through rateLimitRequest(); sockets had nothing, so join/answer floods
// went straight to the handlers (and the DB). Window entries self-expire.
const rateBuckets = new Map()

/**
 * Returns true if the call is allowed, false if rate-limited.
 * @param {string} key - unique bucket id, e.g. `${socket.id}:join_session`
 * @param {number} limit - max calls per window
 * @param {number} windowMs - window length (default 60s)
 * @param {number} [now] - injectable clock for tests
 */
export function allowRate(key, limit, windowMs = 60_000, now = Date.now()) {
  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    rateBuckets.set(key, { windowStart: now, windowMs, count: 1 })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

// Periodic sweep so abandoned buckets don't accumulate. Call once at boot.
export function startRateBucketSweep(sweepMs = 60_000) {
  const id = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart > bucket.windowMs * 2) rateBuckets.delete(key)
    }
  }, sweepMs)
  id.unref?.()
  return id
}

// Visible for tests only.
export function _clearRateBuckets() {
  rateBuckets.clear()
}

// Strip HTML angle brackets and control characters from user-visible names.
// Names are rendered via JSX (auto-escaped) today, but stored values also
// flow into CSV/XLSX exports and the DB — keep them inert at the boundary.
export function sanitizeDisplayText(value, maxLen = 30) {
  const cleaned = Array.from(String(value ?? ''))
    .filter(ch => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code !== 127 && ch !== '<' && ch !== '>'
    })
    .join('')
  return cleaned.slice(0, maxLen).trim()
}
