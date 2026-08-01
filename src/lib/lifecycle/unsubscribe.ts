// Unsubscribe tokens for the lifecycle email channel.
//
// Every lifecycle send must carry a working one-click unsubscribe URL — the
// transport refuses to send without one, and Google's bulk-sender rules treat
// a missing List-Unsubscribe header as a deliverability problem. This module
// is the only place tokens are minted, so the URL shape stays consistent
// between the header and the visible footer link.
//
// The token identifies a user, not a campaign: unsubscribing is a decision
// about lifecycle mail as a whole, not about the specific nudge that prompted
// it. It is stable once minted, so a link in an old email keeps working.

import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

// 32 bytes of base64url. This has to be unguessable, not merely unique: the
// token is the entire authorisation for changing someone's mail preferences,
// with no login in the way. A cuid would be far too predictable.
const TOKEN_BYTES = 32

export function generateUnsubscribeToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://www.quizotic.live'
  return raw.replace(/\/+$/, '')
}

export function unsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/api/unsubscribe/${encodeURIComponent(token)}`
}

/**
 * Returns the user's unsubscribe token, minting one on first use.
 *
 * Concurrent callers can race here — two lifecycle sends for the same user in
 * the same tick would both see a null token. The update is therefore
 * conditional on the token still being null, and a loser re-reads the winner's
 * value rather than overwriting it. Overwriting would silently break the
 * unsubscribe link in every email already delivered.
 */
export async function getOrCreateUnsubscribeToken(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  })
  if (!existing) throw new Error(`user ${userId} not found`)
  if (existing.unsubscribeToken) return existing.unsubscribeToken

  const token = generateUnsubscribeToken()
  const claimed = await prisma.user.updateMany({
    where: { id: userId, unsubscribeToken: null },
    data: { unsubscribeToken: token },
  })
  if (claimed.count === 1) return token

  const winner = await prisma.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  })
  if (!winner?.unsubscribeToken) throw new Error(`failed to mint unsubscribe token for ${userId}`)
  return winner.unsubscribeToken
}
