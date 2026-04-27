export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getBonusCredits, type AiBucket } from '@/lib/billing'
import { writeAuditLog } from '@/lib/admin-audit'
import { sendEmail } from '@/lib/email'
import { buildCreditGrantEmail } from '@/lib/emails/credit-grant'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

// POST /api/admin/credits/grant
// Issues a manual AI credit adjustment to a user. Required reason +
// audit row + best-effort email notification. Negative amounts are
// allowed for revoking previously-granted credits.
const GrantSchema = z.object({
  email: z.string().email().max(120),
  bucket: z.enum(['questions', 'enhancements']),
  amount: z.number().int().refine(n => n !== 0, 'amount must be non-zero'),
  reason: z.string().min(5).max(500),
  expiresAt: z.string().datetime().nullish(),
  ticketId: z.string().max(120).optional(),
})

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let parsed: z.infer<typeof GrantSchema>
  try {
    const body = await req.json()
    parsed = GrantSchema.parse(body)
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      : 'Invalid JSON'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { email, bucket, amount, reason } = parsed
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null

  const targetUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true },
  })
  if (!targetUser) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  // Snapshot pre-grant bonus for the audit row.
  const beforeBonus = await getBonusCredits(targetUser.id, bucket as AiBucket)

  const grant = await prisma.creditGrant.create({
    data: {
      userId: targetUser.id,
      bucket,
      amount,
      reason,
      expiresAt,
      grantedBy: admin.id,
      metadata: parsed.ticketId
        ? ({ ticketId: parsed.ticketId } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  })

  const afterBonus = await getBonusCredits(targetUser.id, bucket as AiBucket)

  // Best-effort email — don't block the response on delivery
  let emailSent = false
  if (targetUser.email) {
    const tpl = buildCreditGrantEmail({
      firstName: targetUser.name,
      amount,
      bucket: bucket as AiBucket,
      reason,
      expiresAt,
    })
    const result = await sendEmail({
      to: targetUser.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: 'category', value: 'credit_grant' },
        { name: 'bucket', value: bucket },
      ],
    })
    emailSent = result.ok
  }

  // Best-effort audit log
  await writeAuditLog({
    req,
    actor: { id: admin.id, email: admin.email ?? '' },
    action: 'credit_grant',
    targetType: 'user',
    targetId: targetUser.id,
    payload: { email, bucket, amount, reason, expiresAt: expiresAt?.toISOString() ?? null, ticketId: parsed.ticketId ?? null },
    beforeState: { bonusCredits: beforeBonus },
    afterState: { bonusCredits: afterBonus, grantId: grant.id, emailSent },
    reason,
  })

  return NextResponse.json({
    success: true,
    grantId: grant.id,
    newBonusCredits: afterBonus,
    emailSent,
    user: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
  })
}
