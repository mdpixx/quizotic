// The anti-spam engine. Design spec §5.
//
// These are the tests that make the governing promise real: max 2 lifecycle
// emails per user per rolling 30 days, only to people who showed intent, never
// at 3am, and nothing at all until dry-run is explicitly turned off.
//
// Each guard gets a test that it blocks, and the suite as a whole asserts the
// module fails closed — an error anywhere means "do not send".

import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  emailSuppression: { findUnique: vi.fn() },
  nudge: { findUnique: vi.fn() },
  emailLog: { findMany: vi.fn() },
}))
const flagMock = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/feature-flags', () => flagMock)

import {
  allowlist,
  evaluateGuards,
  isDryRun,
  type GuardSubject,
  type LifecycleEnv,
} from '../lib/lifecycle/guards'
import { CAMPAIGNS, campaignFor } from '../lib/lifecycle/campaigns'
import { TIER } from '../lib/lifecycle/tiers'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const NOW = new Date('2026-08-01T06:00:00Z') // 11:30 IST — inside the window
const SIGNUP = new Date(NOW.getTime() - 5 * DAY)

// Tier 2 (Builder): a quiz exists, nothing hosted. The highest-value segment.
const subject = (over: Partial<GuardSubject> = {}): GuardSubject => ({
  userId: 'user-1',
  email: 'teacher@example.com',
  country: 'IN',
  locale: 'en-IN',
  createdAt: SIGNUP,
  lifecycleOptOutAt: null,
  signals: {
    onboarded: true,
    createdAt: SIGNUP,
    lastActiveAt: SIGNUP,
    quizCount: 1,
    hostedSessionCount: 0,
  },
  ...over,
})

const hostFirstSession = campaignFor('activation.host_first_session')!
const createFirstQuiz = campaignFor('activation.create_first_quiz')!

const env = (over: Partial<LifecycleEnv> = {}): LifecycleEnv => ({ LIFECYCLE_DRY_RUN: 'false', ...over })

const evaluate = (s = subject(), c = hostFirstSession, e = env()) =>
  evaluateGuards(s, c, { now: NOW, env: e })

beforeEach(() => {
  vi.clearAllMocks()
  flagMock.isFeatureEnabled.mockResolvedValue(true)
  prismaMock.emailSuppression.findUnique.mockResolvedValue(null)
  prismaMock.nudge.findUnique.mockResolvedValue(null)
  prismaMock.emailLog.findMany.mockResolvedValue([])
})

describe('the happy path exists', () => {
  it('sends when every guard passes', async () => {
    await expect(evaluate()).resolves.toEqual({ send: true, dryRun: false })
  })
})

describe('guard 1 — kill switch', () => {
  it('blocks everything when the flag is off', async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(false)
    expect(await evaluate()).toEqual({ send: false, reason: 'kill-switch' })
  })

  it('is checked first, before anything expensive', async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(false)
    await evaluate()
    expect(prismaMock.emailLog.findMany).not.toHaveBeenCalled()
  })
})

describe('guard 2 — global suppression', () => {
  it('blocks a bounced or complaining address', async () => {
    prismaMock.emailSuppression.findUnique.mockResolvedValue({ reason: 'hard_bounce' })
    expect(await evaluate()).toMatchObject({ send: false, reason: 'suppressed' })
  })

  it('looks the address up lowercased, the way the transport writes it', async () => {
    await evaluate(subject({ email: 'Teacher@Example.com ' }))
    expect(prismaMock.emailSuppression.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'teacher@example.com' } }),
    )
  })
})

describe('guard 3 — per-user opt-out', () => {
  it('blocks a user who unsubscribed', async () => {
    expect(await evaluate(subject({ lifecycleOptOutAt: new Date('2026-07-20') }))).toEqual({
      send: false,
      reason: 'opted-out',
    })
  })
})

describe('guard 4 — idempotency', () => {
  it('blocks a campaign that already went out', async () => {
    prismaMock.nudge.findUnique.mockResolvedValue({ state: 'emailed' })
    expect(await evaluate()).toMatchObject({ send: false, reason: 'already-sent' })
  })

  it('blocks a campaign the user dismissed or acted on', async () => {
    for (const state of ['acted', 'dismissed', 'cancelled', 'expired']) {
      prismaMock.nudge.findUnique.mockResolvedValue({ state })
      expect(await evaluate()).toMatchObject({ send: false, reason: 'already-sent' })
    }
  })

  it('still allows a nudge that is merely pending or shown', async () => {
    for (const state of ['pending', 'shown']) {
      prismaMock.nudge.findUnique.mockResolvedValue({ state })
      expect(await evaluate()).toEqual({ send: true, dryRun: false })
    }
  })
})

