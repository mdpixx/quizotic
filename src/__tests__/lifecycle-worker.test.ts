// The evaluator. Design spec §3-§4.
//
// The behaviours pinned here are the ones that are expensive to get wrong:
//
//   - Activation cancels everything pending, and cancelling happens before
//     sending in the same cycle.
//   - Exactly one open nudge per user, and it is the highest-priority one.
//   - Email is the fallback, never the first touch: the card has to go unseen
//     for 48h AND the user has to have stayed away.
//   - A failed send stays eligible; it is not silently consumed.
//   - Dry run reaches the transport zero times.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  quiz: { count: vi.fn() },
  gameSession: { count: vi.fn() },
  nudge: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  emailSuppression: { findUnique: vi.fn() },
  emailLog: { findMany: vi.fn(), count: vi.fn() },
}))
const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn() }))
const flagMock = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }))
const unsubMock = vi.hoisted(() => ({
  getOrCreateUnsubscribeToken: vi.fn(async () => 'tok-1'),
  unsubscribeUrl: (t: string) => `https://www.quizotic.live/api/unsubscribe/${t}`,
  appBaseUrl: () => 'https://www.quizotic.live',
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email', () => emailMock)
vi.mock('@/lib/feature-flags', () => flagMock)
vi.mock('@/lib/lifecycle/unsubscribe', () => unsubMock)

import { runLifecycleTick } from '../lib/lifecycle/worker'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const NOW = new Date('2026-08-01T06:00:00Z') // 11:30 IST — inside the send window
const SIGNUP = new Date(NOW.getTime() - 6 * DAY)

interface UserOver {
  quizCount?: number
  hostedSessionCount?: number
  lastActiveAt?: Date | null
  onboarded?: boolean
  createdAt?: Date
  lifecycleOptOutAt?: Date | null
}

function stageUser(over: UserOver & { name?: string | null } = {}) {
  const createdAt = over.createdAt ?? SIGNUP
  const row = {
    id: 'user-1',
    email: 'teacher@example.com',
    name: over.name === undefined ? 'Priya Sharma' : over.name,
    country: 'IN',
    locale: 'en-IN',
    onboarded: over.onboarded ?? true,
    createdAt,
    lastActiveAt: over.lastActiveAt === undefined ? createdAt : over.lastActiveAt,
    lifecycleOptOutAt: over.lifecycleOptOutAt ?? null,
  }
  prismaMock.user.findMany.mockResolvedValue([row])
  prismaMock.user.findUnique.mockResolvedValue(row)
  prismaMock.quiz.count.mockResolvedValue(over.quizCount ?? 1)
  prismaMock.gameSession.count.mockResolvedValue(over.hostedSessionCount ?? 0)
  return row
}

/** A nudge whose in-app card has been sitting unseen long enough to email. */
const dueNudge = (over: Record<string, unknown> = {}) => ({
  id: 'nudge-1',
  userId: 'user-1',
  campaignKey: 'activation.host_first_session',
  priority: 1,
  state: 'pending',
  createdAt: new Date(NOW.getTime() - 3 * DAY),
  shownAt: null,
  expiresAt: new Date(NOW.getTime() + 20 * DAY),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.LIFECYCLE_DRY_RUN = 'false'
  delete process.env.LIFECYCLE_TEST_EMAILS

  flagMock.isFeatureEnabled.mockResolvedValue(true)
  emailMock.sendEmail.mockResolvedValue({ ok: true, id: 'resend-1' })
  prismaMock.emailSuppression.findUnique.mockResolvedValue(null)
  prismaMock.emailLog.findMany.mockResolvedValue([])
  prismaMock.emailLog.count.mockResolvedValue(0)
  delete process.env.LIFECYCLE_DAILY_CAP
  delete process.env.LIFECYCLE_TICK_CAP
  prismaMock.nudge.findMany.mockResolvedValue([])
  prismaMock.nudge.findUnique.mockResolvedValue(null)
  prismaMock.nudge.count.mockResolvedValue(0)
  prismaMock.nudge.create.mockResolvedValue({})
  prismaMock.nudge.update.mockResolvedValue({})
  prismaMock.nudge.updateMany.mockResolvedValue({ count: 0 })
  unsubMock.getOrCreateUnsubscribeToken.mockResolvedValue('tok-1')
})

describe('scan window', () => {
  it('only looks at users still inside the 30-day sequence window', async () => {
    stageUser()
    await runLifecycleTick(NOW)

    const where = prismaMock.user.findMany.mock.calls[0]![0].where
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 30 * DAY)
  })
})

describe('activation closes the sequence', () => {
  it('cancels every pending nudge when the user reaches tier 3', async () => {
    stageUser({ hostedSessionCount: 1 })
    prismaMock.nudge.updateMany.mockResolvedValue({ count: 2 })

    const result = await runLifecycleTick(NOW)

    expect(result.cancelled).toBe(2)
    expect(prismaMock.nudge.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', state: { in: ['pending', 'shown'] } },
      data: { state: 'cancelled' },
    })
  })

  it('does not email an activated user in the same cycle that cancels them', async () => {
    stageUser({ hostedSessionCount: 1 })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])

    await runLifecycleTick(NOW)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })

  it('never rewrites an already-emailed nudge', async () => {
    // Those are a record of something that left the building.
    stageUser({ hostedSessionCount: 1 })
    await runLifecycleTick(NOW)

    const where = prismaMock.nudge.updateMany.mock.calls[0]![0].where
    expect(where.state.in).toEqual(['pending', 'shown'])
  })
})

