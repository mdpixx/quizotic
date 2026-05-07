import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  // Validate the referral code exists
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  })

  const baseUrl = process.env.HOST_DOMAIN || process.env.NEXTAUTH_URL || _req.url
  const response = NextResponse.redirect(
    new URL(referrer ? '/auth/signin' : '/', baseUrl)
  )

  // Set referral cookie (30-day expiry) if code is valid
  if (referrer) {
    response.cookies.set('quizotic_ref', code, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  // Tell crawlers not to index referral redirect URLs themselves — they're
  // utility endpoints, not search-worthy pages.
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')

  return response
}
