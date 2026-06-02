import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

export interface AdminUser {
  id: string
  email: string | null
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function requireAdmin(): Promise<{ admin: AdminUser; response: null } | { admin: null; response: NextResponse }> {
  const admin = await getCurrentUser()
  if (!admin || !isAdminEmail(admin.email)) {
    return {
      admin: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return { admin: { id: admin.id, email: admin.email ?? null }, response: null }
}
