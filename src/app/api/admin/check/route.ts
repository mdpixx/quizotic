export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin-auth'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET() {
  const user = await getCurrentUser()
  const isAdmin = isAdminEmail(user?.email)
  return NextResponse.json({ isAdmin })
}
