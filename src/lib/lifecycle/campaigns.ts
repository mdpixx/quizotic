// The nudge ladder. Design spec §3.
//
// Not a drip sequence — a priority queue with a budget. The worker picks the
// single highest-value eligible nudge per user per cycle and spends budget on
// it.
//
// The budget is 2 and there are 3 campaigns, so a user moving through the
// funnel naturally consumes the two most valuable slots and never receives
// the last-touch. That is the intended behaviour, not an oversight.

import { TIER, type Tier } from './tiers'

export const CAMPAIGN_KEYS = [
  'activation.host_first_session',
  'activation.create_first_quiz',
  'activation.last_touch',
] as const

export type CampaignKey = (typeof CAMPAIGN_KEYS)[number]

const HOURS = 60 * 60 * 1000
const DAYS = 24 * HOURS

export interface Campaign {
  key: CampaignKey
  /** 1 is highest. Ties are impossible — every campaign has a distinct value. */
  priority: number
  /** Earliest this may fire, measured from signup. */
  earliestAfterSignupMs: number
  /** Tiers this campaign speaks to. Anything else means it is not applicable. */
  tiers: readonly Tier[]
  subject: string
}

export const CAMPAIGNS: readonly Campaign[] = [
  {
    // Highest priority for a reason: they already did the hard part. The only
    // thing between them and activation is pressing one button.
    key: 'activation.host_first_session',
    priority: 1,
    earliestAfterSignupMs: 48 * HOURS,
    tiers: [TIER.BUILDER],
    subject: 'Your quiz is ready — want to run it?',
  },
  {
    key: 'activation.create_first_quiz',
    priority: 2,
    earliestAfterSignupMs: 72 * HOURS,
    tiers: [TIER.EXPLORER],
    subject: 'A quiz in about five minutes',
  },
  {
    key: 'activation.last_touch',
    priority: 3,
    earliestAfterSignupMs: 10 * DAYS,
    tiers: [TIER.EXPLORER, TIER.BUILDER],
    subject: 'Anything we can help with?',
  },
] as const

/** No activation nudge ever fires more than 30 days after signup, at any tier. */
export const SEQUENCE_WINDOW_MS = 30 * DAYS

/** Max lifecycle emails per user per rolling 30 days. Spec §1, rule 1. */
export const EMAIL_BUDGET = 2
export const BUDGET_WINDOW_MS = 30 * DAYS

/** Minimum gap between any two lifecycle emails. Spec §5, guard 6. */
export const COOLDOWN_MS = 72 * HOURS

/**
 * How long an unseen in-app card waits before email becomes the fallback.
 * Spec §4: if they were in the product and ignored the card, mailing them the
 * same message is exactly the irritation we are avoiding.
 */
export const IN_APP_GRACE_MS = 48 * HOURS

export const KILL_SWITCH_FLAG = 'lifecycle_emails_enabled'

export function campaignFor(key: string): Campaign | undefined {
  return CAMPAIGNS.find(c => c.key === key)
}

/** Campaigns applicable to a tier, most valuable first. */
export function campaignsForTier(tier: Tier): Campaign[] {
  return CAMPAIGNS.filter(c => c.tiers.includes(tier)).sort((a, b) => a.priority - b.priority)
}
