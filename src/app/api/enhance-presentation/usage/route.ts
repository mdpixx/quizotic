export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const plan = await getUserPlan(user.id)
  const limit = PLAN_LIMITS[plan].maxAiEnhancements

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const used = await prisma.usageLog.count({
    where: {
      userId: user.id,
      action: 'ai_enhance',
      createdAt: { gte: startOfMonth },
    },
  })

  return NextResponse.json({
    success: true,
    plan,
    used,
    limit: limit ?? Infinity,
  })
}
