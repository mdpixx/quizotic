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
