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
    pathname.startsWith('/demo') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
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
