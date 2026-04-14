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

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.5-pro'
const ANALYZER_MODEL = process.env.QUIZ_AI_ANALYZER_MODEL ?? 'google/gemini-2.0-flash-001'

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

interface DeckAnalysis {
  topic: string
  audience: string
  contentType: string
  keyTopics: string[]
  narrativeArc: string
}

// ─── Pass 1: Deck Understanding ─────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a presentation analyst. Given a list of slide titles and content summaries, output a brief JSON analysis of the deck.

Output ONLY this JSON (no markdown, no explanation):
{
  "topic": "main topic of the presentation",
  "audience": "likely target audience",
  "contentType": "factual | procedural | conceptual | persuasive | mixed",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "narrativeArc": "brief description of how the deck flows, e.g. intro -> concepts -> examples -> conclusion"
}`

function buildAnalysisPrompt(slides: SlideInput[]): string {
  const summary = slides.map(s => {
    const text = s.textContent.slice(0, 200)
    return `[Slide ${s.index}] ${text}`
  }).join('\n')

  return `Analyze this ${slides.length}-slide presentation:\n\n${summary}`
}

async function analyzeDeck(slides: SlideInput[]): Promise<DeckAnalysis> {
  const response = await client.chat.completions.create({
    model: ANALYZER_MODEL,
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: buildAnalysisPrompt(slides) },
    ],
    temperature: 0.3,
    max_tokens: 500,
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  try {
    return JSON.parse(cleaned) as DeckAnalysis
  } catch {
    return {
      topic: 'Unknown',
      audience: 'general',
      contentType: 'mixed',
      keyTopics: [],
      narrativeArc: 'linear',
    }
  }
}

// ─── Pass 2: Suggestion Generation ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert interactive presentation designer for Quizotic, a live quiz and presentation platform used in Indian classrooms and corporate training.

Your job: suggest interactive slides to INSERT between content slides to maximize audience engagement and learning retention.

## Available Interactive Types

1. multiple_choice — { "question": "...", "options": ["A","B","C","D"], "showCorrect": true, "correctIndex": 0 }
   Best for: factual recall, testing comprehension of just-taught concepts (Bloom's: Remember, Understand)

2. open_text — { "question": "...", "maxChars": 200 }
   Best for: reflection, application, personal experience sharing (Bloom's: Apply, Evaluate)

3. word_cloud — { "question": "...", "maxWords": 1 }
   Best for: brainstorming, gauging prior knowledge before a topic, association checks

4. rating_scale — { "question": "...", "minLabel": "Not at all", "maxLabel": "Extremely", "maxRating": 5 }
   Best for: self-assessment, confidence checks, opinion gauging

5. ranking — { "question": "...", "items": ["Item1", "Item2", "Item3"] }
   Best for: prioritization exercises, ordering concepts, comparing importance (Bloom's: Analyze, Evaluate)

6. word_duel — { "question": "...", "optionA": "...", "optionB": "..." }
   Best for: binary comparisons, debate starters, forcing a stance

7. emoji_pulse — { "question": "...", "emojis": ["👍","👎","🤔","🔥"] }
   Best for: quick energy/mood checks, reactions to a statement, temperature reads

8. quick_fire — { "question": "...", "options": ["A","B","C","D"], "durationSeconds": 10 }
   Best for: competitive recall under time pressure, energizer moments (Bloom's: Remember)

## Pedagogical Rules

### Match interactivity to cognitive level (Bloom's Taxonomy):
- REMEMBER (recall facts) → multiple_choice, quick_fire
- UNDERSTAND (explain concepts) → word_cloud, rating_scale
- APPLY (use in new situations) → open_text
- ANALYZE (compare, differentiate) → ranking, word_duel
- EVALUATE (judge, critique) → rating_scale, open_text

### Spacing and flow:
- Do NOT suggest interactivity after every slide — respect the presenter's natural flow
- Space interactive slides at least 2-3 content slides apart
- Place word_cloud or emoji_pulse BEFORE a new topic section (gauge prior knowledge)
- Place multiple_choice or quick_fire AFTER a section with specific facts
- Never interrupt a logical sequence of related content slides

### Content quality:
- Questions MUST reference specific concepts, terms, or examples from the slide content
- Options in multiple_choice must be plausible — avoid obviously wrong answers
- Keep questions concise (under 120 characters)
- For multiple_choice: exactly 4 options, correctIndex 0-indexed

### BAD vs GOOD examples:
- BAD: "What do you think about this topic?" (generic, could apply to any presentation)
- GOOD: "Which fire extinguisher type is correct for an electrical fire?" (specific to content)
- BAD: "Rate your understanding" after every slide (repetitive, annoying)
- GOOD: "Rate your confidence in identifying fire types" after the fire classification section
- BAD: word_cloud asking "What comes to mind?" with no context
- GOOD: word_cloud asking "What's your biggest workplace fire safety concern?" before the solutions section

## Grounding requirements (STRICT)
- Every question MUST quote or paraphrase at least one specific term, number, named entity, or concept that appears verbatim in the referenced slide's content. If you cannot, do not suggest that slide.
- For multiple_choice, distractors must be plausible alternatives drawn from the domain implied by the slide (not obviously wrong fillers like "None of the above", "All of the above", or unrelated terms).
- Reject any suggestion whose question would make equal sense on an unrelated deck. When in doubt, drop that suggestion rather than produce a generic one.
- The "rationale" field must name the specific slide phrase that anchored the question.

Return ONLY valid JSON — no markdown fences, no explanation, no preamble.`

function getSlidePosition(index: number, total: number): string {
  const pct = index / total
  if (pct < 0.15) return 'opening'
  if (pct < 0.4) return 'early'
  if (pct < 0.7) return 'middle'
  if (pct < 0.9) return 'late'
  return 'closing'
}

function buildUserPrompt(
  slides: SlideInput[],
  targetCount: number,
  analysis: DeckAnalysis,
): string {
  const deckContext = `## Deck Analysis
Topic: ${analysis.topic}
Audience: ${analysis.audience}
Content type: ${analysis.contentType}
Key topics: ${analysis.keyTopics.join(', ')}
Narrative arc: ${analysis.narrativeArc}
Total slides: ${slides.length}
`

  const slideList = slides.map((s, i) => {
    const position = getSlidePosition(s.index, slides.length)
    const prevTitle = i > 0 ? slides[i - 1].textContent.split('\n')[0].slice(0, 60) : '(start)'
    const nextTitle = i < slides.length - 1 ? slides[i + 1].textContent.split('\n')[0].slice(0, 60) : '(end)'

    return `[Slide ${s.index} of ${slides.length}] (${s.type} slide, position: ${position})
Content: ${s.textContent.slice(0, 2500)}
Previous: "${prevTitle}"
Next: "${nextTitle}"`
  }).join('\n\n')

  return `${deckContext}

## Slides
${slideList}

## Task
Suggest exactly ${targetCount} interactive slides. For each:
- "afterSlideIndex": the slide index to insert AFTER
- "type": one of the 8 interactive types
- "slideData": complete data object with all required fields
- "rationale": one sentence explaining WHY this interactivity fits at this point

Space them evenly. Match the type to the content's cognitive level. Reference specific content from the slides.

Return a JSON array:
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
    // Pass 1: Analyze the deck for topic, audience, and narrative
    const analysis = await analyzeDeck(contentSlides)

    // Pass 2: Generate suggestions with full context
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(contentSlides, targetCount, analysis) },
      ],
      temperature: 0.5,
      max_tokens: 4000,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Retry once with lower temperature
      const retry = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(contentSlides, targetCount, analysis) },
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
