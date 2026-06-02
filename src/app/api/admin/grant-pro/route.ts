export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { writeAuditLog } from '@/lib/admin-audit'

// POST — Grant Pro to a user
export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdmin()
  if (response) return response

  const { email, months = 12, reason = 'manual Pro grant' }: { email?: string; months?: number; reason?: string } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return NextResponse.json({ error: 'months must be an integer from 1 to 36' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!targetUser) {
    const normalizedEmail = email.trim().toLowerCase()
    await prisma.pendingProGrant.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, months },
      update: { months, appliedAt: null },
    })
    await writeAuditLog({
      req,
      actor: { id: admin.id, email: admin.email ?? '' },
      action: 'pending_pro_grant',
      targetType: 'pending_pro_grant',
      targetId: normalizedEmail,
      payload: { email: normalizedEmail, months },
      afterState: { email: normalizedEmail, months, appliedAt: null },
      reason,
    })
    return NextResponse.json({ success: true, email: normalizedEmail, plan: 'pro_pending', months })
  }

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + months)
  const before = await prisma.subscription.findUnique({ where: { userId: targetUser.id } })

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

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'plan_grant',
    targetType: 'user',
    targetId: targetUser.id,
    payload: { email, months },
    beforeState: before ? { plan: before.plan, status: before.status, currentPeriodEnd: before.currentPeriodEnd } : undefined,
    afterState: { plan: 'pro_monthly', status: 'active', currentPeriodEnd: expiresAt },
    reason,
  })

  return NextResponse.json({ success: true, email, plan: 'pro', expiresAt: expiresAt.toISOString() })
}

// DELETE — Revoke Pro from a user
export async function DELETE(req: NextRequest) {
  const { admin, response } = await requireAdmin()
  if (response) return response

  const { email, reason = 'manual Pro revoke' }: { email?: string; reason?: string } = await req.json()
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

  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'plan_revoke',
    targetType: 'user',
    targetId: targetUser.id,
    payload: { email },
    beforeState: { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
    afterState: { plan: sub.plan, status: 'expired' },
    reason,
  })

  return NextResponse.json({ success: true, email, plan: 'free' })
}