describe('guard 5 — the rolling 30-day budget', () => {
  it('blocks a third email in 30 days', async () => {
    // This is the governing constraint of the entire system.
    prismaMock.emailLog.findMany.mockResolvedValue([
      { createdAt: new Date(NOW.getTime() - 20 * DAY) },
      { createdAt: new Date(NOW.getTime() - 25 * DAY) },
    ])
    expect(await evaluate()).toMatchObject({ send: false, reason: 'budget-exhausted' })
  })

  it('allows a second email', async () => {
    prismaMock.emailLog.findMany.mockResolvedValue([
      { createdAt: new Date(NOW.getTime() - 20 * DAY) },
    ])
    expect(await evaluate()).toEqual({ send: true, dryRun: false })
  })

  it('counts only lifecycle mail that was actually sent', async () => {
    // Transactional mail is uncapped, and a failed or suppressed send never
    // reached anyone, so neither may consume budget.
    await evaluate()
    expect(prismaMock.emailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'lifecycle', status: 'sent' }),
      }),
    )
  })

  it('counts over a rolling window, not a calendar month', async () => {
    // A calendar month would let someone get two on the 30th and two more on
    // the 1st. The window has to slide.
    await evaluate()
    const where = prismaMock.emailLog.findMany.mock.calls[0]![0].where
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 30 * DAY)
  })
})

describe('guard 6 — cooldown', () => {
  it('blocks a second email inside 72 hours', async () => {
    prismaMock.emailLog.findMany.mockResolvedValue([
      { createdAt: new Date(NOW.getTime() - 40 * HOUR) },
    ])
    expect(await evaluate()).toEqual({ send: false, reason: 'cooldown' })
  })

  it('allows once the cooldown has elapsed', async () => {
    prismaMock.emailLog.findMany.mockResolvedValue([
      { createdAt: new Date(NOW.getTime() - 80 * HOUR) },
    ])
    expect(await evaluate()).toEqual({ send: true, dryRun: false })
  })
})

describe('guard 7 — quiet hours', () => {
  it('blocks a send that would land at 3am local time', async () => {
    // 21:30 UTC is 03:00 IST the next day.
    const at = new Date('2026-08-01T21:30:00Z')
    const verdict = await evaluateGuards(subject(), hostFirstSession, {
      now: at,
      env: env(),
    })
    expect(verdict).toEqual({ send: false, reason: 'quiet-hours' })
  })

  it('uses the recipient timezone, not the server one', async () => {
    // 13:00 UTC is 09:00 in New York (daytime) but 18:30 in India (daytime),
    // so pick an instant where the two disagree: 02:00 UTC is 07:30 IST
    // (too early) and 22:00 the previous day in New York (too late) —
    // whereas 16:00 UTC is 21:30 IST (blocked) and 12:00 NY (fine).
    const at = new Date('2026-08-01T16:00:00Z')
    const india = await evaluateGuards(subject({ country: 'IN' }), hostFirstSession, {
      now: at,
      env: env(),
    })
    const us = await evaluateGuards(subject({ country: 'US' }), hostFirstSession, {
      now: at,
      env: env(),
    })
    expect(india).toEqual({ send: false, reason: 'quiet-hours' })
    expect(us).toEqual({ send: true, dryRun: false })
  })

  it('falls back to IST for an unknown country', async () => {
    const at = new Date('2026-08-01T21:30:00Z') // 03:00 IST
    const verdict = await evaluateGuards(
      subject({ country: 'ZZ', locale: null }),
      hostFirstSession,
      { now: at, env: env() },
    )
    expect(verdict).toEqual({ send: false, reason: 'quiet-hours' })
  })
})

describe('guard 8 — exit re-check at send time', () => {
  it('blocks a user who activated since the nudge was enqueued', async () => {
    // The classic failure this prevents: "you haven't created a quiz yet!"
    // landing forty minutes after they created one.
    const activated = subject()
    activated.signals = { ...activated.signals, hostedSessionCount: 1 }
    expect(await evaluate(activated)).toEqual({ send: false, reason: 'activated' })
  })

  it('blocks a campaign that no longer matches the tier', async () => {
    // create_first_quiz speaks to Tier 1; this user is Tier 2 now.
    expect(await evaluate(subject(), createFirstQuiz)).toMatchObject({
      send: false,
      reason: 'not-applicable',
    })
  })

  it('never nudges a ghost', async () => {
    const ghost = subject()
    ghost.signals = { ...ghost.signals, onboarded: false, quizCount: 0, lastActiveAt: SIGNUP }
    for (const campaign of CAMPAIGNS) {
      expect(await evaluate(ghost, campaign)).toMatchObject({ send: false })
    }
  })
})