describe('enqueueing', () => {
  it('never enqueues for a ghost', async () => {
    stageUser({ quizCount: 0, onboarded: false, lastActiveAt: SIGNUP })
    const result = await runLifecycleTick(NOW)

    expect(result.enqueued).toBe(0)
    expect(prismaMock.nudge.create).not.toHaveBeenCalled()
  })

  it('picks the highest-priority campaign for the tier', async () => {
    stageUser({ quizCount: 1 }) // Tier 2
    const result = await runLifecycleTick(NOW)

    expect(result.enqueued).toBe(1)
    expect(prismaMock.nudge.create.mock.calls[0]![0].data).toMatchObject({
      campaignKey: 'activation.host_first_session',
      priority: 1,
      state: 'pending',
    })
  })

  it('gives a tier-1 explorer the create-first-quiz campaign', async () => {
    stageUser({ quizCount: 0, onboarded: true })
    await runLifecycleTick(NOW)

    expect(prismaMock.nudge.create.mock.calls[0]![0].data).toMatchObject({
      campaignKey: 'activation.create_first_quiz',
    })
  })

  it('keeps at most one open nudge — a dashboard is not a to-do list', async () => {
    stageUser()
    prismaMock.nudge.count.mockResolvedValue(1)

    const result = await runLifecycleTick(NOW)
    expect(result.enqueued).toBe(0)
    expect(prismaMock.nudge.create).not.toHaveBeenCalled()
  })

  it('never repeats a campaign the user already had', async () => {
    stageUser()
    prismaMock.nudge.findMany.mockImplementation(async (args: { select?: unknown }) =>
      args.select ? [{ campaignKey: 'activation.host_first_session' }] : [],
    )

    const result = await runLifecycleTick(NOW)
    // last_touch is not due yet at 6 days, so nothing is left to enqueue.
    expect(result.enqueued).toBe(0)
  })

  it('expires the nudge at the end of the sequence window, not the tick', async () => {
    stageUser()
    await runLifecycleTick(NOW)

    const { expiresAt } = prismaMock.nudge.create.mock.calls[0]![0].data
    expect(expiresAt.getTime()).toBe(SIGNUP.getTime() + 30 * DAY)
  })

  it('treats a unique-constraint loss as another replica winning, not an error', async () => {
    stageUser()
    prismaMock.nudge.create.mockRejectedValue(new Error('Unique constraint failed'))

    const result = await runLifecycleTick(NOW)
    expect(result.enqueued).toBe(0)
    expect(result.errors).toBe(0)
  })
})

