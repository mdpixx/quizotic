// Intent tiers. Design spec §2.
//
// The tier answers one question: has this person shown enough intent that a
// nudge could plausibly change their behaviour? Everything is derived from
// tables we already write to — no new tracking, no event pipeline.
//
//   0  Ghost     never came back, never built anything.  Never nudged.
//   1  Explorer  came back or finished onboarding, but has no quiz.
//   2  Builder   built a quiz, never hosted.  Highest-value segment.
//   3  Host      ran a real session.  Activated — exits permanently.
//
// Tier 0 is expected to be 40-60% of signups. Excluding them is the single
// largest reduction in send volume and the main protection for the sending
// domain's reputation.
//
// Tier 2 is where the money is: someone who built a quiz and never pressed
// "Go Live" is the highest-intent, most recoverable person in the funnel.

import { prisma } from '@/lib/prisma'

export const TIER = {
  GHOST: 0,
  EXPLORER: 1,
  BUILDER: 2,
  HOST: 3,
} as const

export type Tier = (typeof TIER)[keyof typeof TIER]

/** A returning visit has to be a real second session, not the tail of signup. */
const RETURN_THRESHOLD_MS = 24 * 60 * 60 * 1000

export interface TierSignals {
  onboarded: boolean
  createdAt: Date
  lastActiveAt: Date | null
  quizCount: number
  /** Sessions that actually had someone in the room. */
  hostedSessionCount: number
}

/**
 * Pure tier computation, so the rules can be tested without a database.
 *
 * Note the asymmetry between tiers 2 and 3: building a quiz counts even if
 * it is empty, but hosting only counts when somebody showed up. A host who
 * opened a session alone and closed it has not experienced the product, and
 * treating that as activation would silence exactly the person most worth
 * reaching.
 */
export function computeTier(s: TierSignals): Tier {
  if (s.hostedSessionCount > 0) return TIER.HOST
  if (s.quizCount > 0) return TIER.BUILDER

  const returned =
    s.lastActiveAt !== null &&
    s.lastActiveAt.getTime() - s.createdAt.getTime() > RETURN_THRESHOLD_MS

  if (s.onboarded || returned) return TIER.EXPLORER
  return TIER.GHOST
}

/** True once the user has activated. Activation is permanent — see spec §3. */
export function hasActivated(tier: Tier): boolean {
  return tier === TIER.HOST
}

export async function loadTierSignals(userId: string): Promise<TierSignals | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarded: true, createdAt: true, lastActiveAt: true },
  })
  if (!user) return null

  const [quizCount, hostedSessionCount] = await Promise.all([
    prisma.quiz.count({ where: { userId } }),
    // participantCount > 0 is the definition of a real session. Counting bare
    // GameSession rows would treat "opened the lobby and closed it" as
    // activation.
    prisma.gameSession.count({ where: { userId, participantCount: { gt: 0 } } }),
  ])

  return { ...user, quizCount, hostedSessionCount }
}

export async function getTier(userId: string): Promise<Tier | null> {
  const signals = await loadTierSignals(userId)
  return signals ? computeTier(signals) : null
}
