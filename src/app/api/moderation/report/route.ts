export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

// POST /api/moderation/report
// Anyone can file a report. Reporter is anonymous if not signed in.
// Rate-limited to stop abuse (you can't spam-report a competitor).
const ReportSchema = z.object({
  targetType: z.enum(['quiz', 'session', 'answer', 'user']),
  targetId: z.string().min(1).max(60),
  category: z.enum(['spam', 'hate', 'sexual', 'copyright', 'other']),
  details: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  // 5 reports per minute per IP / per user. Reasonable rate even for a
  // genuine moderator user clicking through a bad session.
  const rl = await rateLimitRequest(req, {
    bucket: 'moderation-report',
    userId: user?.id,
    userLimit: 10,
    ipLimit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  let parsed: z.infer<typeof ReportSchema>
  try {
    parsed = ReportSchema.parse(await req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError
      ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      : 'Invalid payload'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const flag = await prisma.moderationFlag.create({
    data: {
      reporterId: user?.id ?? null,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      category: parsed.category,
      details: parsed.details ?? null,
      status: 'open',
      metadata: Prisma.JsonNull,
    },
  })

  return NextResponse.json({ success: true, flagId: flag.id })
}
