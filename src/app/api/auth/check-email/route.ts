export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

// Pre-auth lookup that lets the sign-in form tell sign-up apart from sign-in:
// sign-up blocks emails that already have an account, sign-in blocks emails
// that don't. Rate-limited per IP because it reveals account existence and
// would otherwise be an email-enumeration vector.
export async function POST(req: NextRequest) {
  const rl = await rateLimitRequest(req, {
    bucket: 'check-email',
    userId: null,
    ipLimit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  let email: unknown
  try {
    ({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const normalized = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  })

  return NextResponse.json({ exists: Boolean(user) })
}
