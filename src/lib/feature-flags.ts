// Server-side feature flags. Three release modes, evaluated in this order:
//
//   1. Per-user assignment (FeatureFlagAssignment) — wins over everything.
//      Used for: hand-picked beta testers, kill-switching for a specific
//      user who hit a bug, internal testing.
//   2. Master `enabled` flag is false → off for everyone.
//   3. `rolloutPercent` of 0-100 — deterministic hash of (userId + key)
//      decides if this user is in the bucket.
//
// Anonymous calls (no userId) only see the master flag — they never sit
// in a percentage rollout, since there's no stable identity to bucket on.
//
// Results are cached in-process for 30 seconds to keep the hot-path cheap
// without losing the ability to ramp a flag and have it propagate quickly.

import * as crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const CACHE_TTL_MS = 30_000

interface CachedFlag {
  enabled: boolean
  rolloutPercent: number
  fetchedAt: number
}

const flagCache = new Map<string, CachedFlag>()
const assignmentCache = new Map<string, { enabled: boolean; fetchedAt: number }>() // key: flagId:userId

async function loadFlag(key: string): Promise<CachedFlag | null> {
  const cached = flagCache.get(key)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }
  try {
    const row = await prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true, rolloutPercent: true },
    })
    if (!row) {
      // Cache the negative result too — saves DB hits for unknown keys.
      const negative = { enabled: false, rolloutPercent: 0, fetchedAt: now }
      flagCache.set(key, negative)
      return negative
    }
    const entry: CachedFlag = { enabled: row.enabled, rolloutPercent: row.rolloutPercent, fetchedAt: now }
    flagCache.set(key, entry)
    return entry
  } catch (err) {
    console.warn('[feature-flags] loadFlag failed:', key, err instanceof Error ? err.message : err)
    return null
  }
}

async function loadAssignment(flagKey: string, userId: string): Promise<boolean | null> {
  const cacheKey = `${flagKey}:${userId}`
  const cached = assignmentCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.enabled
  }
  try {
    const row = await prisma.featureFlagAssignment.findFirst({
      where: { flag: { key: flagKey }, userId },
      select: { enabled: true },
    })
    if (!row) return null
    assignmentCache.set(cacheKey, { enabled: row.enabled, fetchedAt: now })
    return row.enabled
  } catch (err) {
    console.warn('[feature-flags] loadAssignment failed:', flagKey, userId, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Stable bucket [0, 99] for (userId, flagKey). The same user+flag pair
 * always lands in the same bucket, so "ramp from 1% to 5%" never excludes
 * a user who was already inside the rollout.
 */
function bucketFor(userId: string, key: string): number {
  const hash = crypto.createHash('sha1').update(`${userId}:${key}`).digest()
  // Take 4 bytes for a 32-bit unsigned int, then mod 100.
  const n = hash.readUInt32BE(0)
  return n % 100
}

export async function isFeatureEnabled(key: string, userId?: string | null): Promise<boolean> {
  const flag = await loadFlag(key)
  if (!flag) return false
  if (!flag.enabled) return false

  if (userId) {
    const override = await loadAssignment(key, userId)
    if (override !== null) return override
    if (flag.rolloutPercent >= 100) return true
    if (flag.rolloutPercent <= 0) return false
    return bucketFor(userId, key) < flag.rolloutPercent
  }

  // Anonymous: only respect the master flag — never bucket without identity.
  return flag.rolloutPercent >= 100
}

// Force-refresh the in-process cache. Useful right after an admin toggle.
export function invalidateFlagCache(key?: string) {
  if (key) {
    flagCache.delete(key)
    for (const k of assignmentCache.keys()) {
      if (k.startsWith(`${key}:`)) assignmentCache.delete(k)
    }
  } else {
    flagCache.clear()
    assignmentCache.clear()
  }
}

export const __test__ = { bucketFor, flagCache, assignmentCache }
