export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/admin-audit'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

// GET — list moderation flags, default to open + reviewing.
export async function GET(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const where = statusParam
    ? { status: statusParam }
    : { status: { in: ['open', 'reviewing'] } }

  const flags = await prisma.moderationFlag.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ flags })
}

// PATCH — admin updates the disposition of a flag.
const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  disposition: z.enum(['removed', 'no_action', 'banned']).optional(),
  reason: z.string().min(5).max(500),
})

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let parsed: z.infer<typeof PatchSchema>
  try {
    parsed = PatchSchema.parse(await req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map(i => i.message).join('; ') : 'Invalid'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const before = await prisma.moderationFlag.findUnique({ where: { id: parsed.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const after = await prisma.moderationFlag.update({
    where: { id: parsed.id },
    data: {
      status: parsed.status,
      disposition: parsed.disposition ?? null,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    },
  })

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'moderation_review',
    targetType: 'moderation_flag',
    targetId: parsed.id,
    payload: parsed,
    beforeState: { status: before.status, disposition: before.disposition },
    afterState: { status: after.status, disposition: after.disposition },
    reason: parsed.reason,
  })

  return NextResponse.json({ success: true, flag: after })
}
