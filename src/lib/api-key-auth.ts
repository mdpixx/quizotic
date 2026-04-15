import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface ApiKeyUser {
  id: string
  email: string
}

/**
 * Validate Bearer token from Authorization header against User.apiKey.
 * Returns the user if valid, null if not.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyUser | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const key = auth.slice(7).trim()
  if (!key) return null

  const user = await prisma.user.findUnique({
    where: { apiKey: key },
    select: { id: true, email: true },
  })
  return user ?? null
}
