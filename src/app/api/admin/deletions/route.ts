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

// GET — list deletion requests, default to pending + approved.
export async function GET(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const where = statusParam
    ? { status: statusParam }
    : { status: { in: ['pending', 'approved'] } }

  const requests = await prisma.dataDeletionRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true, name: true } },
    },
    take: 200,
  })
  return NextResponse.json({ requests })
}

// PATCH — admin transitions a request: approve early, reject, or
// mark completed (after manually running the data-deletion job).
// Actual data deletion is OUT OF SCOPE here — this just tracks state.
// Wiring to a deletion job is a separate task once we have one.
const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(['approved', 'completed', 'rejected']),
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
  } catch {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  }

  const before = await prisma.dataDeletionRequest.findUnique({ where: { id: parsed.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const after = await prisma.dataDeletionRequest.update({
    where: { id: parsed.id },
    data: {
      status: parsed.status,
      completedAt: parsed.status === 'completed' ? new Date() : null,
      completedBy: parsed.status === 'completed' ? admin.id : null,
    },
  })

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'deletion_request_update',
    targetType: 'deletion_request',
    targetId: parsed.id,
    payload: parsed,
    beforeState: { status: before.status },
    afterState: { status: after.status },
    reason: parsed.reason,
  })

  return NextResponse.json({ success: true, request: after })
}
