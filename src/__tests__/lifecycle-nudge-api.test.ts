// The in-app nudge API. Design spec §4.
//
// The 'shown' transition is the load-bearing one. The worker only emails a
// nudge whose shownAt is still null after 48h, so reporting a sighting is the
// mechanism that stops somebody already in the product also getting mailed
// about it — not analytics. Two properties follow, and both are tested here:
//
//   - shownAt is write-once. The card fires 'shown' on every mount, and
//     pushing the timestamp forward each time would reset the 48h grace and
//     make the email unreachable.
//   - a nudge id belonging to someone else must transition nothing.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  nudge: { findFirst: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const authMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth-helpers', () => authMock)

import { GET, POST } from '../app/api/lifecycle/nudge/route'

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/lifecycle/nudge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const OPEN_NUDGE = {
  id: 'nudge-1',
  campaignKey: 'activation.host_first_session',
  state: 'pending',
  shownAt: null as Date | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  prismaMock.nudge.findFirst.mockResolvedValue(OPEN_NUDGE)
  prismaMock.nudge.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findUnique.mockResolvedValue({ role: null, orgType: null })
})

describe('GET', () => {
  it('returns the open nudge with its copy', async () => {
    const body = await (await GET()).json()

    expect(body.nudge).toMatchObject({
      id: 'nudge-1',
      campaignKey: 'activation.host_first_session',
      seen: false,
    })
    expect(body.nudge.title).toBeTruthy()
    expect(body.nudge.ctaHref).toMatch(/^\//)
  })

  it('returns the highest-priority nudge', async () => {
    await GET()
    expect(prismaMock.nudge.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { priority: 'asc' } }),
    )
  })

  it('only considers open nudges', async () => {
    await GET()
    const where = prismaMock.nudge.findFirst.mock.calls[0]![0].where
    expect(where.state.in).toEqual(['pending', 'shown'])
    expect(where.userId).toBe('user-1')
  })

  it('returns null when there is nothing to show', async () => {
    prismaMock.nudge.findFirst.mockResolvedValue(null)
    expect((await (await GET()).json()).nudge).toBeNull()
  })

  it('returns null for a campaign that no longer exists in code', async () => {
    // A stale row must not render an empty card.
    prismaMock.nudge.findFirst.mockResolvedValue({ ...OPEN_NUDGE, campaignKey: 'activation.retired' })
    expect((await (await GET()).json()).nudge).toBeNull()
  })

  it('degrades to no nudge rather than breaking the dashboard', async () => {
    prismaMock.nudge.findFirst.mockRejectedValue(new Error('db down'))
    const res = await GET()

    expect(res.status).toBe(200)
    expect((await res.json()).nudge).toBeNull()
  })

  it('401s an anonymous caller', async () => {
    authMock.getCurrentUser.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
})

describe('POST — state transitions', () => {
  it('records a sighting without closing the nudge', async () => {
    // 'shown' is a marker, not a resolution: the card stays on screen and can
    // still be acted on or dismissed.
    await POST(post({ id: 'nudge-1', action: 'shown' }))

    const call = prismaMock.nudge.updateMany.mock.calls[0]![0]
    expect(call.data.state).toBe('shown')
    expect(call.data.shownAt).toBeInstanceOf(Date)
  })

  it('treats shownAt as write-once', async () => {
    // The card fires 'shown' on every mount. Pushing the timestamp forward
    // each time would keep resetting the 48h grace period, and the email
    // fallback would never become reachable.
    await POST(post({ id: 'nudge-1', action: 'shown' }))
    expect(prismaMock.nudge.updateMany.mock.calls[0]![0].where.shownAt).toBeNull()
  })

  it('closes the nudge on acted and dismissed', async () => {
    for (const action of ['acted', 'dismissed'] as const) {
      prismaMock.nudge.updateMany.mockClear()
      await POST(post({ id: 'nudge-1', action }))

      const call = prismaMock.nudge.updateMany.mock.calls[0]![0]
      expect(call.data.state).toBe(action)
      // Not constrained to a null timestamp — these are one-shot resolutions.
      expect(call.where.shownAt).toBeUndefined()
    }
  })

  it('scopes every transition to the caller, so an id from another account matches nothing', async () => {
    await POST(post({ id: 'someone-elses-nudge', action: 'dismissed' }))
    expect(prismaMock.nudge.updateMany.mock.calls[0]![0].where.userId).toBe('user-1')
  })

  it('never transitions an already-closed nudge', async () => {
    await POST(post({ id: 'nudge-1', action: 'acted' }))
    expect(prismaMock.nudge.updateMany.mock.calls[0]![0].where.state.in).toEqual([
      'pending',
      'shown',
    ])
  })

  it('is idempotent — a no-op update is a success', async () => {
    prismaMock.nudge.updateMany.mockResolvedValue({ count: 0 })
    const res = await POST(post({ id: 'nudge-1', action: 'shown' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, updated: 0 })
  })

  it('rejects an unknown action', async () => {
    const res = await POST(post({ id: 'nudge-1', action: 'emailed' }))
    expect(res.status).toBe(400)
    expect(prismaMock.nudge.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a malformed body', async () => {
    const bad = new NextRequest('http://localhost/api/lifecycle/nudge', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    expect((await POST(bad)).status).toBe(400)
  })

  it('401s an anonymous caller', async () => {
    authMock.getCurrentUser.mockResolvedValue(null)
    const res = await POST(post({ id: 'nudge-1', action: 'shown' }))

    expect(res.status).toBe(401)
    expect(prismaMock.nudge.updateMany).not.toHaveBeenCalled()
  })
})
