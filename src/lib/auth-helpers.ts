import { auth } from '@/lib/auth'
import { bumpLastActive } from '@/lib/last-active'

export interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  // Debounced (1/min/user, in-process). Powers churn / win-back queries
  // without writing on every request.
  bumpLastActive(session.user.id)
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
