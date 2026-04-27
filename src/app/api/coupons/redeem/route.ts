export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-helpers'
import { redeemCoupon } from '@/lib/coupons'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

const RedeemSchema = z.object({
  code: z.string().min(3).max(40),
})

// POST /api/coupons/redeem — user-facing redeem flow.
// Rate-limited to prevent code-guessing attacks.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 5 attempts per minute per user is enough for a real user typing a code,
  // but stops a script enumerating codes.
  const rl = await rateLimitRequest(req, {
    bucket: 'coupon-redeem',
    userId: user.id,
    userLimit: 5,
    ipLimit: 20,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  let parsed: z.infer<typeof RedeemSchema>
  try {
    parsed = RedeemSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const result = await redeemCoupon({ code: parsed.code, userId: user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.message, reason: result.reason }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    coupon: result.coupon,
    appliedTo: result.appliedTo,
  })
}
