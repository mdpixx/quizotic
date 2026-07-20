import { createHash, randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { z } from 'zod'

export const TESTIMONIAL_CAMPAIGN_KEY = 'testimonial-2026-07'
export const TESTIMONIAL_CONSENT_VERSION = '2026-07-1'
export const TESTIMONIAL_INVITE_DAYS = 30
export const TESTIMONIAL_MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const TESTIMONIAL_MAX_REQUEST_BYTES = 6 * 1024 * 1024
export const TESTIMONIAL_MAX_IMAGE_PIXELS = 25_000_000

const TestimonialFieldsSchema = z.object({
  quote: z.string().trim().min(40).max(800),
  name: z.string().trim().min(2).max(100),
  designation: z.string().trim().min(2).max(120),
  organization: z.string().trim().max(160).optional().transform(value => value || null),
  publicationConsent: z.literal('true').transform(() => true as const),
  editingAllowed: z.enum(['true', 'false']).transform(value => value === 'true'),
})

export type TestimonialFields = {
  quote: string
  name: string
  designation: string
  organization: string | null
  publicationConsent: true
  editingAllowed: boolean
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export function inviteExpiry(from = new Date()): Date {
  return new Date(from.getTime() + TESTIMONIAL_INVITE_DAYS * 24 * 60 * 60 * 1000)
}

export function isInviteExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function parseTestimonialFields(input: Record<string, unknown>) {
  return TestimonialFieldsSchema.safeParse(input)
}

export type TestimonialImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export function sniffImageMime(bytes: Uint8Array): TestimonialImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function extensionForImageMime(mime: TestimonialImageMime): 'jpg' | 'png' | 'webp' {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'
}

export async function normalizeTestimonialImage(bytes: Uint8Array): Promise<Uint8Array> {
  const image = sharp(bytes, {
    failOn: 'warning',
    limitInputPixels: TESTIMONIAL_MAX_IMAGE_PIXELS,
    animated: false,
  })
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > TESTIMONIAL_MAX_IMAGE_PIXELS) {
    throw new Error('Invalid image dimensions')
  }

  const normalized = await image
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer()
  return new Uint8Array(normalized)
}

export function canPublishDisplayQuote(
  originalQuote: string,
  displayQuote: string,
  editingAllowed: boolean,
  materialChange: boolean,
  reconfirmedQuote: string | null,
): boolean {
  const original = originalQuote.trim()
  const display = displayQuote.trim()
  if (original === display) return true

  const exactCopyWasReconfirmed = reconfirmedQuote?.trim() === display
  if (materialChange) return exactCopyWasReconfirmed
  return editingAllowed || exactCopyWasReconfirmed
}
