export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { Question } from '@/lib/quiz-types'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getReferralBonusCredits } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

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

  // AI rate limiting — proportional (count questions, not calls)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [plan, usageLogs] = await Promise.all([
    getUserPlan(user.id),
    prisma.usageLog.findMany({
      where: { userId: user.id, action: { in: ['ai_generate', 'ai_translate'] }, createdAt: { gte: startOfMonth } },
      select: { metadata: true },
    }),
  ])

  const questionsUsed = usageLogs.reduce((sum, log) => {
    const meta = log.metadata as Record<string, unknown> | null
    return sum + (typeof meta?.questionCount === 'number' ? meta.questionCount : 5)
  }, 0)

  const bonusCredits = await getReferralBonusCredits(user.id)
  const limit = PLAN_LIMITS[plan].maxAiQuestions + bonusCredits
  if (questionsUsed >= limit) {
    return NextResponse.json({
      error: `You've used all ${limit} AI question credits this month (${questionsUsed}/${limit}). Email info@quizotic.live if you need more — we review every request. Limit resets next month.`,
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

    // Log usage
    await prisma.usageLog.create({
      data: { userId: user.id, action: 'ai_translate', metadata: { model: MODEL, questionCount: questions.length } },
    }).catch(err => console.error('[usage-log] failed to record:', err.message))

    return NextResponse.json(merged)
  } catch (err) {
    console.error('[translate-quiz]', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
