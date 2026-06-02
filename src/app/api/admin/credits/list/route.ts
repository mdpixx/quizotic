export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAiUsageSummary } from '@/lib/ai-quota'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/credits/list?email=user@example.com
// Returns the target user + monthly usage + bonus-credit summary + recent
// grants. Drives the Credits panel in the admin UI.
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const url = new URL(req.url)
  const email = url.searchParams.get('email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'email query param required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, name: true, createdAt: true, role: true, organization: true,
      country: true, locale: true, lastActiveAt: true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  const [usage, grants] = await Promise.all([
    getAiUsageSummary(user.id),
    prisma.creditGrant.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  // Resolve grantedBy admin emails (best-effort — admins may have been
  // deleted; leave their id if so).
  const grantorIds = Array.from(new Set(grants.map(g => g.grantedBy)))
  const grantors = grantorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: grantorIds } },
        select: { id: true, email: true },
      })
    : []
  const grantorEmail = new Map(grantors.map(g => [g.id, g.email]))

  const now = Date.now()
  const grantsView = grants.map(g => ({
    id: g.id,
    bucket: g.bucket,
    amount: g.amount,
    reason: g.reason,
    expiresAt: g.expiresAt?.toISOString() ?? null,
    grantedBy: grantorEmail.get(g.grantedBy) ?? g.grantedBy,
    grantedAt: g.createdAt.toISOString(),
    isActive: !g.expiresAt || g.expiresAt.getTime() > now,
    metadata: g.metadata ?? null,
  }))

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      country: user.country,
      locale: user.locale,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    plan: usage.plan,
    monthlyUsage: usage,
    grants: grantsView,
  })
}
