import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  rateLimitRequest: vi.fn(),
  rateLimit: vi.fn(),
  rateLimitResponse: vi.fn(),
  findInvite: vi.fn(),
  updateInvite: vi.fn(),
  createTestimonial: vi.fn(),
  transaction: vi.fn(),
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: mocks.rateLimitRequest,
  rateLimit: mocks.rateLimit,
  rateLimitResponse: mocks.rateLimitResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    testimonialInvite: { findUnique: mocks.findInvite },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/testimonial-photo', () => ({
  uploadTestimonialPhoto: mocks.uploadPhoto,
  deleteTestimonialPhoto: mocks.deletePhoto,
}))

import { POST } from '@/app/api/testimonials/route'

const TOKEN = 'a'.repeat(43)

function activeInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invite-1',
    userId: 'user-1',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    usedAt: null,
    user: {
      id: 'user-1',
      email: 'asha@example.com',
      name: 'Asha Rao',
      organization: 'Acme India',
    },
    testimonial: null,
    ...overrides,
  }
}

function validForm() {
  const form = new FormData()
  form.set('quote', 'Quizotic helped our trainers run lively knowledge checks without slowing the session.')
  form.set('name', 'Asha Rao')
  form.set('designation', 'Learning Manager')
  form.set('organization', 'Acme India')
  form.set('publicationConsent', 'true')
  form.set('editingAllowed', 'true')
  return form
}

function request(form = validForm(), headers: Record<string, string> = {}) {
  return new NextRequest('https://www.quizotic.live/api/testimonials', {
    method: 'POST',
    body: form,
    headers: {
      origin: 'https://www.quizotic.live',
      cookie: `quizotic_testimonial_submit=${TOKEN}`,
      ...headers,
    },
  })
}

describe('POST /api/testimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rateLimitRequest.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() + 1000, limit: 5 })
    mocks.rateLimit.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() + 1000, limit: 5 })
    mocks.rateLimitResponse.mockReturnValue(Response.json({ error: 'rate limited' }, { status: 429 }))
    mocks.findInvite.mockResolvedValue(activeInvite())
    mocks.updateInvite.mockResolvedValue({ count: 1 })
    mocks.createTestimonial.mockResolvedValue({ id: 'testimonial-1' })
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      testimonialInvite: { updateMany: mocks.updateInvite },
      testimonial: { create: mocks.createTestimonial },
    }))
    mocks.uploadPhoto.mockResolvedValue({ key: 'testimonials/user-1/photo.webp', url: 'https://cdn.example/photo.webp' })
    mocks.deletePhoto.mockResolvedValue(undefined)
  })

  it('does not accept invitation bearers in the API query string', async () => {
    const response = await POST(new NextRequest(`https://www.quizotic.live/api/testimonials?invite=${TOKEN}`, {
      method: 'POST',
      body: validForm(),
      headers: { origin: 'https://www.quizotic.live' },
    }))

    expect(response.status).toBe(404)
    expect(mocks.findInvite).not.toHaveBeenCalled()
  })

  it('rejects an expired invitation before parsing a submission', async () => {
    mocks.findInvite.mockResolvedValue(activeInvite({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }))

    const response = await POST(request())

    expect(response.status).toBe(410)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('returns an idempotent success for an invitation already used', async () => {
    mocks.findInvite.mockResolvedValue(activeInvite({
      usedAt: new Date(),
      testimonial: { id: 'existing-testimonial' },
    }))

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, alreadySubmitted: true })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('returns idempotent success for an already submitted invitation even after expiry', async () => {
    mocks.findInvite.mockResolvedValue(activeInvite({
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      usedAt: new Date('2019-12-20T00:00:00.000Z'),
      testimonial: { id: 'existing-testimonial' },
    }))

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, alreadySubmitted: true })
  })

  it('requires explicit publication consent', async () => {
    const form = validForm()
    form.set('publicationConsent', 'false')

    const response = await POST(request(form))

    expect(response.status).toBe(400)
    expect(mocks.createTestimonial).not.toHaveBeenCalled()
  })

  it('rejects an oversized request before multipart buffering', async () => {
    const response = await POST(request(validForm(), { 'content-length': String(7 * 1024 * 1024) }))

    expect(response.status).toBe(413)
    expect(mocks.findInvite).not.toHaveBeenCalled()
  })

  it('rejects a photo whose declared type does not match its bytes', async () => {
    const form = validForm()
    form.set('photo', new File(['<script>alert(1)</script>'], 'portrait.jpg', { type: 'image/jpeg' }))

    const response = await POST(request(form))

    expect(response.status).toBe(400)
    expect(mocks.uploadPhoto).not.toHaveBeenCalled()
  })

  it('rejects a truncated file that only has a valid image signature', async () => {
    const form = validForm()
    form.set('photo', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'portrait.jpg', { type: 'image/jpeg' }))

    const response = await POST(request(form))

    expect(response.status).toBe(400)
    expect(mocks.uploadPhoto).not.toHaveBeenCalled()
  })

  it('stores a valid submission and consumes the invitation once', async () => {
    const form = validForm()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    form.set('photo', new File([png], 'portrait.png', { type: 'image/png' }))

    const response = await POST(request(form))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true, id: 'testimonial-1' })
    expect(mocks.uploadPhoto).toHaveBeenCalledWith(expect.objectContaining({ mime: 'image/webp' }))
    expect(mocks.updateInvite).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'invite-1',
        usedAt: null,
        tokenHash: expect.any(String),
        expiresAt: { gt: expect.any(Date) },
      }),
    }))
    expect(mocks.createTestimonial).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        inviteId: 'invite-1',
        emailSnapshot: 'asha@example.com',
        publicationConsent: true,
        photoKey: 'testimonials/user-1/photo.webp',
      }),
    }))
  })

  it('keeps the invitation unused when verified-photo storage fails', async () => {
    const form = validForm()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    form.set('photo', new File([png], 'portrait.png', { type: 'image/png' }))
    mocks.uploadPhoto.mockRejectedValue(new Error('R2 unavailable'))

    const response = await POST(request(form))

    expect(response.status).toBe(503)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
