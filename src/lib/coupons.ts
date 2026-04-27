// Coupon redemption logic. Validates a code (date window + active flag +
// total + per-user caps), applies the side effect, and records redemption.
//
// For Session 4 only the 'credits' and 'pro_days' kinds are wired through
// to in-app effects. 'percent_off' and 'amount_off' are stored but their
// application happens at checkout-time in the Stripe/Razorpay flow — those
// integrations are scheduled for a later session.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface RedeemArgs {
  code: string
  userId: string
}

export type RedeemResult =
  | { ok: true; coupon: { id: string; code: string; kind: string; value: number; bucket: string | null }; appliedTo?: string; appliedRefId?: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'not_yet_valid' | 'expired' | 'exhausted' | 'already_redeemed' | 'unsupported_kind'; message: string }

export async function redeemCoupon({ code, userId }: RedeemArgs): Promise<RedeemResult> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) {
    return { ok: false, reason: 'not_found', message: 'No code provided.' }
  }

  // Use a transaction to atomically increment the redemption counter so
  // two concurrent redemptions can't both pass the cap check.
  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({ where: { code: trimmed } })
    if (!coupon) return { ok: false, reason: 'not_found' as const, message: 'Code not found.' }
    if (!coupon.active) return { ok: false, reason: 'inactive' as const, message: 'This code is no longer active.' }

    const now = new Date()
    if (coupon.validFrom && coupon.validFrom > now) {
      return { ok: false, reason: 'not_yet_valid' as const, message: `This code starts on ${coupon.validFrom.toLocaleDateString()}.` }
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      return { ok: false, reason: 'expired' as const, message: 'This code has expired.' }
    }
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { ok: false, reason: 'exhausted' as const, message: 'This code has reached its redemption limit.' }
    }

    const userPriorRedemptions = await tx.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    })
    if (userPriorRedemptions >= coupon.perUserLimit) {
      return { ok: false, reason: 'already_redeemed' as const, message: 'You have already used this code.' }
    }

    let appliedTo: string | undefined
    let appliedRefId: string | undefined

    if (coupon.kind === 'credits') {
      // Mints a CreditGrant. Same path admin grants take, so the credits
      // immediately count toward the user's quota.
      const grant = await tx.creditGrant.create({
        data: {
          userId,
          bucket: coupon.bucket ?? 'questions',
          amount: coupon.value,
          reason: `Coupon redemption: ${coupon.code}`,
          grantedBy: 'system:coupon',
          metadata: { couponId: coupon.id, couponCode: coupon.code } as Prisma.InputJsonValue,
        },
      })
      appliedTo = 'credits'
      appliedRefId = grant.id
    } else if (coupon.kind === 'pro_days') {
      // Extends or starts a Pro subscription by N days.
      const existing = await tx.subscription.findUnique({ where: { userId } })
      const start = (existing?.currentPeriodEnd && existing.currentPeriodEnd > now)
        ? existing.currentPeriodEnd
        : now
      const newEnd = new Date(start.getTime() + coupon.value * 24 * 60 * 60 * 1000)
      const sub = await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: 'pro_monthly',
          status: 'active',
          provider: 'coupon',
          currentPeriodStart: now,
          currentPeriodEnd: newEnd,
        },
        update: {
          plan: 'pro_monthly',
          status: 'active',
          currentPeriodEnd: newEnd,
        },
      })
      appliedTo = 'subscription'
      appliedRefId = sub.id
    } else if (coupon.kind === 'percent_off' || coupon.kind === 'amount_off') {
      // These apply at checkout time — Session 4 stores the code on the
      // user's "pending" state but the actual discount is computed by the
      // payment provider. Until the checkout integration lands, surface
      // a useful error rather than silently no-op.
      return {
        ok: false,
        reason: 'unsupported_kind' as const,
        message: `${coupon.kind} coupons apply at checkout — not yet wired up. Stay tuned.`,
      }
    } else {
      return { ok: false, reason: 'unsupported_kind' as const, message: `Unknown coupon kind: ${coupon.kind}` }
    }

    await tx.coupon.update({
      where: { id: coupon.id },
      data: { redemptionCount: { increment: 1 } },
    })
    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId,
        appliedTo: appliedTo ?? null,
        appliedRefId: appliedRefId ?? null,
      },
    })

    return {
      ok: true,
      coupon: { id: coupon.id, code: coupon.code, kind: coupon.kind, value: coupon.value, bucket: coupon.bucket },
      appliedTo,
      appliedRefId,
    }
  })
}
