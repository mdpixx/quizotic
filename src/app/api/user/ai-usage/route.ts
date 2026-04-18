export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getAiUsageSummary } from '@/lib/ai-quota'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const summary = await getAiUsageSummary(user.id)

  // Legacy top-level fields map to the questions bucket so existing callers keep working.
  return NextResponse.json({
    plan: summary.plan,
    used: summary.questions.used,
    limit: summary.questions.limit,
    bonusCredits: summary.questions.bonusCredits,
    questions: summary.questions,
    enhancements: summary.enhancements,
  })
}
