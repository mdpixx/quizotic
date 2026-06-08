export const dynamic = 'force-dynamic'

/**
 * POST /api/generate-question
 *
 * Inline AI: write or improve a single question on the canvas.
 * Wired to the ✨ sparkle button in QuestionCanvas.
 *
 * Body: { type: QuestionType, context?: string }
 *   - type: the question type to generate
 *   - context: optional existing question text to improve, or a topic hint
 *
 * Response: a single Question-shaped object (without id — client mints it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'
import { callModel, buildSingleQuestionPrompt } from '@/lib/ai-quiz'
import type { QuestionType } from '@/lib/quiz-types'

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'AI generation is temporarily unavailable' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimitRequest(req, {
    bucket: 'generate-question',
    userId: user.id,
    userLimit: 30,
    ipLimit: 50,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const quota = await checkAiQuota(user.id, 'ai_generate', 1)
  if (!quota.allowed) {
    return NextResponse.json({
      error: `AI credit limit reached (${quota.used}/${quota.limit} this month).`,
    }, { status: 429 })
  }

  let body: { type?: string; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const type = (body.type ?? 'mcq') as QuestionType
  const context = typeof body.context === 'string' ? body.context.slice(0, 500) : undefined

  try {
    const prompt = buildSingleQuestionPrompt(type, context)
    const result = await callModel(prompt)

    // Validate minimal shape
    if (typeof result !== 'object' || result === null || !('text' in result)) {
      return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 502 })
    }

    await logAiUsage(user.id, 'ai_generate', { questionCount: 1, plan: quota.plan })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[generate-question] AI error:', err)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 502 })
  }
}
