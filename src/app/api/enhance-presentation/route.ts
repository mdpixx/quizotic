export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlideInput {
  index: number
  type: string
  textContent: string
}

interface AiSuggestion {
  afterSlideIndex: number
  type: string
  slideData: Record<string, unknown>
  rationale: string
}

// ─── AI Prompt ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an interactive presentation designer for Quizotic, a live quiz and presentation platform used in classrooms and corporate training sessions.

Given a list of content slides from a presentation, suggest interactive slides to INSERT AFTER specific content slides to increase audience engagement and learning retention.

Available interactive slide types and the JSON fields each one needs:

1. multiple_choice — { "question": "...", "options": ["A","B","C","D"], "showCorrect": true, "correctIndex": 0 }
   Use for: factual recall, testing understanding of concepts just taught
2. open_text — { "question": "...", "maxChars": 200 }
   Use for: reflection, personal opinions, open-ended responses
3. word_cloud — { "question": "...", "maxWords": 1 }
   Use for: brainstorming, gauging associations, ice-breakers before a topic
4. rating_scale — { "question": "...", "minLabel": "Not at all", "maxLabel": "Extremely", "maxRating": 5 }
   Use for: opinion gauging, self-assessment, confidence checks
5. ranking — { "question": "...", "items": ["Item1", "Item2", "Item3"] }
   Use for: prioritization, ordering concepts, preference ranking
6. word_duel — { "question": "...", "optionA": "...", "optionB": "..." }
   Use for: binary comparisons, debate starters, "which is more important"
7. emoji_pulse — { "question": "...", "emojis": ["👍","👎","🤔","🔥"] }
   Use for: quick mood checks, reactions, energy reads
8. quick_fire — { "question": "...", "options": ["A","B","C","D"], "durationSeconds": 10 }
   Use for: speed recall, competition moments, energizers

Rules:
- Each suggestion MUST relate directly to the content of the slide it follows
- Vary the interactive types — do NOT use the same type twice in a row
- For factual/technical content → prefer multiple_choice or quick_fire
- For opinion/discussion content → prefer word_cloud, rating_scale, open_text, emoji_pulse
- For comparison/prioritization content → prefer word_duel or ranking
- Generate pedagogically sound questions — not trivial, not trick questions
- Keep questions concise (under 120 characters)
- For multiple_choice: always provide exactly 4 plausible options, set correctIndex to the correct one (0-indexed)
- Return ONLY valid JSON — no markdown fences, no explanation, no preamble`

function buildUserPrompt(slides: SlideInput[], targetCount: number): string {
  const slideList = slides.map(s =>
    `[Slide ${s.index}] ${s.textContent.slice(0, 500)}`
  ).join('\n\n')

  return `Here are ${slides.length} content slides from a training presentation. Suggest exactly ${targetCount} interactive slides to add.

For each suggestion, specify:
- "afterSlideIndex": the slide index this interactive should be inserted AFTER
- "type": one of the 8 interactive types listed
- "slideData": the complete data object for that type (see fields above)
- "rationale": one sentence explaining why this interactivity fits here (for the trainer to understand)

Spread the interactivities evenly across the presentation — don't cluster them all at the beginning or end.

SLIDES:
${slideList}

Return a JSON array of suggestions:
[
  { "afterSlideIndex": 2, "type": "word_cloud", "slideData": { "question": "...", "maxWords": 1 }, "rationale": "..." },
  ...
]`
}

// ─── Level → target count ────────────────────────────────────────────────────

function getTargetCount(totalContent: number, level: string): number {
  switch (level) {
    case 'light':    return Math.max(1, Math.round(totalContent * 0.12))
    case 'moderate': return Math.max(1, Math.round(totalContent * 0.25))
    case 'heavy':    return Math.max(2, Math.round(totalContent * 0.4))
    case 'custom':   return Math.max(1, Math.min(totalContent, Math.round(totalContent * 0.5)))
    default:         return Math.max(1, Math.round(totalContent * 0.25))
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_TYPES = ['multiple_choice', 'open_text', 'word_cloud', 'rating_scale', 'ranking', 'word_duel', 'emoji_pulse', 'quick_fire']

function validateSuggestions(suggestions: unknown[]): AiSuggestion[] {
  const valid: AiSuggestion[] = []
  for (const s of suggestions) {
    if (!s || typeof s !== 'object') continue
    const sug = s as Record<string, unknown>
    if (typeof sug.afterSlideIndex !== 'number') continue
    if (typeof sug.type !== 'string' || !VALID_TYPES.includes(sug.type)) continue
    if (!sug.slideData || typeof sug.slideData !== 'object') continue
    const data = sug.slideData as Record<string, unknown>
    if (typeof data.question !== 'string' || !data.question.trim()) continue
    valid.push({
      afterSlideIndex: sug.afterSlideIndex,
      type: sug.type,
      slideData: data,
      rationale: typeof sug.rationale === 'string' ? sug.rationale : '',
    })
  }
  return valid
}

// ─── API handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit check
  const plan = await getUserPlan(user.id)
  const limit = PLAN_LIMITS[plan].maxAiEnhancements
  if (limit !== undefined && limit !== Infinity) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const usageCount = await prisma.usageLog.count({
      where: {
        userId: user.id,
        action: 'ai_enhance',
        createdAt: { gte: startOfMonth },
      },
    })

    if (usageCount >= limit) {
      return NextResponse.json(
        { success: false, error: `AI enhancement limit reached (${limit}/month). Upgrade to Pro for more.`, usage: { used: usageCount, limit } },
        { status: 429 }
      )
    }
  }

  // Parse request
  const body = await req.json() as { slides?: SlideInput[]; level?: string }
  const { slides, level = 'moderate' } = body

  if (!slides || !Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json({ success: false, error: 'No slides provided' }, { status: 400 })
  }

  // Filter to content slides with actual text
  const contentSlides = slides.filter(s =>
    ['title', 'bullets', 'image'].includes(s.type) && s.textContent.trim().length > 10
  )

  if (contentSlides.length === 0) {
    return NextResponse.json({ success: false, error: 'No text-heavy content slides found to enhance.' }, { status: 400 })
  }

  const targetCount = getTargetCount(contentSlides.length, level)

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(contentSlides, targetCount) },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Retry once
      const retry = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(contentSlides, targetCount) },
          { role: 'assistant', content: raw },
          { role: 'user', content: 'That was not valid JSON. Please return ONLY a valid JSON array, nothing else.' },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      })
      const retryRaw = retry.choices[0]?.message?.content?.trim() ?? ''
      const retryCleaned = retryRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(retryCleaned)
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ success: false, error: 'AI returned unexpected format. Please try again.' }, { status: 500 })
    }

    const suggestions = validateSuggestions(parsed)

    if (suggestions.length === 0) {
      return NextResponse.json({ success: false, error: 'AI could not generate valid suggestions. Please try again.' }, { status: 500 })
    }

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'ai_enhance',
        metadata: { slideCount: suggestions.length, level },
      },
    })

    // Get updated usage count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const totalUsed = await prisma.usageLog.count({
      where: { userId: user.id, action: 'ai_enhance', createdAt: { gte: startOfMonth } },
    })

    return NextResponse.json({
      success: true,
      suggestions,
      usage: { used: totalUsed, limit: PLAN_LIMITS[plan].maxAiEnhancements ?? Infinity },
    })
  } catch (err) {
    console.error('AI enhance error:', err)
    return NextResponse.json(
      { success: false, error: 'AI service error. Please try again in a moment.' },
      { status: 500 }
    )
  }
}
