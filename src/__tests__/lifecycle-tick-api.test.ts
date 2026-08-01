// The hourly tick endpoint. Design spec §6.
//
// This is an internet-reachable endpoint that can send email, so the auth
// tests matter more than the happy path: an unset CRON_SECRET must mean
// "closed", not "open", and a wrong token must never reach the worker.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const workerMock = vi.hoisted(() => ({ runLifecycleTick: vi.fn() }))
const lockMock = vi.hoisted(() => ({ acquireLock: vi.fn() }))

vi.mock('@/lib/lifecycle/worker', () => workerMock)
vi.mock('@/lib/lifecycle/lock', () => lockMock)

import { GET, POST } from '../app/api/internal/lifecycle/tick/route'

const SECRET = 'cron-secret-value'

const release = vi.fn()
const req = (token?: string) =>
  new NextRequest('http://localhost/api/internal/lifecycle/tick', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })

const emptyResult = {
  scanned: 3,
  cancelled: 0,
  enqueued: 1,
  sent: 0,
  dryRun: 1,
  blocked: { 'quiet-hours': 2 },
  errors: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
  release.mockResolvedValue(undefined)
  lockMock.acquireLock.mockResolvedValue({ acquired: true, release })
  workerMock.runLifecycleTick.mockResolvedValue(emptyResult)
})

describe('authentication', () => {
  it('runs the tick for a correct bearer token', async () => {
    const res = await POST(req(SECRET))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, scanned: 3, dryRun: 1 })
    expect(workerMock.runLifecycleTick).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing token', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(workerMock.runLifecycleTick).not.toHaveBeenCalled()
  })

  it('rejects a wrong token', async () => {
    const res = await POST(req('nope'))
    expect(res.status).toBe(401)
    expect(workerMock.runLifecycleTick).not.toHaveBeenCalled()
  })

  it('rejects a token with the right prefix but the wrong length', async () => {
    const res = await POST(req(SECRET.slice(0, -1)))
    expect(res.status).toBe(401)
    expect(workerMock.runLifecycleTick).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    // Unset must mean "closed". An endpoint that sends email cannot default
    // to open because someone forgot a Railway variable.
    delete process.env.CRON_SECRET

    const res = await POST(req(SECRET))
    expect(res.status).toBe(503)
    expect(workerMock.runLifecycleTick).not.toHaveBeenCalled()
  })

  it('does not take the lock before authenticating', async () => {
    await POST(req('nope'))
    expect(lockMock.acquireLock).not.toHaveBeenCalled()
  })

  it('answers 405 to a GET rather than a confusing 404', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
  })
})

describe('locking', () => {
  it('skips without error when another replica holds the lock', async () => {
    lockMock.acquireLock.mockResolvedValue({ acquired: false, release })

    const res = await POST(req(SECRET))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skipped: 'locked' })
    expect(workerMock.runLifecycleTick).not.toHaveBeenCalled()
  })

  it('releases the lock after a successful run', async () => {
    await POST(req(SECRET))
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases the lock even when the tick throws', async () => {
    // A lock held past a crash would silently stop the system for as long as
    // its TTL, which is the failure mode nobody notices.
    workerMock.runLifecycleTick.mockRejectedValue(new Error('boom'))

    const res = await POST(req(SECRET))

    expect(res.status).toBe(500)
    expect(release).toHaveBeenCalledTimes(1)
  })
})

describe('observability', () => {
  it('returns the block breakdown, which is the point of the dry-run week', async () => {
    const res = await POST(req(SECRET))
    const body = await res.json()

    expect(body.blocked).toEqual({ 'quiet-hours': 2 })
    expect(typeof body.durationMs).toBe('number')
  })
})
