import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteTestimonials: vi.fn(),
  deleteInvite: vi.fn(),
  audit: vi.fn(),
  revalidatePath: vi.fn(),
  deletePhoto: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/admin-audit', () => ({ writeAuditLog: mocks.audit }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/testimonial-photo', () => ({ deleteTestimonialPhoto: mocks.deletePhoto }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    testimonial: {
      findMany: mocks.findMany,
      groupBy: mocks.groupBy,
      findUnique: mocks.findUnique,
      update: mocks.update,
      deleteMany: mocks.deleteTestimonials,
    },
    testimonialInvite: { delete: mocks.deleteInvite },
  },
}))

import { DELETE, GET, PATCH } from '@/app/api/admin/testimonials/route'

function testimonial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'testimonial-1',
    inviteId: 'invite-1',
    quote: 'Quizotic helped our trainers run lively knowledge checks without slowing the session.',
    displayQuote: null,
    publicationConsent: true,
    editingAllowed: false,
    materialChange: false,
    reconfirmedAt: null,
    reconfirmedQuote: null,
    deletionPendingAt: null,
    status: 'new',
    publishedAt: null,
    photoKey: null,
    ...overrides,
  }
}

describe('admin testimonial API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ admin: { id: 'admin-1', email: 'admin@quizotic.live' }, response: null })
    mocks.findMany.mockResolvedValue([])
    mocks.groupBy.mockResolvedValue([])
    mocks.findUnique.mockResolvedValue(testimonial())
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...testimonial(), ...data }))
    mocks.deleteTestimonials.mockResolvedValue({ count: 1 })
    mocks.deleteInvite.mockResolvedValue({ id: 'invite-1' })
    mocks.deletePhoto.mockResolvedValue(undefined)
  })

  it('rejects listing for non-admin users', async () => {
    mocks.requireAdmin.mockResolvedValue({ admin: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) })

    const response = await GET(new NextRequest('https://www.quizotic.live/api/admin/testimonials'))

    expect(response.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('blocks publishing edited copy without editing consent or reconfirmation', async () => {
    const response = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'published', displayQuote: 'A materially edited testimonial long enough to pass the minimum validation requirement.' }),
    }))

    expect(response.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('publishes consented copy, audits the action, and refreshes the homepage', async () => {
    mocks.findUnique.mockResolvedValue(testimonial({ editingAllowed: true }))

    const response = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'published', displayQuote: 'A lightly edited testimonial that remains faithful to the original Quizotic experience.' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'published', publishedAt: expect.any(Date) }),
    }))
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'testimonial_publish' }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })

  it('preserves existing display copy when a status-only update is requested', async () => {
    const savedDisplay = 'Quizotic made every knowledge check clearer while preserving the pace of our workshop.'
    mocks.findUnique.mockResolvedValue(testimonial({ displayQuote: savedDisplay, editingAllowed: true }))

    const response = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'shortlisted' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ displayQuote: savedDisplay }),
    }))
  })

  it('requires exact contributor reconfirmation for material changes even when light edits were allowed', async () => {
    mocks.findUnique.mockResolvedValue(testimonial({ editingAllowed: true }))
    const displayQuote = 'A materially changed testimonial long enough to pass the minimum validation requirement.'

    const blocked = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'published', displayQuote, materialChange: true }),
    }))
    expect(blocked.status).toBe(409)

    const allowed = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'published', displayQuote, materialChange: true, reconfirmed: true }),
    }))
    expect(allowed.status).toBe(200)
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ materialChange: true, reconfirmedQuote: displayQuote }),
    }))
  })

  it('can revoke a previously recorded reconfirmation', async () => {
    const approvedCopy = 'A previously approved edited testimonial that is long enough for publication.'
    mocks.findUnique.mockResolvedValue(testimonial({
      displayQuote: approvedCopy,
      reconfirmedAt: new Date('2026-07-10T00:00:00.000Z'),
      reconfirmedQuote: approvedCopy,
    }))

    const response = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'shortlisted', reconfirmed: false }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reconfirmedAt: null, reconfirmedQuote: null }),
    }))
  })

  it('blocks updates once permanent deletion has started', async () => {
    mocks.findUnique.mockResolvedValue(testimonial({ deletionPendingAt: new Date('2026-07-20T00:00:00.000Z') }))

    const response = await PATCH(new NextRequest('https://www.quizotic.live/api/admin/testimonials', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'published' }),
    }))

    expect(response.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('deletes the stored photo before permanently deleting its invitation record', async () => {
    mocks.findUnique.mockResolvedValue(testimonial({ photoKey: 'testimonials/user-1/photo.webp' }))

    const response = await DELETE(new NextRequest('https://www.quizotic.live/api/admin/testimonials?id=testimonial-1', { method: 'DELETE' }))

    expect(response.status).toBe(200)
    expect(mocks.deletePhoto).toHaveBeenCalledWith('testimonials/user-1/photo.webp')
    expect(mocks.deleteTestimonials).toHaveBeenCalledWith({ where: { id: 'testimonial-1' } })
    expect(mocks.deleteInvite).not.toHaveBeenCalled()
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'testimonial_delete' }))
  })

  it('hides a published testimonial before attempting retryable photo deletion', async () => {
    mocks.findUnique.mockResolvedValue(testimonial({
      status: 'published',
      publishedAt: new Date('2026-07-10T00:00:00.000Z'),
      photoKey: 'testimonials/photo.webp',
    }))
    mocks.deletePhoto.mockRejectedValue(new Error('R2 unavailable'))

    const response = await DELETE(new NextRequest('https://www.quizotic.live/api/admin/testimonials?id=testimonial-1', { method: 'DELETE' }))

    expect(response.status).toBe(503)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'declined', publishedAt: null, deletionPendingAt: expect.any(Date) }),
    }))
    expect(mocks.deleteTestimonials).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })
})

describe('admin testimonial review surface', () => {
  it('wires a dedicated Testimonials tool with publish and reconfirmation controls', () => {
    const adminPage = readFileSync(join(process.cwd(), 'src/app/host/(dashboard)/admin/page.tsx'), 'utf8')
    const panel = readFileSync(join(process.cwd(), 'src/components/admin/TestimonialsPanel.tsx'), 'utf8')

    expect(adminPage).toContain("| 'testimonials'")
    expect(adminPage).toContain("label: 'Testimonials'")
    expect(adminPage).toContain('<TestimonialsPanel />')
    expect(panel).toContain('/api/admin/testimonials')
    expect(panel).toContain('requestVersion.current')
    expect(panel).toContain('Publish')
    expect(panel).toContain('Original submission')
    expect(panel).toContain('Contributor reconfirmed this edited version')
    expect(panel).toContain('This edit changes the contributor')
    expect(panel).toContain('Delete permanently')
  })
})
