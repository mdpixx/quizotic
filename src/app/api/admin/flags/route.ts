export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/admin-audit'
import { invalidateFlagCache } from '@/lib/feature-flags'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

// GET — list flags with their assignment counts.
export async function GET() {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
    include: { _count: { select: { assignments: true } } },
  })
  return NextResponse.json({ flags })
}

// POST — create a new flag.
const CreateSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/, 'lowercase letters / digits / underscore only'),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(0),
})

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let parsed: z.infer<typeof CreateSchema>
  try {
    parsed = CreateSchema.parse(await req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map(i => i.message).join('; ') : 'Invalid'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const existing = await prisma.featureFlag.findUnique({ where: { key: parsed.key } })
  if (existing) {
    return NextResponse.json({ error: `Flag "${parsed.key}" already exists` }, { status: 409 })
  }

  const flag = await prisma.featureFlag.create({
    data: {
      key: parsed.key,
      description: parsed.description ?? null,
      enabled: parsed.enabled,
      rolloutPercent: parsed.rolloutPercent,
      createdBy: admin.id,
      metadata: Prisma.JsonNull,
    },
  })

  invalidateFlagCache(parsed.key)

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'feature_flag_create',
    targetType: 'feature_flag',
    targetId: flag.id,
    payload: parsed,
    afterState: { enabled: flag.enabled, rolloutPercent: flag.rolloutPercent },
    reason: parsed.description ?? `Flag created: ${parsed.key}`,
  })

  return NextResponse.json({ success: true, flag })
}
