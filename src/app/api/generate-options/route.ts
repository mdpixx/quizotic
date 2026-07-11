export const dynamic = 'force-dynamic'

/**
 * POST /api/generate-options
 *
 * Inline AI: generate answer options for an existing question.
 * Wired to the "✨ Add options with AI" button in QuestionCanvas.
 *
 * Body: { questionText: string, type: QuestionType }
 *
 * Response: { options: string[], correctAnswer?: string, correctAnswers?: string[] }
 *   — the client merges this partial into the active question.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'
import { callModel, buildOptionsPrompt } from '@/lib/ai-quiz'
import type { QuestionType } from '@/lib/quiz-types'

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'AI generation is temporarily unavailable' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimitRequest(req, {
    bucket: 'generate-options',
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

  let body: { questionText?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const questionText = typeof body.questionText === 'string' ? body.questionText.slice(0, 500) : ''
  const type = (body.type ?? 'mcq') as QuestionType

  if (!questionText.trim()) {
    return NextResponse.json({ error: 'questionText is required' }, { status: 400 })
  }

  try {
    const prompt = buildOptionsPrompt(questionText, type)
    const result = await callModel(prompt)

    if (typeof result !== 'object' || result === null || !('options' in result)) {
      return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 502 })
    }

    // Sanitize before the client merges this straight into the question:
    // cap at the builder's 6-option limit, drop non-strings/blanks, and only
    // pass correct-answer indices that point at a surviving option.
    const raw = result as { options?: unknown; correctAnswer?: unknown; correctAnswers?: unknown }
    const options = (Array.isArray(raw.options) ? raw.options : [])
      .filter((o): o is string => typeof o === 'string')
      .map(o => o.trim().slice(0, 150))
      .filter(o => o !== '')
      .slice(0, 6)
    if (options.length < 2) {
      return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 502 })
    }
    const isIndex = (v: unknown) => {
      const n = Number(v)
      return Number.isInteger(n) && n >= 0 && n < options.length
    }
    const payload: { options: string[]; correctAnswer?: string; correctAnswers?: string[] } = { options }
    if (isIndex(raw.correctAnswer)) payload.correctAnswer = String(Number(raw.correctAnswer))
    if (Array.isArray(raw.correctAnswers)) {
      const cas = [...new Set(raw.correctAnswers.filter(isIndex).map(v => String(Number(v))))].sort()
      if (cas.length > 0) payload.correctAnswers = cas
    }

    await logAiUsage(user.id, 'ai_generate', { questionCount: 1, plan: quota.plan })

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[generate-options] AI error:', err)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 502 })
  }
}
