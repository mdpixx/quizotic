export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, orgType, organization, discoveryChannel, referralCode }: {
    role?: string
    orgType?: string
    organization?: string
    discoveryChannel?: string
    referralCode?: string
  } = await req.json()

  // Determine referral code: prefer manually entered, fall back to cookie
  const cookieStore = await cookies()
  const cookieRef = cookieStore.get('quizotic_ref')?.value
  const effectiveRefCode = referralCode || cookieRef || null

  // Validate referral code if present
  let validRefCode: string | null = null
  if (effectiveRefCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: effectiveRefCode },
      select: { id: true },
    })
    // Only accept if referrer exists and isn't the user themselves
    if (referrer && referrer.id !== user.id) {
      validRefCode = effectiveRefCode
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: role || null,
      orgType: orgType || null,
      organization: organization || null,
      discoveryChannel: discoveryChannel || null,
      referredByCode: validRefCode,
      onboarded: true,
    },
  })

  // Create referral reward if referred by a valid user
  if (validRefCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: validRefCode },
      select: { id: true },
    })
    if (referrer) {
      // Cap at 10 referrals (100 bonus credits)
      const existingCount = await prisma.referral.count({
        where: { referrerId: referrer.id, status: 'rewarded' },
      })
      if (existingCount < 10) {
        await prisma.referral.upsert({
          where: {
            referrerId_refereeId: { referrerId: referrer.id, refereeId: user.id },
          },
          create: {
            referrerId: referrer.id,
            refereeId: user.id,
            status: 'rewarded',
            rewardType: 'ai_credits',
            rewardValue: 10,
            rewardedAt: new Date(),
          },
          update: {}, // no-op if already exists (prevent double reward)
        })
      }
    }
  }

  // Clear the referral cookie
  const response = NextResponse.json({ success: true })
  if (cookieRef) {
    response.cookies.delete('quizotic_ref')
  }

  return response
}
