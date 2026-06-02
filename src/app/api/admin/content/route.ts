export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 20

// GET /api/admin/content?type=quiz|presentation&search=&sort=&page=
// Admin-only: lists ALL users' quizzes or presentations (no userId filter).
// This is a separate, gated endpoint — the user-facing /api/quizzes etc. stay
// owner-scoped.
export async function GET(req: NextRequest) {
  const { response } = await requireAdmin()
  if (response) return response

  const url = new URL(req.url)
  const type = url.searchParams.get('type') === 'presentation' ? 'presentation' : 'quiz'
  const search = (url.searchParams.get('search') ?? '').trim()
  const sort = url.searchParams.get('sort') ?? 'updated' // 'updated' | 'created' | 'sessions'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const insensitive = 'insensitive' as const
  const searchWhere = search
    ? {
        OR: [
          { title: { contains: search, mode: insensitive } },
          { user: { email: { contains: search, mode: insensitive } } },
          { user: { name: { contains: search, mode: insensitive } } },
        ],
      }
    : {}

  const orderBy =
    sort === 'created'
      ? { createdAt: Prisma.SortOrder.desc }
      : sort === 'sessions'
        ? { sessions: { _count: Prisma.SortOrder.desc } }
        : { updatedAt: Prisma.SortOrder.desc }

  const ownerSelect = { select: { id: true, name: true, email: true } }

  if (type === 'presentation') {
    const [rows, total] = await Promise.all([
      prisma.presentation.findMany({
        where: searchWhere,
        orderBy,
        skip,
        take: PAGE_SIZE,
        select: {
          id: true, title: true, theme: true, slides: true, createdAt: true, updatedAt: true,
          user: ownerSelect,
          _count: { select: { sessions: true } },
        },
      }),
      prisma.presentation.count({ where: searchWhere }),
    ])
    const items = rows.map(r => ({
      id: r.id,
      type: 'presentation' as const,
      title: r.title,
      subject: null as string | null,
      language: null as string | null,
      itemCount: Array.isArray(r.slides) ? r.slides.length : 0,
      sessions: r._count.sessions,
      owner: r.user ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE })
  }

  const [rows, total] = await Promise.all([
    prisma.quiz.findMany({
      where: searchWhere,
      orderBy,
      skip,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, subject: true, language: true, theme: true, questions: true,
        createdAt: true, updatedAt: true,
        user: ownerSelect,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.quiz.count({ where: searchWhere }),
  ])
  const items = rows.map(r => ({
    id: r.id,
    type: 'quiz' as const,
    title: r.title,
    subject: r.subject,
    language: r.language,
    itemCount: Array.isArray(r.questions) ? r.questions.length : 0,
    sessions: r._count.sessions,
    owner: r.user ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE })
}
