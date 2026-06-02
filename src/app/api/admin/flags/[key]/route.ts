export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/admin-audit'
import { invalidateFlagCache } from '@/lib/feature-flags'
import { requireAdmin } from '@/lib/admin-auth'

// PATCH — update enabled / rolloutPercent / description.
const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(5).max(500),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { admin, response } = await requireAdmin()
  if (response) return response
  const { key } = await ctx.params

  let parsed: z.infer<typeof PatchSchema>
  try {
    parsed = PatchSchema.parse(await req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map(i => i.message).join('; ') : 'Invalid'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const before = await prisma.featureFlag.findUnique({ where: { key } })
  if (!before) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })

  const data: { enabled?: boolean; rolloutPercent?: number; description?: string } = {}
  if (parsed.enabled !== undefined) data.enabled = parsed.enabled
  if (parsed.rolloutPercent !== undefined) data.rolloutPercent = parsed.rolloutPercent
  if (parsed.description !== undefined) data.description = parsed.description

  const after = await prisma.featureFlag.update({ where: { key }, data })
  invalidateFlagCache(key)

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'feature_flag_update',
    targetType: 'feature_flag',
    targetId: after.id,
    payload: { key, ...parsed },
    beforeState: { enabled: before.enabled, rolloutPercent: before.rolloutPercent },
    afterState: { enabled: after.enabled, rolloutPercent: after.rolloutPercent },
    reason: parsed.reason,
  })

  return NextResponse.json({ success: true, flag: after })
}

// DELETE — remove a flag entirely. Cascades to assignments.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { admin, response } = await requireAdmin()
  if (response) return response
  const { key } = await ctx.params

  const flag = await prisma.featureFlag.findUnique({ where: { key } })
  if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })

  await prisma.featureFlag.delete({ where: { key } })
  invalidateFlagCache(key)

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'feature_flag_delete',
    targetType: 'feature_flag',
    targetId: flag.id,
    payload: { key },
    beforeState: { enabled: flag.enabled, rolloutPercent: flag.rolloutPercent },
    reason: `Flag deleted: ${key}`,
  })

  return NextResponse.json({ success: true })
}