describe('email is the fallback, never the first touch', () => {
  it('sends when the card went unseen and the user stayed away', async () => {
    stageUser({ lastActiveAt: SIGNUP })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)

    const result = await runLifecycleTick(NOW)

    expect(result.sent).toBe(1)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1)
    const args = emailMock.sendEmail.mock.calls[0]![0]
    expect(args.channel).toBe('lifecycle')
    expect(args.category).toBe('lifecycle')
    expect(args.unsubscribeUrl).toContain('/api/unsubscribe/tok-1')
    expect(args.metadata).toMatchObject({ campaignKey: 'activation.host_first_session' })
  })

  it('does not email someone who came back and ignored the card', async () => {
    // Mailing them the same message they just scrolled past is exactly the
    // irritation the in-app-first rule exists to prevent.
    stageUser({ lastActiveAt: new Date(NOW.getTime() - 1 * HOUR) })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)

    const result = await runLifecycleTick(NOW)

    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    expect(result.blocked['seen-in-app']).toBe(1)
  })

  it('only considers cards that are unseen and past the 48h grace', async () => {
    stageUser()
    await runLifecycleTick(NOW)

    const dueQuery = prismaMock.nudge.findMany.mock.calls.find(c => c[0]?.where?.shownAt === null)
    expect(dueQuery).toBeDefined()
    expect(dueQuery![0].where.state).toBe('pending')
    expect(dueQuery![0].where.createdAt.lte.getTime()).toBe(NOW.getTime() - 48 * HOUR)
  })

  it('marks the nudge emailed only after the transport confirms', async () => {
    stageUser({ lastActiveAt: SIGNUP })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)

    await runLifecycleTick(NOW)
    expect(prismaMock.nudge.update).toHaveBeenCalledWith({
      where: { id: 'nudge-1' },
      data: expect.objectContaining({ state: 'emailed' }),
    })
  })

  it('leaves a failed send eligible for the next tick', async () => {
    stageUser({ lastActiveAt: SIGNUP })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)
    emailMock.sendEmail.mockResolvedValue({ ok: false, error: 'Resend 500' })

    const result = await runLifecycleTick(NOW)

    expect(result.sent).toBe(0)
    expect(result.errors).toBe(1)
    // Not consumed — no state transition to 'emailed'.
    expect(prismaMock.nudge.update).not.toHaveBeenCalled()
  })

  it('sends at most one email per user per cycle', async () => {
    stageUser({ lastActiveAt: SIGNUP })
    prismaMock.nudge.findMany.mockResolvedValue([
      dueNudge(),
      dueNudge({ id: 'nudge-2', campaignKey: 'activation.last_touch', priority: 3 }),
    ])
    prismaMock.nudge.count.mockResolvedValue(1)

    await runLifecycleTick(NOW)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1)
  })
})

/**
 * The per-user guards bound what one person receives. These bound what the
 * whole system emits, which is the difference between a nudge and a bulk send
 * on the first tick after a backlog has built up.
 */
describe('global send ceiling', () => {
  /** N users who would each, on their own, receive exactly one email. */
  function stageManyDue(n: number) {
    const rows = Array.from({ length: n }, (_, i) => ({
      id: `user-${i}`,
      email: `teacher${i}@example.com`,
      name: 'Priya Sharma',
      country: 'IN',
      locale: 'en-IN',
      onboarded: true,
      createdAt: SIGNUP,
      lastActiveAt: SIGNUP,
      lifecycleOptOutAt: null,
    }))
    prismaMock.user.findMany.mockResolvedValue(rows)
    prismaMock.user.findUnique.mockResolvedValue(rows[0])
    prismaMock.quiz.count.mockResolvedValue(1)
    prismaMock.gameSession.count.mockResolvedValue(0)
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1) // already has an open nudge
  }

  it('sends up to the per-tick cap and no further', async () => {
    process.env.LIFECYCLE_TICK_CAP = '3'
    stageManyDue(10)

    const result = await runLifecycleTick(NOW)

    expect(result.sent).toBe(3)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(3)
    expect(result.blocked['send-cap']).toBe(7)
  })

  it('subtracts what already went out in the rolling 24h', async () => {
    process.env.LIFECYCLE_DAILY_CAP = '5'
    process.env.LIFECYCLE_TICK_CAP = '20'
    prismaMock.emailLog.count.mockResolvedValue(4) // 4 sent today, 1 slot left
    stageManyDue(10)

    const result = await runLifecycleTick(NOW)

    expect(result.sendAllowance).toBe(1)
    expect(result.sent).toBe(1)

    const where = prismaMock.emailLog.count.mock.calls[0]![0].where
    expect(where.category).toBe('lifecycle')
    expect(where.status).toBe('sent')
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - DAY)
  })

  it('sends nothing once the daily cap is spent', async () => {
    process.env.LIFECYCLE_DAILY_CAP = '5'
    prismaMock.emailLog.count.mockResolvedValue(5)
    stageManyDue(3)

    const result = await runLifecycleTick(NOW)

    expect(result.sent).toBe(0)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    expect(result.blocked['send-cap']).toBe(3)
  })

  it('leaves a capped nudge pending rather than consuming it', async () => {
    process.env.LIFECYCLE_TICK_CAP = '0'
    stageManyDue(3)

    await runLifecycleTick(NOW)

    // Never marked emailed — the next tick picks it up untouched.
    expect(prismaMock.nudge.update).not.toHaveBeenCalled()
  })

  it('treats an explicit zero as a pause, not as a missing value', async () => {
    process.env.LIFECYCLE_TICK_CAP = '0'
    stageManyDue(1)

    const result = await runLifecycleTick(NOW)

    expect(result.sendAllowance).toBe(0)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })

  it('ignores a garbled cap rather than disabling the ceiling', async () => {
    process.env.LIFECYCLE_TICK_CAP = 'twenty'
    stageManyDue(25)

    const result = await runLifecycleTick(NOW)

    expect(result.sent).toBe(20) // the default, not unbounded
  })

  it('spends a slot on the attempt, so a run of failures cannot loop', async () => {
    process.env.LIFECYCLE_TICK_CAP = '2'
    emailMock.sendEmail.mockResolvedValue({ ok: false, error: 'rate limited' })
    stageManyDue(10)

    const result = await runLifecycleTick(NOW)

    expect(emailMock.sendEmail).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(0)
    expect(result.errors).toBe(2)
  })
})

