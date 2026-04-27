// Session 4 unit tests for the redeemCoupon flow. Mocks prisma at the
// boundary — no real DB. Covers the gates (date window, active flag,
// total cap, per-user cap, unsupported kind) and the two implemented side
// effects (credits → CreditGrant, pro_days → Subscription extend).

import { describe, expect, it, vi, beforeEach } from 'vitest'

const txMock = vi.hoisted(() => ({
  coupon: { findUnique: vi.fn(), update: vi.fn() },
  couponRedemption: { count: vi.fn(), create: vi.fn() },
  creditGrant: { create: vi.fn() },
  subscription: { findUnique: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  },
}))

import { redeemCoupon } from '../lib/coupons'

beforeEach(() => {
  txMock.coupon.findUnique.mockReset()
  txMock.coupon.update.mockReset()
  txMock.couponRedemption.count.mockReset()
  txMock.couponRedemption.create.mockReset()
  txMock.creditGrant.create.mockReset()
  txMock.subscription.findUnique.mockReset()
  txMock.subscription.upsert.mockReset()
  // Sensible defaults
  txMock.coupon.update.mockResolvedValue({})
  txMock.couponRedemption.create.mockResolvedValue({})
  txMock.creditGrant.create.mockResolvedValue({ id: 'grant-1' })
  txMock.subscription.upsert.mockResolvedValue({ id: 'sub-1' })
})

describe('redeemCoupon', () => {
  it('rejects when code does not exist', async () => {
    txMock.coupon.findUnique.mockResolvedValue(null)
    const r = await redeemCoupon({ code: 'NOPE', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('not_found')
  })

  it('rejects inactive coupons', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'X', kind: 'credits', value: 50, bucket: 'questions', active: false, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    const r = await redeemCoupon({ code: 'X', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('inactive')
  })

  it('rejects expired coupons', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'X', kind: 'credits', value: 50, bucket: 'questions', active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: new Date(Date.now() - 86400_000) })
    const r = await redeemCoupon({ code: 'X', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('expired')
  })

  it('rejects not-yet-valid coupons', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'X', kind: 'credits', value: 50, bucket: 'questions', active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: new Date(Date.now() + 86400_000), validUntil: null })
    const r = await redeemCoupon({ code: 'X', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('not_yet_valid')
  })

  it('rejects when total redemption cap is reached', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'X', kind: 'credits', value: 50, bucket: 'questions', active: true, redemptionCount: 100, maxRedemptions: 100, perUserLimit: 1, validFrom: null, validUntil: null })
    const r = await redeemCoupon({ code: 'X', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('exhausted')
  })

  it('rejects when user has already redeemed (perUserLimit)', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'X', kind: 'credits', value: 50, bucket: 'questions', active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    txMock.couponRedemption.count.mockResolvedValue(1)
    const r = await redeemCoupon({ code: 'X', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('already_redeemed')
  })

  it('grants credits via CreditGrant for kind=credits', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'WELCOME50', kind: 'credits', value: 50, bucket: 'questions', active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    txMock.couponRedemption.count.mockResolvedValue(0)
    const r = await redeemCoupon({ code: 'WELCOME50', userId: 'u1' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.appliedTo).toBe('credits')
      expect(r.appliedRefId).toBe('grant-1')
    }
    expect(txMock.creditGrant.create).toHaveBeenCalledOnce()
    const grantArg = txMock.creditGrant.create.mock.calls[0][0] as unknown as { data: { userId: string; amount: number; bucket: string; grantedBy: string; reason: string } }
    expect(grantArg.data.userId).toBe('u1')
    expect(grantArg.data.amount).toBe(50)
    expect(grantArg.data.bucket).toBe('questions')
    expect(grantArg.data.grantedBy).toBe('system:coupon')
    expect(grantArg.data.reason).toContain('WELCOME50')
  })

  it('extends a pro subscription for kind=pro_days when user has none', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'PRO30', kind: 'pro_days', value: 30, bucket: null, active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    txMock.couponRedemption.count.mockResolvedValue(0)
    txMock.subscription.findUnique.mockResolvedValue(null)
    const r = await redeemCoupon({ code: 'PRO30', userId: 'u1' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.appliedTo).toBe('subscription')
    expect(txMock.subscription.upsert).toHaveBeenCalledOnce()
    const arg = txMock.subscription.upsert.mock.calls[0][0] as unknown as { create: { currentPeriodEnd: Date }; update: { currentPeriodEnd: Date } }
    const created = arg.create.currentPeriodEnd
    const expectedDelta = 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(created.getTime() - (Date.now() + expectedDelta))).toBeLessThan(2_000)
  })

  it('extends an existing pro subscription past its current end', async () => {
    const existingEnd = new Date(Date.now() + 5 * 86400_000) // 5 days from now
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'PRO30', kind: 'pro_days', value: 30, bucket: null, active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    txMock.couponRedemption.count.mockResolvedValue(0)
    txMock.subscription.findUnique.mockResolvedValue({ currentPeriodEnd: existingEnd })
    const r = await redeemCoupon({ code: 'PRO30', userId: 'u1' })
    expect(r.ok).toBe(true)
    const arg = txMock.subscription.upsert.mock.calls[0][0] as unknown as { update: { currentPeriodEnd: Date } }
    const newEnd = arg.update.currentPeriodEnd
    const expected = existingEnd.getTime() + 30 * 86400_000
    expect(Math.abs(newEnd.getTime() - expected)).toBeLessThan(1_000)
  })

  it('rejects checkout-only coupon kinds with a useful message', async () => {
    txMock.coupon.findUnique.mockResolvedValue({ id: 'c1', code: 'OFF20', kind: 'percent_off', value: 20, bucket: null, active: true, redemptionCount: 0, maxRedemptions: null, perUserLimit: 1, validFrom: null, validUntil: null })
    txMock.couponRedemption.count.mockResolvedValue(0)
    const r = await redeemCoupon({ code: 'OFF20', userId: 'u1' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('unsupported_kind')
      expect(r.message).toContain('checkout')
    }
  })

  it('upper-cases and trims input code', async () => {
    txMock.coupon.findUnique.mockResolvedValue(null)
    await redeemCoupon({ code: '  welcome50  ', userId: 'u1' })
    expect(txMock.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'WELCOME50' } })
  })
})
