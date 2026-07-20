export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { writeAuditLog } from '@/lib/admin-audit'
import { deleteTestimonialPhoto } from '@/lib/testimonial-photo'
import { canPublishDisplayQuote } from '@/lib/testimonials'

const StatusSchema = z.enum(['new', 'shortlisted', 'published', 'declined'])

export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const rawStatus = req.nextUrl.searchParams.get('status')
  const parsedStatus = rawStatus && rawStatus !== 'all' ? StatusSchema.safeParse(rawStatus) : null
  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
  }
  const where = parsedStatus?.success
    ? { status: parsedStatus.data }
    : rawStatus === 'all'
      ? {}
      : { status: { in: ['new', 'shortlisted'] } }

  const [items, counts] = await Promise.all([
    prisma.testimonial.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.testimonial.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  return NextResponse.json({
    items,
    counts: Object.fromEntries(counts.map(row => [row.status, row._count._all])),
  })
}

const PatchSchema = z.object({
  id: z.string().min(1),
  status: StatusSchema,
  displayQuote: z.string().trim().max(800).optional(),
  materialChange: z.boolean().optional(),
  reconfirmed: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const { admin, response } = await requireAdmin()
  if (response) return response

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid testimonial update.' }, { status: 400 })

  const before = await prisma.testimonial.findUnique({ where: { id: parsed.data.id } })
  if (!before) return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 })
  if (before.deletionPendingAt) {
    return NextResponse.json({ error: 'This testimonial is pending permanent deletion.' }, { status: 409 })
  }

  const displayQuote = parsed.data.displayQuote === undefined
    ? before.displayQuote
    : parsed.data.displayQuote.trim() || null
  const publicQuote = displayQuote ?? before.quote
  if (displayQuote && displayQuote.length < 40) {
    return NextResponse.json({ error: 'Published testimonial text must be at least 40 characters.' }, { status: 400 })
  }

  const now = new Date()
  const materialChange = parsed.data.materialChange ?? before.materialChange
  const reconfirmedAt = parsed.data.reconfirmed === true
    ? now
    : parsed.data.reconfirmed === false
      ? null
      : before.reconfirmedAt
  const reconfirmedQuote = parsed.data.reconfirmed === true
    ? publicQuote
    : parsed.data.reconfirmed === false
      ? null
      : before.reconfirmedQuote
  if (parsed.data.status === 'published') {
    if (!before.publicationConsent) {
      return NextResponse.json({ error: 'This contributor did not grant publication consent.' }, { status: 409 })
    }
    if (!canPublishDisplayQuote(before.quote, publicQuote, before.editingAllowed, materialChange, reconfirmedQuote)) {
      return NextResponse.json({ error: 'Record contributor reconfirmation before publishing edited copy.' }, { status: 409 })
    }
  }

  const after = await prisma.testimonial.update({
    where: { id: before.id, deletionPendingAt: null },
    data: {
      status: parsed.data.status,
      displayQuote,
      materialChange,
      reconfirmedAt,
      reconfirmedQuote,
      publishedAt: parsed.data.status === 'published' ? (before.publishedAt ?? now) : null,
    },
  })

  const action = parsed.data.status === 'published'
    ? 'testimonial_publish'
    : before.status === 'published'
      ? 'testimonial_unpublish'
      : `testimonial_${parsed.data.status}`
  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action,
    targetType: 'testimonial',
    targetId: before.id,
    payload: {
      status: parsed.data.status,
      edited: publicQuote !== before.quote,
      materialChange,
      reconfirmed: Boolean(parsed.data.reconfirmed),
    },
    beforeState: { status: before.status, publishedAt: before.publishedAt },
    afterState: { status: after.status, publishedAt: after.publishedAt },
    reason: `Testimonial review changed status from ${before.status} to ${after.status}`,
  })

  if (before.status === 'published' || after.status === 'published') revalidatePath('/')
  return NextResponse.json({ success: true, item: after })
}

export async function DELETE(req: NextRequest) {
  const { admin, response } = await requireAdmin()
  if (response) return response

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Testimonial id is required.' }, { status: 400 })

  const before = await prisma.testimonial.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 })

  // Tombstone first so a storage/database failure can never leave a broken
  // photograph on the public homepage. A repeated DELETE safely resumes.
  await prisma.testimonial.update({
    where: { id: before.id },
    data: {
      status: 'declined',
      publishedAt: null,
      deletionPendingAt: before.deletionPendingAt ?? new Date(),
    },
  })
  if (before.status === 'published') revalidatePath('/')

  if (before.photoKey) {
    try {
      await deleteTestimonialPhoto(before.photoKey)
    } catch (photoError) {
      console.error('[testimonials] photo deletion failed', photoError instanceof Error ? photoError.message : photoError)
      return NextResponse.json({ error: 'The photograph could not be removed. Try again.' }, { status: 503 })
    }
  }

  await prisma.testimonial.deleteMany({ where: { id: before.id } })
  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'testimonial_delete',
    targetType: 'testimonial',
    targetId: before.id,
    payload: { hadPhoto: Boolean(before.photoKey), previousStatus: before.status },
    beforeState: { status: before.status, publishedAt: before.publishedAt },
    afterState: { deleted: true },
    reason: 'Permanent deletion from testimonial review',
  })
  return NextResponse.json({ success: true })
}