describe('greeting', () => {
  const emailTo = () => String(emailMock.sendEmail.mock.calls[0]![0].text)

  const stageDue = (name: string | null) => {
    stageUser({ lastActiveAt: SIGNUP, name })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)
  }

  it('greets by first name', async () => {
    stageDue('Priya Sharma')
    await runLifecycleTick(NOW)
    expect(emailTo()).toContain('Hi Priya,')
  })

  it('falls back to a bare greeting when there is no name', async () => {
    stageDue(null)
    await runLifecycleTick(NOW)
    expect(emailTo()).toContain('Hi,')
  })

  it('does not greet someone by their email address', async () => {
    // OAuth and magic-link signups sometimes leave an address in `name`.
    // "Hi teacher.k99@example.com," is worse than no greeting at all.
    stageDue('teacher.k99@example.com')
    await runLifecycleTick(NOW)
    expect(emailTo()).toContain('Hi,')
    expect(emailTo()).not.toContain('@example.com,')
  })
})

describe('dry run', () => {
  it('reaches the transport zero times', async () => {
    process.env.LIFECYCLE_DRY_RUN = 'true'
    stageUser({ lastActiveAt: SIGNUP })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)

    const result = await runLifecycleTick(NOW)

    expect(result.dryRun).toBe(1)
    expect(result.sent).toBe(0)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    expect(prismaMock.nudge.update).not.toHaveBeenCalled()
  })
})

describe('resilience', () => {
  it('counts a failing user and keeps going', async () => {
    // One broken row must not stop the tick for everyone else.
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', email: 'a@example.com', country: 'IN', locale: 'en-IN', onboarded: true, createdAt: SIGNUP, lastActiveAt: SIGNUP, lifecycleOptOutAt: null },
      { id: 'user-2', email: 'b@example.com', country: 'IN', locale: 'en-IN', onboarded: true, createdAt: SIGNUP, lastActiveAt: SIGNUP, lifecycleOptOutAt: null },
    ])
    prismaMock.user.findUnique
      .mockRejectedValueOnce(new Error('row exploded'))
      .mockResolvedValue({ onboarded: true, createdAt: SIGNUP, lastActiveAt: SIGNUP })
    prismaMock.quiz.count.mockResolvedValue(1)
    prismaMock.gameSession.count.mockResolvedValue(0)

    const result = await runLifecycleTick(NOW)

    expect(result.scanned).toBe(2)
    expect(result.errors).toBe(1)
  })

  it('reports why nothing was sent, which is the point of the dry-run week', async () => {
    stageUser({ lastActiveAt: SIGNUP, lifecycleOptOutAt: new Date('2026-07-20') })
    prismaMock.nudge.findMany.mockResolvedValue([dueNudge()])
    prismaMock.nudge.count.mockResolvedValue(1)

    const result = await runLifecycleTick(NOW)
    expect(result.blocked['opted-out']).toBe(1)
  })
})
