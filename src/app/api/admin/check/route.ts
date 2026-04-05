export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export async function GET() {
  const user = await getCurrentUser()
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  return NextResponse.json({ isAdmin })
}
