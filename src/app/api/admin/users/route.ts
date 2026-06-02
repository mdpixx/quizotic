export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 25

// GET /api/admin/users?search=&page= — paginated users with activity counts.
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const url = new URL(req.url)
  const search = (url.searchParams.get('search') ?? '').trim()
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const insensitive = 'insensitive' as const
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: insensitive } },
          { name: { contains: search, mode: insensitive } },
          { organization: { contains: search, mode: insensitive } },
        ],
      }
    : {}

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, role: true, organization: true, country: true,
        onboarded: true, lastActiveAt: true, createdAt: true,
        subscription: { select: { plan: true, status: true } },
        _count: { select: { quizzes: true, presentations: true, gameSessions: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const items = rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organization: u.organization,
    country: u.country,
    onboarded: u.onboarded,
    plan: u.subscription?.status === 'active' ? u.subscription.plan : 'free',
    quizzes: u._count.quizzes,
    presentations: u._count.presentations,
    sessions: u._count.gameSessions,
    lastActiveAt: u.lastActiveAt,
    createdAt: u.createdAt,
  }))

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE })
}
