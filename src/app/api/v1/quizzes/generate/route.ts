export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'
import { PLAN_LIMITS } from '@/lib/limits'
import { getUserPlan } from '@/lib/billing'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { apiError, normalizeQuestions, unauthorizedApiKey } from '@/lib/public-api'
import { hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'

type GenerateMode = 'topic' | 'text' | 'url'
type TypeMix = Record<string, number>

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'
const MIN_TEXT_CHARS = 80
const MAX_TEXT_CHARS = 12_000

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

function buildPrompt(input: {
  mode: GenerateMode
  source: string
  questionCount: number
  difficulty: string
  typeMix?: TypeMix
}) {
  const mix = input.typeMix && Object.keys(input.typeMix).length > 0
    ? `Use this exact type mix when possible: ${JSON.stringify(input.typeMix)}.`
    : 'Use mostly MCQ questions unless the source suggests another useful interactive format.'
  return `Generate exactly ${input.questionCount} ${input.difficulty} Quizotic questions from this ${input.mode}.

${mix}

Return only a JSON array. Each item must include:
- type: mcq, multiselect, truefalse, poll, openended, wordcloud, qa, rating, ranking, or case
- text
- timerSeconds: 10, 15, 20, 30, or 60
- points: 500, 1000, or 2000 for scored questions; 500 for unscored interactive questions
- options and correctAnswer/correctAnswers when required
- explanation when helpful

Source:
${input.source}`
}

function safeErrorMessage(status: number | null): { status: number; code: string; message: string } {
  if (status === 429) return { status: 429, code: 'ai_rate_limited', message: 'AI service is busy. Please try again in a minute.' }
  if (status === 504 || status === 408) return { status: 504, code: 'ai_timeout', message: 'The AI took too long. Try fewer questions or shorter source text.' }
  if (status && status >= 500) return { status: 502, code: 'ai_provider_error', message: 'The AI provider had a temporary error.' }
  return { status: 500, code: 'ai_generation_failed', message: 'Generation failed. Please try again.' }
}

function inferStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { status?: number; statusCode?: number; message?: string }
  if (typeof e.status === 'number') return e.status
  if (typeof e.statusCode === 'number') return e.statusCode
  const match = e.message?.match(/\b(4\d{2}|5\d{2})\b/)
  return match ? Number(match[1]) : null
}

async function fetchUrlSource(rawUrl: string): Promise<string | NextResponse> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return apiError('invalid_url', 'url must be a valid https URL', 400)
  }
  if (url.protocol !== 'https:') return apiError('invalid_url', 'Only https URLs are supported', 400)
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) || url.hostname.endsWith('.local')) {
    return apiError('unsafe_url', 'This URL cannot be accessed', 400)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return apiError('url_fetch_failed', `Could not fetch URL (${res.status})`, 400)
    const html = await res.text()
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS)
  } catch {
    return apiError('url_fetch_failed', 'Could not fetch URL', 400)
  } finally {
    clearTimeout(timeout)
  }
}

// POST /api/v1/quizzes/generate — API-key AI generation for agents.
export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return apiError('ai_unavailable', 'AI generation is temporarily unavailable', 503)
  }

  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-generate-quiz',
    userId: user.id,
    userLimit: 20,
    ipLimit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return apiError('invalid_json', 'Request body must be valid JSON', 400)

  const mode: GenerateMode = body.mode === 'text' || body.mode === 'url' ? body.mode : 'topic'
  const difficulty = typeof body.difficulty === 'string' ? body.difficulty : 'medium'
  const plan = await getUserPlan(user.id)
  const maxQ = PLAN_LIMITS[plan].maxQuestionsPerGeneration
  const requested = Number(body.questionCount ?? 5)
  const questionCount = Math.min(maxQ, Math.max(3, Number.isFinite(requested) ? Math.floor(requested) : 5))
  const typeMix = body.typeMix && typeof body.typeMix === 'object' ? body.typeMix as TypeMix : undefined

  let source = ''
  if (mode === 'topic') {
    source = typeof body.topic === 'string' ? `Topic: ${body.topic.trim()}` : ''
    if (!source || source === 'Topic:') return apiError('validation_error', 'topic is required for topic mode', 400)
  } else if (mode === 'text') {
    source = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT_CHARS) : ''
    if (source.length < MIN_TEXT_CHARS) return apiError('content_too_short', 'text must be at least 80 characters', 422)
  } else {
    const fetched = await fetchUrlSource(typeof body.url === 'string' ? body.url : '')
    if (fetched instanceof NextResponse) return fetched
    source = fetched
    if (source.length < MIN_TEXT_CHARS) return apiError('content_too_short', 'URL did not contain enough usable text', 422)
  }

  const quota = await checkAiQuota(user.id, 'ai_generate', questionCount)
  if (!quota.allowed) {
    return apiError('quota_exhausted', `You've used all ${quota.limit} AI question credits this month (${quota.used}/${quota.limit}).`, 429, {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
    })
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are Quizotic quiz generator. Return valid JSON only.' },
        { role: 'user', content: buildPrompt({ mode, source, questionCount, difficulty, typeMix }) },
      ],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim())
    const questions = normalizeQuestions(parsed)
    const issues = validateQuizQuestions(questions)
    if (questions.length === 0 || hasQuizValidationErrors(issues)) {
      return apiError('ai_invalid_questions', 'AI returned questions that need review. Try again with a clearer source.', 502, issues)
    }

    await logAiUsage(user.id, 'ai_generate', {
      model: MODEL,
      questionCount,
      difficulty,
      mode,
      typeMix: typeMix ?? null,
      sourceChars: source.length,
      api: 'v1',
    })

    return NextResponse.json({
      data: {
        questions,
        meta: { mode, questionCount: questions.length, difficulty, sourceChars: source.length },
      },
    })
  } catch (err) {
    const mapped = safeErrorMessage(inferStatus(err))
    return apiError(mapped.code, mapped.message, mapped.status)
  }
}
