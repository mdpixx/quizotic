// The lifecycle evaluator. Design spec §3-§4.
//
// One cycle does three things, in this order:
//
//   1. Cancel. Anyone who reached Tier 3 since the last run has every pending
//      nudge closed. This runs first so an activated user cannot be emailed
//      by the same cycle that would have cancelled them.
//   2. Enqueue. Each eligible user gets at most one new Nudge — the highest
//      priority campaign applicable to their tier. The row surfaces in-app.
//   3. Send. Nudges whose in-app card went unseen for 48h, to users who have
//      not been active in that window, become email.
//
// The whole cycle is idempotent: it recomputes from scratch every run, holds
// no cursor, and writes through a unique constraint. A missed run costs
// nothing and a double-fire is harmless — which is what makes the hourly cron
// safe to retry and safe to deploy through.

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  CAMPAIGNS,
  IN_APP_GRACE_MS,
  SEQUENCE_WINDOW_MS,
  campaignFor,
  campaignsForTier,
  type Campaign,
} from './campaigns'
import { computeTier, hasActivated, loadTierSignals, TIER, type Tier } from './tiers'
import { evaluateGuards, type BlockReason, type GuardSubject } from './guards'
import { getOrCreateUnsubscribeToken, unsubscribeUrl } from './unsubscribe'
import { renderNudgeEmail } from './templates'

/** The guard subject plus the display name, which only the template needs. */
interface NudgeSubject extends GuardSubject {
  name: string | null
}

/**
 * First name only, and only when it looks like a name rather than an email
 * local-part or an empty string. "Hi," reads better than "Hi teacher.k99,".
 */
function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0]
  if (!first || first.length > 40 || first.includes('@')) return null
  return first
}

export interface TickResult {
  scanned: number
  cancelled: number
  enqueued: number
  sent: number
  dryRun: number
  blocked: Record<string, number>
  errors: number
}

const emptyResult = (): TickResult => ({
  scanned: 0,
  cancelled: 0,
  enqueued: 0,
  sent: 0,
  dryRun: 0,
  blocked: {},
  errors: 0,
})

const countBlock = (result: TickResult, reason: BlockReason | string) => {
  result.blocked[reason] = (result.blocked[reason] ?? 0) + 1
}

/** Users still inside the 30-day sequence window. Nobody else can be nudged. */
const SCAN_LIMIT = 2_000

