// Tests for the feature flag evaluation order:
//   1. Per-user assignment wins over everything (force on / force off).
//   2. Master flag.enabled=false → off for everyone.
//   3. rolloutPercent — deterministic bucket of (userId, key).

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { findUniqueMock, findFirstAssignmentMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn<(arg: unknown) => Promise<unknown>>(() => Promise.resolve(null)),
  findFirstAssignmentMock: vi.fn<(arg: unknown) => Promise<unknown>>(() => Promise.resolve(null)),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    featureFlag: { findUnique: findUniqueMock },
    featureFlagAssignment: { findFirst: findFirstAssignmentMock },
  },
}))

import { isFeatureEnabled, invalidateFlagCache, __test__ } from '../lib/feature-flags'

beforeEach(() => {
  findUniqueMock.mockReset()
  findFirstAssignmentMock.mockReset()
  invalidateFlagCache()
})

describe('isFeatureEnabled', () => {
  it('returns false when flag does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(await isFeatureEnabled('nonexistent', 'u1')).toBe(false)
  })

  it('returns false when master flag is disabled', async () => {
    findUniqueMock.mockResolvedValue({ enabled: false, rolloutPercent: 100 })
    expect(await isFeatureEnabled('off_flag', 'u1')).toBe(false)
  })

  it('returns true when rolloutPercent=100 and user is signed in', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 100 })
    findFirstAssignmentMock.mockResolvedValue(null)
    expect(await isFeatureEnabled('full_rollout', 'u1')).toBe(true)
  })

  it('returns false when rolloutPercent=0 and no assignment', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 0 })
    findFirstAssignmentMock.mockResolvedValue(null)
    expect(await isFeatureEnabled('zero_rollout', 'u1')).toBe(false)
  })

  it('per-user assignment overrides percentage rollout (force on)', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 0 })
    findFirstAssignmentMock.mockResolvedValue({ enabled: true })
    expect(await isFeatureEnabled('beta', 'u1')).toBe(true)
  })

  it('per-user assignment overrides percentage rollout (force off)', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 100 })
    findFirstAssignmentMock.mockResolvedValue({ enabled: false })
    expect(await isFeatureEnabled('beta', 'u1')).toBe(false)
  })

  it('anonymous calls without userId only respect 100% rollout', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 50 })
    expect(await isFeatureEnabled('half_rollout', null)).toBe(false)
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 100 })
    invalidateFlagCache()
    expect(await isFeatureEnabled('half_rollout', null)).toBe(true)
  })

  it('bucketFor is deterministic for the same (userId, key)', () => {
    const a = __test__.bucketFor('user-abc', 'flag1')
    const b = __test__.bucketFor('user-abc', 'flag1')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(100)
  })

  it('bucketFor produces a roughly-uniform distribution across users', () => {
    const buckets = new Array(100).fill(0)
    for (let i = 0; i < 1000; i++) {
      buckets[__test__.bucketFor(`user-${i}`, 'flag1')]++
    }
    // No bucket should be empty across 1000 samples; expected ~10 per bucket
    expect(Math.min(...buckets)).toBeGreaterThan(0)
    expect(Math.max(...buckets)).toBeLessThan(40)
  })

  it('caches positive results to avoid repeated DB hits', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 100 })
    findFirstAssignmentMock.mockResolvedValue(null)
    await isFeatureEnabled('cached', 'u1')
    await isFeatureEnabled('cached', 'u1')
    await isFeatureEnabled('cached', 'u1')
    // findUnique called once because of cache hit
    expect(findUniqueMock).toHaveBeenCalledTimes(1)
  })

  it('invalidateFlagCache forces a re-fetch', async () => {
    findUniqueMock.mockResolvedValue({ enabled: true, rolloutPercent: 100 })
    findFirstAssignmentMock.mockResolvedValue(null)
    await isFeatureEnabled('flag_a', 'u1')
    invalidateFlagCache('flag_a')
    await isFeatureEnabled('flag_a', 'u1')
    expect(findUniqueMock).toHaveBeenCalledTimes(2)
  })
})
