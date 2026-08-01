// One-click unsubscribe. The rules being pinned:
//
//   1. It works with no login, on GET and on POST, and twice in a row.
//   2. It writes BOTH records — the user preference and the address-keyed
//      suppression row — because they have different lifetimes.
//   3. It never downgrades a bounce or complaint to a plain unsubscribe, and
//      re-subscribing never clears one.
//   4. Re-subscribe is POST-only. A bare GET must not undo an opt-out, or a
//      corporate link scanner would silently re-subscribe people.
//
// A broken unsubscribe link does not merely annoy: the practical alternative
// for the recipient is the spam button, which is what damages the sending
// domain the whole two-channel split exists to protect.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  emailSuppression: { upsert: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET, POST } from '../app/api/unsubscribe/[token]/route'
import {
  generateUnsubscribeToken,
  getOrCreateUnsubscribeToken,
  unsubscribeUrl,
} from '../lib/lifecycle/unsubscribe'

const TOKEN = 'tok_abc123'
const params = (token = TOKEN) => ({ params: Promise.resolve({ token }) })

const USER = { id: 'user-1', email: 'Teacher@Example.com', lifecycleOptOutAt: null as Date | null }

function getReq(token = TOKEN) {
  return new NextRequest(`http://localhost/api/unsubscribe/${token}`)
}

function postReq(intent?: string, token = TOKEN) {
  const body = new FormData()
  if (intent) body.set('intent', intent)
  return new NextRequest(`http://localhost/api/unsubscribe/${token}`, { method: 'POST', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops)
  prismaMock.user.findUnique.mockResolvedValue({ ...USER })
})

describe('GET /api/unsubscribe/[token]', () => {
  it('opts the user out and confirms in the page', async () => {
    const res = await GET(getReq(), params())
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(html).toContain('Done')
    expect(html).toContain('any more onboarding or product emails')
    // The promise that transactional mail keeps flowing is made on the page
    // itself, not just in code — people need to know they can still log in.
    expect(html).toContain('sign-in links')
    // The address is echoed back, in its original casing, so people can tell
    // which of their inboxes they just silenced.
    expect(html).toContain('Teacher@Example.com')
  })

  it('writes both the user preference and the suppression row', async () => {
    await GET(getReq(), params())

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1', lifecycleOptOutAt: null } }),
    )
    const suppression = prismaMock.emailSuppression.upsert.mock.calls[0]![0]
    // Lowercased and trimmed — the transport looks it up the same way.
    expect(suppression.where).toEqual({ email: 'teacher@example.com' })
    expect(suppression.create.reason).toBe('unsubscribed')
  })

  it('never downgrades an existing bounce or complaint row', async () => {
    await GET(getReq(), params())
    // An empty update means an existing suppression keeps its original
    // reason: a hard bounce outranks "they clicked unsubscribe".
    expect(prismaMock.emailSuppression.upsert.mock.calls[0]![0].update).toEqual({})
  })

  it('is idempotent — unsubscribing twice still succeeds', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, lifecycleOptOutAt: new Date('2026-07-01') })

    const res = await GET(getReq(), params())
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('any more onboarding or product emails')

    // The original opt-out timestamp is preserved: the update is conditional
    // on the column still being null.
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1', lifecycleOptOutAt: null } }),
    )
  })

  it('404s an unknown token without touching anything', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await GET(getReq('nope'), params('nope'))
    expect(res.status).toBe(404)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('does not re-subscribe on a GET', async () => {
    // A link scanner following every URL in an email must not be able to undo
    // the opt-out it just triggered.
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, lifecycleOptOutAt: new Date() })

    await GET(getReq(), params())
    expect(prismaMock.emailSuppression.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('is never cached or indexed', async () => {
    const res = await GET(getReq(), params())
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex')
  })

  it('renders an error page instead of throwing when the database is down', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))
    const res = await GET(getReq(), params())
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('Quizotic')
  })
})

describe('POST /api/unsubscribe/[token] — RFC 8058 one-click', () => {
  it('unsubscribes and answers 200 with no body for a mail client', async () => {
    // Gmail and Yahoo POST from the List-Unsubscribe-Post header and want a
    // fast, bodyless success.
    const res = await POST(postReq(), params())

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(prismaMock.emailSuppression.upsert).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes even when the client sends no parseable body', async () => {
    const bare = new NextRequest(`http://localhost/api/unsubscribe/${TOKEN}`, { method: 'POST' })
    const res = await POST(bare, params())

    expect(res.status).toBe(200)
    expect(prismaMock.emailSuppression.upsert).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await POST(postReq(), params('nope'))
    expect(res.status).toBe(404)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('POST /api/unsubscribe/[token] — re-subscribe', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, lifecycleOptOutAt: new Date('2026-07-01') })
  })

  it('clears the opt-out and confirms', async () => {
    const res = await POST(postReq('resubscribe'), params())

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Welcome back')
    // The 2-per-30-days cap is stated to the user, not just enforced in code.
    expect(html).toContain('Never more than two a month')
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lifecycleOptOutAt: null } }),
    )
  })

  it('only clears a suppression this route created', async () => {
    await POST(postReq('resubscribe'), params())

    // Scoped to reason: 'unsubscribed'. A hard bounce or spam complaint means
    // the address is undeliverable or hostile, and clicking a button is not
    // evidence that changed.
    expect(prismaMock.emailSuppression.deleteMany).toHaveBeenCalledWith({
      where: { email: 'teacher@example.com', reason: 'unsubscribed' },
    })
  })
})

describe('unsubscribe tokens', () => {
  it('mints an unguessable token, not a predictable id', async () => {
    // The token is the entire authorisation for changing someone's mail
    // preferences, with no login in the way. A sequential or timestamp-derived
    // id would let anyone unsubscribe anyone.
    const tokens = new Set(Array.from({ length: 200 }, () => generateUnsubscribeToken()))
    expect(tokens.size).toBe(200)
    // 32 bytes of base64url.
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('builds an absolute URL — a relative one is useless in an inbox', () => {
    expect(unsubscribeUrl('tok/with+chars')).toMatch(/^https:\/\/[^/]+\/api\/unsubscribe\//)
    // Path-unsafe characters must not break the link.
    expect(unsubscribeUrl('a/b')).toContain('a%2Fb')
  })

  it('reuses an existing token so old emails keep working', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ unsubscribeToken: 'existing-token' })

    await expect(getOrCreateUnsubscribeToken('user-1')).resolves.toBe('existing-token')
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('lets the loser of a race adopt the winner token instead of overwriting it', async () => {
    // Two lifecycle sends for the same user in one tick both see a null token.
    // Overwriting would silently break the unsubscribe link in every email
    // already delivered.
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ unsubscribeToken: null })
      .mockResolvedValueOnce({ unsubscribeToken: 'winner-token' })
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 })

    await expect(getOrCreateUnsubscribeToken('user-1')).resolves.toBe('winner-token')
  })

  it('keeps the token it successfully claimed', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ unsubscribeToken: null })
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })

    const token = await getOrCreateUnsubscribeToken('user-1')
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', unsubscribeToken: null },
      data: { unsubscribeToken: token },
    })
  })
})
