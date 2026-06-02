export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/coupons — list all coupons (most recent first).
export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ coupons })
}

// POST /api/admin/coupons — create a new coupon.
const CreateSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, 'letters/digits/_/- only'),
  kind: z.enum(['credits', 'pro_days', 'percent_off', 'amount_off']),
  value: z.number().int().positive(),
  bucket: z.enum(['questions', 'enhancements']).optional(),
  currency: z.enum(['usd', 'inr']).optional(),
  description: z.string().max(500).optional(),
  maxRedemptions: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().datetime().nullish(),
  validUntil: z.string().datetime().nullish(),
  active: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdmin()
  if (response) return response

  let parsed: z.infer<typeof CreateSchema>
  try {
    parsed = CreateSchema.parse(await req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError
      ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      : 'Invalid JSON'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Cross-field sanity:
  if (parsed.kind === 'credits' && !parsed.bucket) {
    return NextResponse.json({ error: 'bucket is required for kind=credits' }, { status: 400 })
  }
  if (parsed.kind === 'amount_off' && !parsed.currency) {
    return NextResponse.json({ error: 'currency is required for kind=amount_off' }, { status: 400 })
  }
  if (parsed.kind === 'percent_off' && parsed.value > 100) {
    return NextResponse.json({ error: 'percent_off must be 0-100' }, { status: 400 })
  }

  const code = parsed.code.toUpperCase()
  const existing = await prisma.coupon.findUnique({ where: { code } })
  if (existing) {
    return NextResponse.json({ error: `Code "${code}" already exists` }, { status: 409 })
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      kind: parsed.kind,
      value: parsed.value,
      bucket: parsed.bucket ?? null,
      currency: parsed.currency ?? null,
      description: parsed.description ?? null,
      maxRedemptions: parsed.maxRedemptions ?? null,
      perUserLimit: parsed.perUserLimit,
      validFrom: parsed.validFrom ? new Date(parsed.validFrom) : null,
      validUntil: parsed.validUntil ? new Date(parsed.validUntil) : null,
      active: parsed.active,
      createdBy: admin.id,
      metadata: Prisma.JsonNull,
    },
  })

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'coupon_create',
    targetType: 'coupon',
    targetId: coupon.id,
    payload: { ...parsed, code },
    afterState: { id: coupon.id, code: coupon.code, kind: coupon.kind, value: coupon.value },
    reason: parsed.description ?? `Coupon created: ${code}`,
  })

  return NextResponse.json({ success: true, coupon })
}
