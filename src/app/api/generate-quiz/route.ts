export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import dns from 'dns/promises'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getReferralBonusCredits } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

const PRIVATE_IP_PATTERNS = [
  /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^0\./, /^169\.254\./,
  /^::1$/, /^fc00:/, /^fe80:/, /^fd/,
]

async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const { hostname } = new URL(urlStr)
    if (hostname === 'localhost' || hostname.endsWith('.internal') || hostname.endsWith('.local')) return false
    const addresses = await dns.resolve(hostname)
    return addresses.every(addr => !PRIVATE_IP_PATTERNS.some(p => p.test(addr)))
  } catch { return false }
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

const SYSTEM_PROMPT = `You are a quiz generator. Return only valid JSON — no markdown, no explanation, no code fences.`

interface TypeMix {
  mcq?: number
  truefalse?: number
  poll?: number
  openended?: number
}

function buildUserPrompt(text: string, questionCount: number, difficulty: string, typeMix?: TypeMix): string {
  // Build type breakdown instructions
  const mcq = typeMix?.mcq ?? questionCount
  const tf = typeMix?.truefalse ?? 0
  const poll = typeMix?.poll ?? 0
  const open = typeMix?.openended ?? 0

  let typeInstructions = ''
  const examples: string[] = []

  if (mcq > 0) {
    typeInstructions += `\n- ${mcq} MCQ questions: type "mcq", exactly 4 options, "correctAnswer" is a string index ("0","1","2","3")`
    examples.push(`{"type":"mcq","text":"Who discovered gravity?","options":["Einstein","Newton","Galileo","Kepler"],"correctAnswer":"1","timerSeconds":20,"points":1000}`)
  }
  if (tf > 0) {
    typeInstructions += `\n- ${tf} True/False questions: type "truefalse", options must be exactly ["True","False"], "correctAnswer" is "0" (True) or "1" (False)`
    examples.push(`{"type":"truefalse","text":"The Earth revolves around the Sun.","options":["True","False"],"correctAnswer":"0","timerSeconds":15,"points":1000}`)
  }
  if (poll > 0) {
    typeInstructions += `\n- ${poll} Poll questions: type "poll", exactly 4 opinion-based options, NO "correctAnswer" field`
    examples.push(`{"type":"poll","text":"Which subject do you enjoy most?","options":["Science","Mathematics","History","Literature"],"timerSeconds":20,"points":0}`)
  }
  if (open > 0) {
    typeInstructions += `\n- ${open} Open-ended questions: type "openended", NO "options" field, NO "correctAnswer" field`
    examples.push(`{"type":"openended","text":"Explain the significance of the French Revolution in your own words.","timerSeconds":60,"points":1000}`)
  }

  return `Generate exactly ${questionCount} ${difficulty} quiz questions based on the following content.

Return a JSON array with exactly ${questionCount} items in this breakdown:${typeInstructions}

Examples of each type:
${examples.map(e => e).join('\n')}

Rules:
- "timerSeconds" must be one of: 10, 15, 20, 30, 60
- "points" must be one of: 0, 500, 1000, 2000 (use 0 only for poll type)
- Each option must be a complete, meaningful answer — never blank, never a placeholder like "Option A"
- Never reference the source material in questions. Don't say "according to the passage", "based on the content", "extracted from", "as mentioned in", "from the text", etc. Write each question as a standalone knowledge question.
- Return nothing except the JSON array

Content:
${text}`
}

function buildSimplePrompt(text: string, questionCount: number, difficulty: string): string {
  return buildUserPrompt(text, questionCount, difficulty, { mcq: questionCount })
}

async function callModel(contentText: string, questionCount: number, difficulty: string, typeMix?: TypeMix): Promise<unknown[]> {
  const prompt = typeMix
    ? buildUserPrompt(contentText, questionCount, difficulty, typeMix)
    : buildSimplePrompt(contentText, questionCount, difficulty)

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  // Strip markdown code fences if model wraps response
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(stripped)
}

