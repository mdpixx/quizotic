export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getReferralBonusCredits } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [plan, usageLogs] = await Promise.all([
    getUserPlan(user.id),
    prisma.usageLog.findMany({
      where: { userId: user.id, action: { in: ['ai_generate', 'ai_translate'] }, createdAt: { gte: startOfMonth } },
      select: { metadata: true },
    }),
  ])

  const used = usageLogs.reduce((sum, log) => {
    const meta = log.metadata as Record<string, unknown> | null
    return sum + (typeof meta?.questionCount === 'number' ? meta.questionCount : 5)
  }, 0)

  const bonusCredits = await getReferralBonusCredits(user.id)
  const limit = PLAN_LIMITS[plan].maxAiQuestions + bonusCredits

  return NextResponse.json({ used, limit, plan, bonusCredits })
}
