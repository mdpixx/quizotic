export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

// PATCH /api/admin/coupons/[id] — toggle active or update validUntil.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const data: { active?: boolean; validUntil?: Date | null } = {}
  if (typeof body.active === 'boolean') data.active = body.active
  if (typeof body.validUntil === 'string') data.validUntil = new Date(body.validUntil)
  if (body.validUntil === null) data.validUntil = null
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const before = await prisma.coupon.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const after = await prisma.coupon.update({ where: { id }, data })

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'coupon_update',
    targetType: 'coupon',
    targetId: id,
    payload: body,
    beforeState: { active: before.active, validUntil: before.validUntil },
    afterState: { active: after.active, validUntil: after.validUntil },
    reason: typeof body.reason === 'string' && body.reason.trim().length >= 5
      ? body.reason.trim()
      : `Coupon update: ${after.code}`,
  })

  return NextResponse.json({ success: true, coupon: after })
}
