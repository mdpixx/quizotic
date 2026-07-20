import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for auth endpoints (5 requests per minute per IP)
const authAttempts = new Map<string, { count: number; resetAt: number }>()

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = authAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    authAttempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of authAttempts) {
      if (entry.resetAt < now) authAttempts.delete(ip)
    }
  }, 5 * 60_000)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Testimonial invitations are bearer credentials. Exchange a valid URL
  // token for an HttpOnly cookie before the page (and analytics providers)
  // load, then continue on a clean URL that is safe for history/referrers.
  if (pathname === '/share-your-story') {
    const invite = request.nextUrl.searchParams.get('invite') ?? ''
    if (/^[A-Za-z0-9_-]{43}$/.test(invite)) {
      const cleanUrl = request.nextUrl.clone()
      cleanUrl.searchParams.delete('invite')
      const response = NextResponse.redirect(cleanUrl)
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // Lax survives a top-level click from Gmail/Outlook through this
        // redirect, while still withholding the cookie on cross-site POSTs.
        sameSite: 'lax' as const,
        maxAge: 30 * 24 * 60 * 60,
      }
      response.cookies.set('quizotic_testimonial_page', invite, {
        ...cookieOptions,
        path: '/share-your-story',
      })
      response.cookies.set('quizotic_testimonial_submit', invite, {
        ...cookieOptions,
        path: '/api/testimonials',
      })
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Referrer-Policy', 'no-referrer')
      return response
    }

    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }

  // Rate limit auth sign-in POST requests
  if (pathname.startsWith('/api/auth/signin') || pathname.startsWith('/api/auth/callback')) {
    if (request.method === 'POST') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      if (isAuthRateLimited(ip)) {
        return new NextResponse('Too many authentication attempts. Try again in a minute.', { status: 429 })
      }
    }
  }

  // Public routes — no auth needed
  if (
    pathname === '/' ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/play') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Local-only design preview: lets us inspect the host runtime UI / quiz
  // builder without going through OAuth. Never enabled in production.
  if (
    process.env.NODE_ENV !== 'production' &&
    ((pathname === '/host/session' && request.nextUrl.searchParams.get('preview') === 'host-stage') ||
     (pathname === '/host/build' && request.nextUrl.searchParams.get('preview') === 'builder'))
  ) {
    return NextResponse.next()
  }

  // Protected routes — check for session token cookie
  const token =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  if (!token && pathname.startsWith('/host')) {
    const baseUrl = process.env.HOST_DOMAIN || process.env.NEXTAUTH_URL || request.url
    return NextResponse.redirect(new URL('/auth/signin', baseUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
