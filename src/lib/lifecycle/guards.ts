// The anti-spam engine. Design spec §5.
//
// Ten blocking checks, evaluated in order, every one of which can stop a send.
// The order is not cosmetic: the cheap, absolute checks (kill switch, opt-out)
// run before the expensive ones (tier recomputation), and the two rollout
// controls run last so that a send blocked by policy is never reported as
// "would have been dry-run".
//
// Every guard returns a reason string rather than a boolean, because the
// dry-run week is only useful if the log says *why* nothing was sent.
//
// The whole module fails closed. An unexpected error anywhere is treated as
// "do not send" — a missed nudge costs nothing, a wrongly-sent one spends
// trust we cannot get back.

import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/feature-flags'
import {
  BUDGET_WINDOW_MS,
  COOLDOWN_MS,
  EMAIL_BUDGET,
  KILL_SWITCH_FLAG,
  SEQUENCE_WINDOW_MS,
  type Campaign,
} from './campaigns'
import { computeTier, hasActivated, type TierSignals } from './tiers'
import { isWithinSendWindow } from './quiet-hours'

export type BlockReason =
  | 'kill-switch'
  | 'suppressed'
  | 'opted-out'
  | 'already-sent'
  | 'budget-exhausted'
  | 'cooldown'
  | 'quiet-hours'
  | 'activated'
  | 'sequence-window-closed'
  | 'not-applicable'
  | 'too-early'
  | 'not-allowlisted'
  | 'guard-error'

export type GuardVerdict =
  | { send: true; dryRun: boolean }
  | { send: false; reason: BlockReason; detail?: string }

export interface GuardSubject {
  userId: string
  email: string
  country: string | null
  locale: string | null
  createdAt: Date
  lifecycleOptOutAt: Date | null
  signals: TierSignals
}

/**
 * The two variables this module reads, named so a reader does not have to go
 * hunting. The index signature is what lets `process.env` be passed directly.
 */
export interface LifecycleEnv {
  LIFECYCLE_DRY_RUN?: string
  LIFECYCLE_TEST_EMAILS?: string
  [key: string]: string | undefined
}

export interface GuardOptions {
  now?: Date
  /** Injectable so tests do not depend on ambient process.env. */
  env?: LifecycleEnv
}

export function isDryRun(env: LifecycleEnv = process.env): boolean {
  // Defaults to ON. Shipping this system live-by-default would mean a config
  // mistake becomes a mass email rather than a quiet log line.
  const raw = env.LIFECYCLE_DRY_RUN
  if (raw === undefined || raw === '') return true
  return raw.toLowerCase() !== 'false' && raw !== '0'
}

export function allowlist(env: LifecycleEnv = process.env): string[] {
  return (env.LIFECYCLE_TEST_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Decides whether one campaign may be sent to one user, right now.
 *
 * Called at *send* time, not enqueue time. That is the whole point of guard 8:
 * it is what stops "you haven't created a quiz yet!" landing forty minutes
 * after they created one.
 */
export async function evaluateGuards(
  subject: GuardSubject,
  campaign: Campaign,
  options: GuardOptions = {},
): Promise<GuardVerdict> {
  const now = options.now ?? new Date()
  const env = options.env ?? process.env

  try {
    // 1. Kill switch. isFeatureEnabled already fails closed on a DB error.
    if (!(await isFeatureEnabled(KILL_SWITCH_FLAG, subject.userId))) {
      return { send: false, reason: 'kill-switch' }
    }

    // 2. Global suppression — bounces and complaints, keyed by address.
    const suppressed = await prisma.emailSuppression.findUnique({
      where: { email: subject.email.toLowerCase().trim() },
      select: { reason: true },
    })
    if (suppressed) return { send: false, reason: 'suppressed', detail: suppressed.reason }

    // 3. Per-user opt-out.
    if (subject.lifecycleOptOutAt) return { send: false, reason: 'opted-out' }

    // 4. Idempotency. The unique constraint makes a duplicate physically
    //    impossible; this check exists so we skip the work and log a reason
    //    instead of catching a constraint violation.
    const existing = await prisma.nudge.findUnique({
      where: { userId_campaignKey: { userId: subject.userId, campaignKey: campaign.key } },
      select: { state: true },
    })
    if (existing && existing.state !== 'pending' && existing.state !== 'shown') {
      return { send: false, reason: 'already-sent', detail: existing.state }
    }

    // Sequence window — no activation nudge more than 30 days after signup.
    if (now.getTime() - subject.createdAt.getTime() > SEQUENCE_WINDOW_MS) {
      return { send: false, reason: 'sequence-window-closed' }
    }
    if (now.getTime() - subject.createdAt.getTime() < campaign.earliestAfterSignupMs) {
      return { send: false, reason: 'too-early' }
    }

    // 5 + 6. Rolling budget and cooldown, from one query. EmailLog is the
    //        source of truth rather than Nudge.emailedAt, because it records
    //        what the transport actually did.
    const since = new Date(now.getTime() - BUDGET_WINDOW_MS)
    const recent = await prisma.emailLog.findMany({
      where: {
        userId: subject.userId,
        category: 'lifecycle',
        status: 'sent',
        createdAt: { gte: since },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    if (recent.length >= EMAIL_BUDGET) {
      return { send: false, reason: 'budget-exhausted', detail: `${recent.length} in 30d` }
    }
    const last = recent[0]
    if (last && now.getTime() - last.createdAt.getTime() < COOLDOWN_MS) {
      return { send: false, reason: 'cooldown' }
    }

    // 7. Quiet hours — 09:00-19:00 local. A deferred send is retried by the
    //    next hourly tick, so this costs nothing but a delay.
    if (!isWithinSendWindow(now, subject.country, subject.locale)) {
      return { send: false, reason: 'quiet-hours' }
    }

    // 8. Exit re-check. Recompute the tier from live signals, not from
    //    whatever was true when the nudge was enqueued.
    const tier = computeTier(subject.signals)
    if (hasActivated(tier)) return { send: false, reason: 'activated' }
    if (!campaign.tiers.includes(tier)) {
      return { send: false, reason: 'not-applicable', detail: `tier ${tier}` }
    }

    // 10. Allowlist, when one is configured. Checked before dry-run so the
    //     log distinguishes "excluded from the pilot" from "would have sent".
    const allowed = allowlist(env)
    if (allowed.length > 0 && !allowed.includes(subject.email.toLowerCase().trim())) {
      return { send: false, reason: 'not-allowlisted' }
    }

    // 9. Dry run. Everything above passed — this would have been a real send.
    return { send: true, dryRun: isDryRun(env) }
  } catch (err) {
    console.warn(
      '[lifecycle] guard evaluation failed, refusing to send:',
      campaign.key,
      subject.userId,
      err instanceof Error ? err.message : err,
    )
    return { send: false, reason: 'guard-error' }
  }
}
