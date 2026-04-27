export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const GRACE_DAYS = 7

// GET — has the user already filed a deletion request? Used by the
// account-settings UI to show the right button.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.dataDeletionRequest.findFirst({
    where: { userId: user.id, status: { in: ['pending', 'approved'] } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    request: existing
      ? {
          id: existing.id,
          status: existing.status,
          requestedAt: existing.requestedAt.toISOString(),
          graceExpiresAt: existing.graceExpiresAt.toISOString(),
        }
      : null,
  })
}

// POST — file a new deletion request. Idempotent: if one is already pending
// we return the existing row instead of creating a duplicate.
const FileSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let parsed: z.infer<typeof FileSchema>
  try {
    parsed = FileSchema.parse(await req.json().catch(() => ({})))
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Dedupe — if one is in flight, return that.
  const existing = await prisma.dataDeletionRequest.findFirst({
    where: { userId: user.id, status: { in: ['pending', 'approved'] } },
  })
  if (existing) {
    return NextResponse.json({ request: { id: existing.id, status: existing.status, graceExpiresAt: existing.graceExpiresAt.toISOString() } })
  }

  const graceExpiresAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000)
  const request = await prisma.dataDeletionRequest.create({
    data: {
      userId: user.id,
      status: 'pending',
      reason: parsed.reason ?? null,
      graceExpiresAt,
      metadata: Prisma.JsonNull,
    },
  })

  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      graceExpiresAt: request.graceExpiresAt.toISOString(),
    },
    graceDays: GRACE_DAYS,
  })
}

// DELETE — user cancels a pending deletion request before grace expires.
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await prisma.dataDeletionRequest.updateMany({
    where: { userId: user.id, status: 'pending' },
    data: { status: 'cancelled' },
  })
  return NextResponse.json({ cancelled: result.count })
}
