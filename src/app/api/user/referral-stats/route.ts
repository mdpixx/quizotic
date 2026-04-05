export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const referrals = await prisma.referral.findMany({
    where: { referrerId: user.id, status: 'rewarded' },
    select: { rewardValue: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const referralCount = referrals.length
  const bonusCredits = Math.min(
    referrals.reduce((sum, r) => sum + (r.rewardValue ?? 0), 0),
    100,
  )

  return NextResponse.json({
    referralCount,
    bonusCredits,
    maxCredits: 100,
    maxReferrals: 10,
  })
}
