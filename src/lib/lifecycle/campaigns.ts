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

/**
 * Global send ceilings.
 *
 * Every guard in `guards.ts` is per-user: they bound what one person receives
 * and say nothing about what the system emits in total. That is a real gap on
 * the first live tick, because six days of dark running leaves a backlog of
 * nudges that all pass their per-user guards at the same moment. Without a
 * ceiling the first run is a bulk send — exactly the thing this system exists
 * to avoid — and it lands on a sending domain with no reputation yet.
 *
 * Two limits, because they do different jobs:
 *
 *   - the daily cap keeps total volume under the Resend plan's 100/day, with
 *     headroom for transactional overflow;
 *   - the per-tick cap spreads that allowance across the day instead of
 *     dumping it all on the first tick after quiet hours open.
 *
 * Nothing is dropped when a cap binds. Nudges stay pending and the next tick
 * picks them up, which is the same recompute-from-scratch property that makes
 * a missed run harmless.
 */
export const DEFAULT_DAILY_SEND_CAP = 80
export const DEFAULT_TICK_SEND_CAP = 20

/** The window the daily cap is measured over. Rolling, not calendar-aligned. */
export const DAILY_CAP_WINDOW_MS = 24 * HOURS

interface CapEnv {
  LIFECYCLE_DAILY_CAP?: string
  LIFECYCLE_TICK_CAP?: string
  [key: string]: string | undefined
}

/**
 * Reads a cap override. Unset or empty means the default; an explicit 0 means
 * zero, which is a legitimate way to pause sending without touching the flag.
 * Garbage falls back to the default rather than to Number('abc') === NaN, which
 * would compare false against everything and silently disable the ceiling.
 */
function readCap(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function dailySendCap(env: CapEnv = process.env): number {
  return readCap(env.LIFECYCLE_DAILY_CAP, DEFAULT_DAILY_SEND_CAP)
}

export function tickSendCap(env: CapEnv = process.env): number {
  return readCap(env.LIFECYCLE_TICK_CAP, DEFAULT_TICK_SEND_CAP)
}

export function campaignFor(key: string): Campaign | undefined {
  return CAMPAIGNS.find(c => c.key === key)
}

/** Campaigns applicable to a tier, most valuable first. */
export function campaignsForTier(tier: Tier): Campaign[] {
  return CAMPAIGNS.filter(c => c.tiers.includes(tier)).sort((a, b) => a.priority - b.priority)
}
