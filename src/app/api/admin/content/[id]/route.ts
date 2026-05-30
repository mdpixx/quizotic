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

const ownerSelect = { select: { id: true, name: true, email: true } }

// GET /api/admin/content/[id]?type=quiz|presentation
// Admin-only read of ANY user's quiz/presentation (no owner filter). Every
// read is recorded in AdminAuditLog for accountability.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const type = new URL(req.url).searchParams.get('type') === 'presentation' ? 'presentation' : 'quiz'

  if (type === 'presentation') {
    const p = await prisma.presentation.findUnique({
      where: { id },
      include: { user: ownerSelect, _count: { select: { sessions: true } } },
    })
    if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await writeAuditLog({
      req,
      actor: { id: admin.id, email: admin.email! },
      action: 'admin_view_content',
      targetType: 'presentation',
      targetId: id,
      payload: { title: p.title, ownerEmail: p.user?.email ?? null },
      reason: 'admin content inspection',
    })

    return NextResponse.json({
      type,
      item: {
        id: p.id,
        title: p.title,
        theme: p.theme,
        slides: p.slides,
        owner: p.user ?? null,
        sessions: p._count.sessions,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    })
  }

  const q = await prisma.quiz.findUnique({
    where: { id },
    include: { user: ownerSelect, _count: { select: { sessions: true } } },
  })
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email! },
    action: 'admin_view_content',
    targetType: 'quiz',
    targetId: id,
    payload: { title: q.title, ownerEmail: q.user?.email ?? null },
    reason: 'admin content inspection',
  })

  return NextResponse.json({
    type,
    item: {
      id: q.id,
      title: q.title,
      subject: q.subject,
      language: q.language,
      theme: q.theme,
      questions: q.questions,
      owner: q.user ?? null,
      sessions: q._count.sessions,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    },
  })
}