describe('sequence timing', () => {
  it('blocks a campaign before its earliest send time', async () => {
    const fresh = subject({ createdAt: new Date(NOW.getTime() - 12 * HOUR) })
    fresh.signals = { ...fresh.signals, createdAt: fresh.createdAt }
    expect(await evaluate(fresh)).toEqual({ send: false, reason: 'too-early' })
  })

  it('closes the sequence 30 days after signup regardless of tier', async () => {
    const old = subject({ createdAt: new Date(NOW.getTime() - 31 * DAY) })
    old.signals = { ...old.signals, createdAt: old.createdAt }
    expect(await evaluate(old)).toEqual({ send: false, reason: 'sequence-window-closed' })
  })
})

describe('guards 9 and 10 — rollout controls', () => {
  it('defaults to dry run when the variable is unset', () => {
    // Live-by-default would turn a config mistake into a mass email.
    expect(isDryRun({})).toBe(true)
    expect(isDryRun({ LIFECYCLE_DRY_RUN: '' })).toBe(true)
  })

  it('only leaves dry run for an explicit false', () => {
    expect(isDryRun({ LIFECYCLE_DRY_RUN: 'true' })).toBe(true)
    expect(isDryRun({ LIFECYCLE_DRY_RUN: 'yes' })).toBe(true)
    expect(isDryRun({ LIFECYCLE_DRY_RUN: 'false' })).toBe(false)
    expect(isDryRun({ LIFECYCLE_DRY_RUN: '0' })).toBe(false)
  })

  it('reports a would-be send as dry run rather than blocking it', async () => {
    const verdict = await evaluate(subject(), hostFirstSession, env({ LIFECYCLE_DRY_RUN: 'true' }))
    expect(verdict).toEqual({ send: true, dryRun: true })
  })

  it('restricts real sends to the allowlist when one is set', async () => {
    const e = env({ LIFECYCLE_TEST_EMAILS: 'mahesh@quizotic.live, pilot@example.com' })
    expect(await evaluate(subject(), hostFirstSession, e)).toEqual({
      send: false,
      reason: 'not-allowlisted',
    })
    expect(await evaluate(subject({ email: 'Pilot@Example.com' }), hostFirstSession, e)).toEqual({
      send: true,
      dryRun: false,
    })
  })

  it('parses an empty allowlist as "no restriction", not "block everyone"', () => {
    expect(allowlist({ LIFECYCLE_TEST_EMAILS: '' })).toEqual([])
    expect(allowlist({ LIFECYCLE_TEST_EMAILS: ' , ,' })).toEqual([])
  })

  it('blocks on policy before reporting dry run', async () => {
    // Otherwise the dry-run week would log intended sends that a real run
    // would have refused, and the whole observation period would be a lie.
    prismaMock.emailSuppression.findUnique.mockResolvedValue({ reason: 'hard_bounce' })
    const verdict = await evaluate(subject(), hostFirstSession, env({ LIFECYCLE_DRY_RUN: 'true' }))
    expect(verdict).toMatchObject({ send: false, reason: 'suppressed' })
  })
})

describe('failing closed', () => {
  it('refuses to send when a guard query throws', async () => {
    prismaMock.emailLog.findMany.mockRejectedValue(new Error('db down'))
    expect(await evaluate()).toEqual({ send: false, reason: 'guard-error' })
  })

  it('refuses to send when the suppression lookup throws', async () => {
    prismaMock.emailSuppression.findUnique.mockRejectedValue(new Error('db down'))
    expect(await evaluate()).toEqual({ send: false, reason: 'guard-error' })
  })
})

describe('the ladder itself', () => {
  it('gives every campaign a distinct priority so ordering is total', () => {
    const priorities = CAMPAIGNS.map(c => c.priority)
    expect(new Set(priorities).size).toBe(CAMPAIGNS.length)
  })

  it('ranks host_first_session above everything — they already did the work', () => {
    const top = [...CAMPAIGNS].sort((a, b) => a.priority - b.priority)[0]!
    expect(top.key).toBe('activation.host_first_session')
  })

  it('never offers a campaign to a ghost or an activated host', () => {
    for (const campaign of CAMPAIGNS) {
      expect(campaign.tiers).not.toContain(TIER.GHOST)
      expect(campaign.tiers).not.toContain(TIER.HOST)
    }
  })
})
