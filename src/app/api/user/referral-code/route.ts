export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { createUniqueReferralCode } from '@/lib/referral'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ code: null })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { referralCode: true, name: true },
  })

  if (!dbUser) return NextResponse.json({ code: null })

  // Generate code on-the-fly for existing users who don't have one yet
  if (!dbUser.referralCode) {
    const code = await createUniqueReferralCode(dbUser.name || 'user')
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: code },
    })
    return NextResponse.json({ code })
  }

  return NextResponse.json({ code: dbUser.referralCode })
}
