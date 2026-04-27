import { prisma } from '@/lib/prisma'

export type Plan = 'free' | 'pro'
export type AiBucket = 'questions' | 'enhancements'

export async function getUserPlan(userId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  })
  if (!sub) return 'free'
  if (sub.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
    return 'pro'
  }
  return 'free'
}

/**
 * Get bonus AI credits for a user in a given bucket. Sums two sources:
 *
 *  1. Referral rewards — historic bonus from referring others. Capped at 100.
 *     Counts only toward the 'questions' bucket since that's all referral
 *     rewards have ever granted.
 *  2. Active CreditGrant rows — admin-issued comp / refund / promotional
 *     credits. Negative grants are allowed (admin can revoke). No cap; the
 *     AdminAuditLog is the safeguard.
 *
 * `expiresAt` is honoured — expired grants are excluded.
 *
 * Used by the AI quota library to compute a user's effective monthly limit.
 */
export async function getBonusCredits(userId: string, bucket: AiBucket): Promise<number> {
  const now = new Date()

  // Referral reward (questions bucket only)
  const referralPromise = bucket === 'questions'
    ? prisma.referral.aggregate({
        where: { referrerId: userId, status: 'rewarded' },
        _sum: { rewardValue: true },
      })
    : Promise.resolve({ _sum: { rewardValue: 0 } as { rewardValue: number | null } })

  // Active manual grants for this bucket
  const grantsPromise = prisma.creditGrant.aggregate({
    where: {
      userId,
      bucket,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { amount: true },
  })

  const [referralResult, grantsResult] = await Promise.all([referralPromise, grantsPromise])
  const referralCredits = Math.min(referralResult._sum.rewardValue ?? 0, 100)
  const grantCredits = grantsResult._sum.amount ?? 0
  return referralCredits + grantCredits
}

/**
 * Back-compat wrapper for code that only cares about question-bucket credits.
 * Prefer `getBonusCredits(userId, bucket)` in new code.
 */
export async function getReferralBonusCredits(userId: string): Promise<number> {
  return getBonusCredits(userId, 'questions')
}

export const PRICES = {
  stripe: {
    monthly: process.env.STRIPE_PRICE_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_YEARLY ?? '',
  },
  razorpay: {
    monthly: process.env.RAZORPAY_PLAN_MONTHLY ?? '',
    yearly: process.env.RAZORPAY_PLAN_YEARLY ?? '',
  },
} as const
