import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createInviteToken,
  hashInviteToken,
  isInviteExpired,
  parseTestimonialFields,
  sniffImageMime,
  canPublishDisplayQuote,
} from '@/lib/testimonials'

describe('testimonial invitations', () => {
  it('creates a high-entropy opaque token and stores only its SHA-256 hash', () => {
    const invitation = createInviteToken()

    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(invitation.tokenHash).toBe(hashInviteToken(invitation.token))
    expect(invitation.tokenHash).not.toContain(invitation.token)
  })

  it('treats an invitation as expired at its expiry instant', () => {
    const expiresAt = new Date('2026-08-19T00:00:00.000Z')

    expect(isInviteExpired(expiresAt, new Date('2026-08-18T23:59:59.999Z'))).toBe(false)
    expect(isInviteExpired(expiresAt, new Date('2026-08-19T00:00:00.000Z'))).toBe(true)
  })
})

describe('testimonial persistence schema', () => {
  it('defines invitation and testimonial records with single-use and campaign constraints', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260720_testimonials/migration.sql'),
      'utf8',
    )

    expect(schema).toContain('model TestimonialInvite')
    expect(schema).toContain('tokenHash   String   @unique')
    expect(schema).toContain('@@unique([userId, campaignKey])')
    expect(schema).toContain('model Testimonial {')
    expect(schema).toContain('inviteId           String?   @unique')
    expect(schema).toContain('@@index([userId])')
    expect(schema).toContain('materialChange')
    expect(schema).toContain('reconfirmedQuote')
    expect(schema).toContain('deliveryState')
    expect(schema).toContain('model EmailSuppression')
    expect(migration).toContain('CREATE TABLE "TestimonialInvite"')
    expect(migration).toContain('CREATE TABLE "Testimonial"')
    expect(migration).toContain('ON DELETE SET NULL')
    expect(migration).toContain('Testimonial_status_check')
    expect(migration).toContain('Testimonial_deletion_pending_check')
    expect(migration).toContain('TestimonialInvite_delivery_state_check')
    expect(migration).toContain('CREATE TABLE "EmailSuppression"')
  })
})

describe('testimonial submission validation', () => {
  it('trims valid fields and records explicit consent choices', () => {
    const result = parseTestimonialFields({
      quote: `  Quizotic helped our trainers run lively knowledge checks without slowing the session.  `,
      name: '  Asha Rao ',
      designation: ' Learning Manager ',
      organization: ' Acme India ',
      publicationConsent: 'true',
      editingAllowed: 'true',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      quote: 'Quizotic helped our trainers run lively knowledge checks without slowing the session.',
      name: 'Asha Rao',
      designation: 'Learning Manager',
      organization: 'Acme India',
      publicationConsent: true,
      editingAllowed: true,
    })
  })

  it('rejects short stories and missing publication consent', () => {
    const result = parseTestimonialFields({
      quote: 'It was good.',
      name: 'Asha Rao',
      designation: 'Teacher',
      organization: '',
      publicationConsent: 'false',
      editingAllowed: 'false',
    })

    expect(result.success).toBe(false)
  })
})

describe('testimonial photo validation', () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp'],
  ])('recognises supported image bytes', (bytes, mime) => {
    expect(sniffImageMime(bytes)).toBe(mime)
  })

  it('rejects a file whose bytes do not describe a supported image', () => {
    expect(sniffImageMime(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull()
  })
})

describe('testimonial publication rules', () => {
  it('allows the original quote to publish without editing consent', () => {
    expect(canPublishDisplayQuote('Original words', 'Original words', false, false, null)).toBe(true)
  })

  it('blocks edited copy without editing consent or reconfirmation', () => {
    expect(canPublishDisplayQuote('Original words', 'Edited words', false, false, null)).toBe(false)
  })

  it('allows only light edits under editing consent', () => {
    expect(canPublishDisplayQuote('Original words', 'Edited words', true, false, null)).toBe(true)
    expect(canPublishDisplayQuote('Original words', 'Edited words', true, true, null)).toBe(false)
  })

  it('ties reconfirmation to the exact contributor-approved wording', () => {
    expect(canPublishDisplayQuote('Original words', 'Approved edited words', false, true, 'Approved edited words')).toBe(true)
    expect(canPublishDisplayQuote('Original words', 'Later edited words', false, true, 'Approved edited words')).toBe(false)
  })
})
