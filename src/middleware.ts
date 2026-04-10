import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  if (nextUrl.pathname.startsWith('/host')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', nextUrl))
    }
    if (!session.user?.onboarded) {
      return NextResponse.redirect(new URL('/auth/onboard', nextUrl))
    }
  }
})

export const config = {
  matcher: ['/host/:path*'],
}