export async function runLifecycleTick(now: Date = new Date()): Promise<TickResult> {
  const result = emptyResult()
  const windowStart = new Date(now.getTime() - SEQUENCE_WINDOW_MS)

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: windowStart } },
    select: {
      id: true,
      email: true,
      name: true,
      country: true,
      locale: true,
      onboarded: true,
      createdAt: true,
      lastActiveAt: true,
      lifecycleOptOutAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: SCAN_LIMIT,
  })
  result.scanned = users.length

  for (const user of users) {
    try {
      const signals = await loadTierSignals(user.id)
      if (!signals) continue

      const tier = computeTier(signals)
      const subject: NudgeSubject = { ...user, userId: user.id, signals }

      // 1. Activated users exit the sequence permanently.
      if (hasActivated(tier)) {
        result.cancelled += await cancelPending(user.id)
        continue
      }

      // 2. Enqueue at most one new nudge.
      if (await enqueueNext(user.id, tier, now)) result.enqueued++

      // 3. Email anything whose in-app card was ignored long enough.
      await sendDueEmails(subject, now, result)
    } catch (err) {
      result.errors++
      console.warn(
        '[lifecycle] user evaluation failed:',
        user.id,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return result
}

/**
 * Closes every unresolved nudge for a user who has activated.
 *
 * Deliberately does not touch 'emailed' rows — those are a record of something
 * that actually left the building and must not be rewritten.
 */
async function cancelPending(userId: string): Promise<number> {
  const { count } = await prisma.nudge.updateMany({
    where: { userId, state: { in: ['pending', 'shown'] } },
    data: { state: 'cancelled' },
  })
  return count
}

/**
 * Creates the single highest-priority applicable nudge, if the user has none
 * outstanding.
 *
 * One open nudge at a time is the point: two cards on the dashboard is a
 * to-do list, and a to-do list from a product you have not committed to yet
 * is noise.
 */
async function enqueueNext(userId: string, tier: Tier, now: Date): Promise<boolean> {
  if (tier === TIER.GHOST) return false // never nudged, by design

  const open = await prisma.nudge.count({
    where: { userId, state: { in: ['pending', 'shown'] } },
  })
  if (open > 0) return false

  const candidates = campaignsForTier(tier)
  const existing = await prisma.nudge.findMany({
    where: { userId },
    select: { campaignKey: true },
  })
  const seen = new Set(existing.map(n => n.campaignKey))

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
  if (!user) return false
  const age = now.getTime() - user.createdAt.getTime()

  const next = candidates.find(c => !seen.has(c.key) && age >= c.earliestAfterSignupMs)
  if (!next) return false

  try {
    await prisma.nudge.create({
      data: {
        userId,
        campaignKey: next.key,
        priority: next.priority,
        state: 'pending',
        expiresAt: new Date(user.createdAt.getTime() + SEQUENCE_WINDOW_MS),
      },
    })
    return true
  } catch {
    // Unique violation — another replica won the race. That is the constraint
    // doing its job, not an error worth surfacing.
    return false
  }
}

/**
 * Email is the fallback, never the first touch.
 *
 * A nudge qualifies only if its card has been sitting unseen for 48h AND the
 * user has not been in the product during that time. If they were around and
 * chose to ignore the card, mailing them the same message is exactly the
 * irritation this system exists to avoid.
 */
async function sendDueEmails(subject: NudgeSubject, now: Date, result: TickResult): Promise<void> {
  const due = await prisma.nudge.findMany({
    where: {
      userId: subject.userId,
      state: 'pending',
      shownAt: null,
      createdAt: { lte: new Date(now.getTime() - IN_APP_GRACE_MS) },
    },
    orderBy: { priority: 'asc' },
  })

  for (const nudge of due) {
    const campaign = campaignFor(nudge.campaignKey)
    if (!campaign) continue

    // Active in the grace window means they saw the dashboard and moved on.
    const active =
      subject.signals.lastActiveAt !== null &&
      subject.signals.lastActiveAt.getTime() > nudge.createdAt.getTime()
    if (active) {
      countBlock(result, 'seen-in-app')
      continue
    }

    const verdict = await evaluateGuards(subject, campaign, { now })
    if (!verdict.send) {
      countBlock(result, verdict.reason)
      continue
    }

    if (verdict.dryRun) {
      result.dryRun++
      console.log(
        `[lifecycle] DRY RUN would send ${campaign.key} to ${subject.email} (user ${subject.userId})`,
      )
      continue
    }

    const ok = await dispatch(subject, campaign, nudge.id)
    if (ok) result.sent++
    else result.errors++

    // One email per user per cycle, whatever the outcome. The budget is two
    // per month; there is no scenario where two in one hour is correct.
    return
  }
}

async function dispatch(
  subject: NudgeSubject,
  campaign: Campaign,
  nudgeId: string,
): Promise<boolean> {
  const token = await getOrCreateUnsubscribeToken(subject.userId)
  const { html, text } = renderNudgeEmail(campaign, {
    unsubscribeUrl: unsubscribeUrl(token),
    firstName: firstNameOf(subject.name),
  })

  const sent = await sendEmail({
    to: subject.email,
    subject: campaign.subject,
    html,
    text,
    channel: 'lifecycle',
    unsubscribeUrl: unsubscribeUrl(token),
    userId: subject.userId,
    category: 'lifecycle',
    metadata: { campaignKey: campaign.key, nudgeId },
  })

  if (!sent.ok) {
    console.warn(`[lifecycle] send failed for ${campaign.key}/${subject.userId}: ${sent.error}`)
    return false
  }

  // Only mark emailed after the transport confirmed. A failed send must stay
  // eligible for the next tick rather than being silently consumed.
  await prisma.nudge.update({
    where: { id: nudgeId },
    data: { state: 'emailed', emailedAt: new Date() },
  })
  return true
}

export const __test__ = { cancelPending, enqueueNext, sendDueEmails, CAMPAIGNS }
