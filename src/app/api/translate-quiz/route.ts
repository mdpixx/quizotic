export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { Question } from '@/lib/quiz-types'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[translate-quiz] OPENROUTER_API_KEY is not configured')
    return NextResponse.json({ error: 'AI translation is temporarily unavailable' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitRequest(req, {
    bucket: 'translate-quiz',
    userId: user.id,
    userLimit: 15,
    ipLimit: 20,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  // AI quota — proportional (count questions, not calls)
  const quota = await checkAiQuota(user.id, 'ai_translate', 1)
  if (!quota.allowed) {
    return NextResponse.json({
      error: `You've used all ${quota.limit} AI question credits this month (${quota.used}/${quota.limit}). Email info@quizotic.live if you need more — we review every request. Limit resets next month.`,
    }, { status: 429 })
  }

  try {
    const { questions, targetLanguage }: { questions: Question[]; targetLanguage: string } = await req.json()

    if (!questions?.length) return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    if (!targetLanguage) return NextResponse.json({ error: 'targetLanguage is required' }, { status: 400 })

    // Strip non-translatable fields — only send text content to the model
    const translatable = questions.map(q => ({
      text: q.text,
      options: q.options,
    }))

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a translation assistant. Return only valid JSON — no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `Translate these quiz questions to ${targetLanguage}. Return the identical JSON structure with all text values translated. Do not translate anything except text content.

${JSON.stringify(translatable)}`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    // Strip markdown code fences
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const translated: Array<{ text: string; options?: string[] }> = JSON.parse(stripped)

    // Re-merge translated text fields back into original questions (preserving all other fields)
    const merged: Question[] = questions.map((q, i) => ({
      ...q,
      text: translated[i]?.text ?? q.text,
      options: translated[i]?.options ?? q.options,
    }))

    await logAiUsage(user.id, 'ai_translate', { model: MODEL, questionCount: questions.length })

    return NextResponse.json(merged)
  } catch (err) {
    console.error('[translate-quiz]', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
