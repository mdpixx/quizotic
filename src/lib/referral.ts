import { prisma } from './prisma'

export function generateReferralCode(name: string): string {
  const prefix = name
    .toLowerCase()
    .split(' ')[0]
    .replace(/[^a-z]/g, '')
    .slice(0, 10)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${prefix || 'user'}-${suffix}`
}

/**
 * Generate a unique referral code for a user, retrying on collision.
 */
export async function createUniqueReferralCode(name: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode(name)
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }
  // Fallback: use longer suffix
  const suffix = Math.random().toString(36).slice(2, 8)
  const prefix = (name || 'user').toLowerCase().split(' ')[0].replace(/[^a-z]/g, '').slice(0, 10)
  return `${prefix || 'user'}-${suffix}`
}
