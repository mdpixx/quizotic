import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Pre-auth account-existence lookup that lets the sign-in form tell sign-up
// apart from sign-in. These tests pin the contract the form depends on:
// { exists: boolean } on success, rate-limited per IP.

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

const rateLimitMock = vi.hoisted(() => ({
  rateLimitRequest: vi.fn(async () => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000, limit: 10 })),
  rateLimitResponse: vi.fn(() => new Response('rate limited', { status: 429 })),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/rate-limit', () => rateLimitMock)

import { POST } from '../app/api/auth/check-email/route'

function req(body?: unknown) {
  return new NextRequest('http://localhost/api/auth/check-email', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.rateLimitRequest.mockResolvedValue({ ok: true, remaining: 9, resetAt: Date.now() + 60_000, limit: 10 })
})

describe('check-email API', () => {
  it('returns exists:true for a registered email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' })
    const res = await POST(req({ email: 'host@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ exists: true })
  })

  it('returns exists:false for an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await POST(req({ email: 'nobody@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ exists: false })
  })

  it('normalizes email to lowercase before lookup', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    await POST(req({ email: '  HOST@Example.COM ' }))
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'host@example.com' } }),
    )
  })

  it('rejects a body without a valid email', async () => {
    const res = await POST(req({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns 429 when the rate limit trips', async () => {
    rateLimitMock.rateLimitRequest.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000, limit: 10 })
    const res = await POST(req({ email: 'host@example.com' }))
    expect(res.status).toBe(429)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
