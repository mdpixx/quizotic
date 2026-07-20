export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { deleteTestimonialPhoto, uploadTestimonialPhoto } from '@/lib/testimonial-photo'
import {
  hashInviteToken,
  isInviteExpired,
  normalizeTestimonialImage,
  parseTestimonialFields,
  sniffImageMime,
  TESTIMONIAL_CONSENT_VERSION,
  TESTIMONIAL_MAX_PHOTO_BYTES,
  TESTIMONIAL_MAX_REQUEST_BYTES,
} from '@/lib/testimonials'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  return !origin || origin === req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error('Request origin is not allowed.', 403)

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > TESTIMONIAL_MAX_REQUEST_BYTES) {
    return error('The submission is too large. Use a photo no larger than 5 MB.', 413)
  }

  const token = req.cookies.get('quizotic_testimonial_submit')?.value ?? ''
  if (!TOKEN_PATTERN.test(token)) return error('This invitation is invalid or has expired.', 404)

  const rl = await rateLimitRequest(req, {
    bucket: 'testimonial-submit',
    ipLimit: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!rl.ok) return rateLimitResponse(rl, 'Too many attempts. Please try again later.')

  const invite = await prisma.testimonialInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true, organization: true } },
      testimonial: { select: { id: true } },
    },
  })
  if (!invite) return error('This invitation is invalid or has expired.', 404)

  const inviteLimit = await rateLimit({
    bucket: 'testimonial-submit:invite',
    identifier: invite.id,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!inviteLimit.ok) return rateLimitResponse(inviteLimit, 'Too many attempts. Please try again later.')

  if (invite.usedAt || invite.testimonial) {
    return NextResponse.json({ ok: true, alreadySubmitted: true })
  }
  if (isInviteExpired(invite.expiresAt)) return error('This invitation has expired.', 410)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return error('We could not read this submission. Please try again.', 400)
  }

  const parsed = parseTestimonialFields({
    quote: formData.get('quote'),
    name: formData.get('name'),
    designation: formData.get('designation'),
    organization: formData.get('organization') ?? '',
    publicationConsent: formData.get('publicationConsent'),
    editingAllowed: formData.get('editingAllowed') ?? 'false',
  })
  if (!parsed.success) return error('Please check the highlighted fields and consent.', 400)

  let photo: { key: string; url: string } | null = null
  const photoValue = formData.get('photo')
  if (photoValue instanceof File && photoValue.size > 0) {
    const extension = photoValue.name.toLowerCase().split('.').pop() ?? ''
    if (photoValue.size > TESTIMONIAL_MAX_PHOTO_BYTES || !PHOTO_EXTENSIONS.has(extension)) {
      return error('Use one JPEG, PNG, or WebP photo no larger than 5 MB.', 400)
    }
    const bytes = new Uint8Array(await photoValue.arrayBuffer())
    const detectedMime = sniffImageMime(bytes)
    if (!detectedMime || detectedMime !== photoValue.type) {
      return error('The selected photo is not a valid JPEG, PNG, or WebP image.', 400)
    }
    let normalizedBytes: Uint8Array
    try {
      normalizedBytes = await normalizeTestimonialImage(bytes)
    } catch {
      return error('The selected photo could not be verified. Try another JPEG, PNG, or WebP image.', 400)
    }
    try {
      photo = await uploadTestimonialPhoto({ bytes: normalizedBytes, mime: 'image/webp' })
    } catch (uploadError) {
      console.error('[testimonials] photo upload failed', uploadError instanceof Error ? uploadError.message : uploadError)
      return error('We could not upload that photo. Try again or submit without it.', 503)
    }
  }

  try {
    const now = new Date()
    const testimonial = await prisma.$transaction(async tx => {
      const consumed = await tx.testimonialInvite.updateMany({
        where: {
          id: invite.id,
          tokenHash: hashInviteToken(token),
          expiresAt: { gt: now },
          usedAt: null,
        },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) return null

      return tx.testimonial.create({
        data: {
          inviteId: invite.id,
          userId: invite.userId,
          emailSnapshot: invite.user.email,
          name: parsed.data.name,
          designation: parsed.data.designation,
          organization: parsed.data.organization,
          quote: parsed.data.quote,
          photoUrl: photo?.url ?? null,
          photoKey: photo?.key ?? null,
          publicationConsent: parsed.data.publicationConsent,
          editingAllowed: parsed.data.editingAllowed,
          consentVersion: TESTIMONIAL_CONSENT_VERSION,
          consentGrantedAt: now,
        },
        select: { id: true },
      })
    })

    if (!testimonial) {
      if (photo) await deleteTestimonialPhoto(photo.key).catch(() => undefined)
      return NextResponse.json({ ok: true, alreadySubmitted: true })
    }
    return NextResponse.json({ ok: true, id: testimonial.id }, { status: 201 })
  } catch (dbError) {
    if (photo) await deleteTestimonialPhoto(photo.key).catch(() => undefined)
    console.error('[testimonials] persistence failed', dbError instanceof Error ? dbError.message : dbError)
    return error('We could not save your story. Please try again.', 500)
  }
}
