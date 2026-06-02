export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/admin-auth'

// PATCH /api/admin/coupons/[id] — toggle active or update validUntil.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin()
  if (response) return response

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
