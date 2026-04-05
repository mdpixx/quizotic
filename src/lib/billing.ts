import { prisma } from '@/lib/prisma'

export type Plan = 'free' | 'pro'

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
 * Get bonus AI credits earned from referrals (10 per referral, max 100).
 */
export async function getReferralBonusCredits(userId: string): Promise<number> {
  const result = await prisma.referral.aggregate({
    where: { referrerId: userId, status: 'rewarded' },
    _sum: { rewardValue: true },
  })
  return Math.min(result._sum.rewardValue ?? 0, 100)
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
