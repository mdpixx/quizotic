import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mocks = vi.hoisted(() => ({ findPublished: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { testimonial: { findMany: mocks.findPublished } },
}))

import { SocialProofSlot } from '@/components/landing/SocialProofSlot'

describe('homepage testimonial publishing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the honest founder fallback when no testimonials are published', async () => {
    mocks.findPublished.mockResolvedValue([])

    const html = renderToStaticMarkup(await SocialProofSlot())

    expect(html).toContain('Mahesh Dhiman')
    expect(html).toContain('tool I wished I had')
  })

  it('renders only the three newest published stories without exposing email addresses', async () => {
    mocks.findPublished.mockResolvedValue([
      { id: '1', quote: 'Original one', displayQuote: 'Published story one', name: 'Asha Rao', designation: 'Teacher', organization: 'Acme School', photoUrl: null },
      { id: '2', quote: 'Original two', displayQuote: null, name: 'Ravi Shah', designation: 'Trainer', organization: null, photoUrl: 'https://cdn.example/ravi.webp' },
      { id: '3', quote: 'Original three', displayQuote: null, name: 'Mina Sen', designation: 'Professor', organization: 'City College', photoUrl: null },
    ])

    const html = renderToStaticMarkup(await SocialProofSlot())

    expect(mocks.findPublished).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'published', publicationConsent: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }))
    expect(html).toContain('Published story one')
    expect(html).toContain('Ravi Shah')
    expect(html).toContain('City College')
    expect(html).not.toContain('@')
    expect(html).not.toContain('tool I wished I had')
  })
})
