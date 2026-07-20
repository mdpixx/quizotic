import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ findInvite: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { testimonialInvite: { findUnique: mocks.findInvite } },
}))

import { loadTestimonialInvite } from '@/lib/testimonial-invites'
import { TestimonialForm } from '@/app/share-your-story/TestimonialForm'
import { proxy } from '@/proxy'

const TOKEN = 'a'.repeat(43)
const NOW = new Date('2026-07-20T00:00:00.000Z')

describe('testimonial invitation page state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns invalid without querying for malformed bearer tokens', async () => {
    await expect(loadTestimonialInvite('not-a-token', NOW)).resolves.toEqual({ status: 'invalid' })
    expect(mocks.findInvite).not.toHaveBeenCalled()
  })

  it('returns an active invitation with safe prefill fields', async () => {
    mocks.findInvite.mockResolvedValue({
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      usedAt: null,
      user: { name: 'Asha Rao', organization: 'Acme India' },
      testimonial: null,
    })

    await expect(loadTestimonialInvite(TOKEN, NOW)).resolves.toEqual({
      status: 'active',
      name: 'Asha Rao',
      organization: 'Acme India',
    })
  })

  it('returns submitted for a consumed invitation', async () => {
    mocks.findInvite.mockResolvedValue({
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      usedAt: new Date('2026-07-19T00:00:00.000Z'),
      user: { name: 'Asha Rao', organization: null },
      testimonial: { id: 'testimonial-1' },
    })

    await expect(loadTestimonialInvite(TOKEN, NOW)).resolves.toEqual({ status: 'submitted' })
  })

  it('keeps the submitted state after the invitation expiry date', async () => {
    mocks.findInvite.mockResolvedValue({
      expiresAt: new Date('2026-07-01T00:00:00.000Z'),
      usedAt: new Date('2026-06-20T00:00:00.000Z'),
      user: { name: 'Asha Rao', organization: null },
      testimonial: { id: 'testimonial-1' },
    })

    await expect(loadTestimonialInvite(TOKEN, NOW)).resolves.toEqual({ status: 'submitted' })
  })
})

describe('testimonial invitation privacy', () => {
  it('prevents invitation query strings leaking through referrer headers', async () => {
    const page = await import('@/app/share-your-story/page')
    expect(page.metadata.referrer).toBe('no-referrer')
  })

  it('exchanges the URL bearer for an HttpOnly cookie and redirects to a clean URL', () => {
    const response = proxy(new NextRequest(`https://www.quizotic.live/share-your-story?invite=${TOKEN}`))

    expect(response.headers.get('location')).toBe('https://www.quizotic.live/share-your-story')
    expect(response.headers.get('set-cookie')).toContain('quizotic_testimonial_page=')
    expect(response.headers.get('set-cookie')).toContain('quizotic_testimonial_submit=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax')
  })
})

describe('testimonial form', () => {
  it('renders the complete consent, photo, and live-preview contract', () => {
    const html = renderToStaticMarkup(
      createElement(TestimonialForm, {
        defaultName: 'Asha Rao',
        defaultOrganization: 'Acme India',
      }),
    )

    expect(html).toContain('How has Quizotic made hosting or participating in quizzes better for you?')
    expect(html).toContain('minLength="40"')
    expect(html).toContain('maxLength="800"')
    expect(html).toContain('name="designation"')
    expect(html).toContain('name="photo"')
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(html).toContain('Remove photograph')
    expect(html).toContain('name="publicationConsent"')
    expect(html).toContain('Quizotic may publish')
    expect(html).toContain('Preview on Quizotic')
    expect(html).toContain('Asha Rao')
    expect(html).not.toContain(TOKEN)
  })
})
