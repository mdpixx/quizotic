export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

// POST — Grant Pro to a user
export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, months = 12 }: { email?: string; months?: number } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!targetUser) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + months)

  await prisma.subscription.upsert({
    where: { userId: targetUser.id },
    create: {
      userId: targetUser.id,
      plan: 'pro_monthly',
      status: 'active',
      provider: 'manual',
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiresAt,
    },
    update: {
      plan: 'pro_monthly',
      status: 'active',
      provider: 'manual',
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiresAt,
    },
  })

  return NextResponse.json({ success: true, email, plan: 'pro', expiresAt: expiresAt.toISOString() })
}

// DELETE — Revoke Pro from a user
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email }: { email?: string } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!targetUser) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  const sub = await prisma.subscription.findUnique({ where: { userId: targetUser.id } })
  if (!sub) {
    return NextResponse.json({ success: true, email, plan: 'free', message: 'No subscription to revoke' })
  }

  await prisma.subscription.update({
    where: { userId: targetUser.id },
    data: { status: 'expired', updatedAt: new Date() },
  })

  return NextResponse.json({ success: true, email, plan: 'free' })
}
