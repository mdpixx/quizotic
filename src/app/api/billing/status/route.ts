export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Single query — derive plan from subscription row
  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: {
      plan: true,
      status: true,
      provider: true,
      currentPeriodEnd: true,
      cancelledAt: true,
    },
  })

  const plan = (sub?.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > new Date())
    ? 'pro' : 'free'

  return NextResponse.json({
    plan,
    subscription: sub,
  })
}