function validateQuestions(data: unknown): boolean {
  if (!Array.isArray(data)) return false
  return data.every((q: unknown) => {
    if (typeof q !== 'object' || q === null) return false
    const item = q as Record<string, unknown>
    const type = item.type as string

    // Common validations
    if (typeof item.text !== 'string' || item.text.trim().length === 0) return false
    if (typeof item.timerSeconds !== 'number') return false
    if (typeof item.points !== 'number') return false

    // Type-specific validations
    if (type === 'mcq') {
      return Array.isArray(item.options) && item.options.length >= 2 &&
        (item.options as unknown[]).every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) &&
        typeof item.correctAnswer === 'string'
    }
    if (type === 'truefalse') {
      return Array.isArray(item.options) && item.options.length === 2 &&
        typeof item.correctAnswer === 'string'
    }
    if (type === 'poll') {
      return Array.isArray(item.options) && item.options.length >= 2 &&
        (item.options as unknown[]).every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0)
    }
    if (type === 'openended') {
      return true // text + timer + points is enough
    }

    // Fallback: accept MCQ-shaped (backwards compat)
    return Array.isArray(item.options) && item.options.length >= 2 &&
      typeof item.correctAnswer === 'string'
  })
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[generate-quiz] OPENROUTER_API_KEY is not configured')
    return NextResponse.json({ error: 'AI generation is temporarily unavailable' }, { status: 503 })
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
      error: `You've used all ${limit} AI question credits this month (${questionsUsed}/${limit}). ${plan === 'free' ? 'Upgrade to Pro for 750 AI questions per month.' : 'Limit resets next month.'}`,
    }, { status: 429 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  let questionCount = 5
  let difficulty = 'medium'
  let contentText = ''
  let typeMix: TypeMix | undefined
  let mode = 'document'
  let topicOrUrl: string | null = null
  const maxQ = PLAN_LIMITS[plan].maxQuestionsPerGeneration

  try {
    // ── Document mode ──────────────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      questionCount = Number(formData.get('questionCount') ?? 5)
      difficulty = (formData.get('difficulty') as string) ?? 'medium'
      const typeMixStr = formData.get('typeMix') as string | null
      if (typeMixStr) {
        try { typeMix = JSON.parse(typeMixStr) } catch { /* use default */ }
      }

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.pdf')) {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        const result = await parser.getText()
        contentText = result.text.slice(0, 3000)
      } else if (fileName.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        contentText = result.value.slice(0, 3000)
      } else {
        return NextResponse.json({ error: 'Only .pdf and .docx files are supported' }, { status: 400 })
      }
    }
    // ── JSON modes (topic / url) ───────────────────────────────────────────────
    else {
      const body = await req.json()
      mode = body.mode ?? 'topic'
      questionCount = body.questionCount ?? 5
      difficulty = body.difficulty ?? 'medium'
      typeMix = body.typeMix as TypeMix | undefined

      if (mode === 'topic') {
        if (!body.topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        contentText = `Topic: ${body.topic}`
        topicOrUrl = body.topic?.slice(0, 100) || null
      } else if (mode === 'url') {
        const url: string = body.url ?? ''
        topicOrUrl = url.slice(0, 200)
        if (!url.startsWith('https://')) {
          return NextResponse.json({ error: 'Only https:// URLs are supported' }, { status: 400 })
        }
        if (!await isSafeUrl(url)) {
          return NextResponse.json({ error: 'This URL cannot be accessed' }, { status: 400 })
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        let html: string
        try {
          const res = await fetch(url, { signal: controller.signal })
          html = await res.text()
        } catch {
          return NextResponse.json({ error: 'Could not fetch URL — try another' }, { status: 400 })
        } finally {
          clearTimeout(timeout)
        }
        // Strip HTML tags, collapse whitespace, truncate
        contentText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
      } else {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }
    }

    // Clamp questionCount to plan limits
    questionCount = Math.min(Math.max(questionCount, 3), maxQ)

    // ── Call model, validate, retry once on bad JSON ───────────────────────────
    let questions: unknown[]
    try {
      questions = await callModel(contentText, questionCount, difficulty, typeMix)
    } catch (err) {
      console.error('[generate-quiz] first attempt failed:', err instanceof Error ? err.message : err)
      // Retry once
      try {
        questions = await callModel(contentText, questionCount, difficulty, typeMix)
      } catch (retryErr) {
        console.error('[generate-quiz] retry failed:', retryErr instanceof Error ? retryErr.message : retryErr)
        return NextResponse.json({ error: 'Generation failed — please try again' }, { status: 500 })
      }
    }

    if (!validateQuestions(questions)) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'ai_generate',
        metadata: {
          model: MODEL,
          questionCount,
          difficulty,
          mode,
          typeMix: typeMix ? { ...typeMix } : null,
          topic: topicOrUrl,
        },
      },
    }).catch(err => console.error('[usage-log] failed to record:', err.message))

    return NextResponse.json(questions)
  } catch (err) {
    console.error('[generate-quiz]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
