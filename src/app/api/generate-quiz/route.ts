export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import dns from 'dns/promises'
import { getCurrentUser } from '@/lib/auth-helpers'
import { PLAN_LIMITS } from '@/lib/limits'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'
import { extractPdfText } from '@/lib/pdf-extract.mjs'

// Maximum characters of source content to send to the AI. The previous
// limit was 3000 (too aggressive — chopped off 95% of typical training
// decks, forcing the AI to invent fill content). I bumped it to 50k which
// turned out to be too generous: Gemini 2.0 Flash via OpenRouter started
// 504-timing-out and 429-rate-limiting on document mode while topic mode
// stayed fine, because each request was 16× heavier. 12k is a safer
// middle ground — still 4× the original limit so substance is preserved,
// while keeping per-request token spend low enough that OpenRouter's
// upstream provider (Google Gemini) doesn't reject us under load.
const CONTENT_SLICE_LIMIT = 12_000

// A lightweight check on extracted text quality. The PDF extractor already
// applies its own MIN_USEFUL_CHARS heuristic before declaring success, but
// .docx / URL paths come in here too and we want a single guardrail before
// the AI is ever called. Bug history: a previously-empty string was happily
// passed to Gemini, which then hallucinated a quiz on a random topic.
const MIN_AI_INPUT_CHARS = 200

// Sleep with a small randomised jitter so concurrent retries don't all hit
// the upstream provider at the same instant.
function sleep(ms: number): Promise<void> {
  const jittered = ms + Math.floor(Math.random() * 250)
  return new Promise(resolve => setTimeout(resolve, jittered))
}

// Pull the HTTP status off whatever error shape the OpenAI SDK / OpenRouter
// throws. Mostly the SDK throws an APIError with `.status`, but network
// aborts surface as plain Errors with the status embedded in `.message`
// like "504 The operation was aborted". We extract from both.
function inferUpstreamStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { status?: number; statusCode?: number; code?: string; message?: string }
  if (typeof e.status === 'number') return e.status
  if (typeof e.statusCode === 'number') return e.statusCode
  if (typeof e.message === 'string') {
    const m = e.message.match(/\b(4\d{2}|5\d{2})\b/)
    if (m) return Number(m[1])
  }
  return null
}

// Map an upstream OpenRouter / provider failure to a user-facing message
// that tells the host what to do. The previous catch-all message
// ("Generation failed — please try again") is misleading because retrying
// against a 429 just reproduces the failure.
function describeAiFailure(status: number | null): { message: string; httpStatus: number } {
  if (status === 404) {
    return {
      message: 'AI model is temporarily unavailable. Please try again in a minute.',
      httpStatus: 502,
    }
  }
  if (status === 429) {
    return {
      message: 'AI service is busy right now (rate-limited). Please wait a minute and try again, or try a shorter document.',
      httpStatus: 429,
    }
  }
  if (status === 504 || status === 408) {
    return {
      message: 'The AI took too long to respond. Try a shorter document, fewer questions, or simpler question types.',
      httpStatus: 504,
    }
  }
  if (status && status >= 500) {
    return {
      message: 'The AI provider had a temporary error. Please try again in a moment.',
      httpStatus: 502,
    }
  }
  if (status && status >= 400) {
    return {
      message: 'The AI rejected this request. Try a different document or fewer questions.',
      httpStatus: 502,
    }
  }
  return {
    message: 'Generation failed. Please try again.',
    httpStatus: 500,
  }
}

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./, // link-local (includes cloud metadata 169.254.169.254)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^198\.(1[8-9])\./, // benchmarking 198.18.0.0/15
  /^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./, // TEST-NETs
  /^224\./, /^239\./, // multicast
  /^255\.255\.255\.255$/,
]

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/,
  /^::$/,
  /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i, // unique local fc00::/7
  /^fe[89ab][0-9a-f]:/i, // link-local fe80::/10
  /^ff[0-9a-f]{2}:/i, // multicast ff00::/8
]

function normalizeIpv4Mapped(addr: string): string {
  // ::ffff:a.b.c.d → a.b.c.d ; ::ffff:aabb:ccdd → a.b.c.d
  const m1 = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (m1) return m1[1]
  const m2 = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (m2) {
    const hi = parseInt(m2[1], 16)
    const lo = parseInt(m2[2], 16)
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
  }
  return addr
}

function isPrivateAddress(addr: string): boolean {
  const normalized = normalizeIpv4Mapped(addr)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    return PRIVATE_IPV4_PATTERNS.some(p => p.test(normalized))
  }
  return PRIVATE_IPV6_PATTERNS.some(p => p.test(normalized))
}

async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(urlStr)
    if (protocol !== 'https:') return false
    const host = hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.internal') || host.endsWith('.local') || host.endsWith('.localhost')) return false
    // Reject bare IP literals that are already private without needing DNS
    if (isPrivateAddress(host)) return false
    const [ipv4, ipv6] = await Promise.all([
      dns.resolve4(host).catch(() => [] as string[]),
      dns.resolve6(host).catch(() => [] as string[]),
    ])
    const all = [...ipv4, ...ipv6]
    if (all.length === 0) return false
    return all.every(addr => !isPrivateAddress(addr))
  } catch { return false }
}

async function safeFetchFollowRedirects(
  url: string,
  signal: AbortSignal,
  maxRedirects = 3,
): Promise<Response> {
  let current = url
  for (let i = 0; i <= maxRedirects; i++) {
    if (!await isSafeUrl(current)) {
      throw new Error('Unsafe URL')
    }
    const res = await fetch(current, { signal, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return res
      current = new URL(loc, current).toString()
      continue
    }
    return res
  }
  throw new Error('Too many redirects')
}

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-3-flash'

// Inject today's date so the model never gives stale "latest X" answers.
function getSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `Today's date is ${today}. For questions about 'latest', 'newest', or 'current' facts, use the most up-to-date information you know — do not present outdated facts as current. If unsure whether a fact is still current, prefer a timeless question.\n\nYou are a quiz generator. Return only valid JSON — no markdown, no explanation, no code fences.`
}

interface TypeMix {
  mcq?: number
  multiselect?: number
  truefalse?: number
  poll?: number
  openended?: number
  wordcloud?: number
  qa?: number
  rating?: number
  ranking?: number
  case?: number
}

function buildUserPrompt(text: string, questionCount: number, difficulty: string, typeMix?: TypeMix): string {
  const mcq = typeMix?.mcq ?? questionCount
  const multi = typeMix?.multiselect ?? 0
  const tf = typeMix?.truefalse ?? 0
  const poll = typeMix?.poll ?? 0
  const open = typeMix?.openended ?? 0
  const wc = typeMix?.wordcloud ?? 0
  const qa = typeMix?.qa ?? 0
  const rat = typeMix?.rating ?? 0
  const rank = typeMix?.ranking ?? 0
  const sc = typeMix?.case ?? 0

  let typeInstructions = ''
  const examples: string[] = []

  if (mcq > 0) {
    typeInstructions += `\n- ${mcq} MCQ questions: type "mcq", exactly 4 options, "correctAnswer" is a string index ("0","1","2","3"). IMPORTANT: Vary the correct answer position randomly across questions — do NOT always put the correct answer in the same position.`
    examples.push(`{"type":"mcq","text":"Who discovered gravity?","options":["Newton","Einstein","Galileo","Kepler"],"correctAnswer":"0","timerSeconds":20,"points":1000}`)
  }
  if (multi > 0) {
    typeInstructions += `\n- ${multi} Multi-select questions: type "multiselect", exactly 4 options, "correctAnswers" is an array of one or more string indices. Use this only when multiple options can be correct.`
    examples.push(`{"type":"multiselect","text":"Which of these are prime numbers?","options":["2","3","4","9"],"correctAnswers":["0","1"],"timerSeconds":30,"points":1000}`)
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
    typeInstructions += `\n- ${open} Open-ended questions: type "openended", NO "options" field, NO "correctAnswer" field. Ask a thought-provoking discussion question.`
    examples.push(`{"type":"openended","text":"Explain the significance of the French Revolution in your own words.","timerSeconds":60,"points":1000}`)
  }
  if (wc > 0) {
    typeInstructions += `\n- ${wc} Word Cloud questions: type "wordcloud", NO "options" field, NO "correctAnswer" field. Ask a question that invites single-word or short-phrase answers (1-3 words). The audience responses will form a word cloud.`
    examples.push(`{"type":"wordcloud","text":"What is the first word that comes to mind when you think of climate change?","timerSeconds":20,"points":0}`)
  }
  if (qa > 0) {
    typeInstructions += `\n- ${qa} Q&A questions: type "qa", NO "options" field, NO "correctAnswer" field. Frame a discussion question that invites longer, thoughtful answers from participants.`
    examples.push(`{"type":"qa","text":"What challenges do you face when applying AI tools in your daily work?","timerSeconds":60,"points":0}`)
  }
  if (rat > 0) {
    typeInstructions += `\n- ${rat} Rating questions: type "rating", NO "options" field, NO "correctAnswer" field. Include a "ratingLabel" field describing what is being rated (e.g. "Confidence Level"). Participants will rate on a 1-5 scale.`
    examples.push(`{"type":"rating","text":"How confident are you in your understanding of machine learning basics?","ratingLabel":"Confidence Level","timerSeconds":20,"points":0}`)
  }
  if (rank > 0) {
    typeInstructions += `\n- ${rank} Ranking questions: type "ranking", provide 3-5 items in "options" array that participants must rank in order, NO "correctAnswer" field.`
    examples.push(`{"type":"ranking","text":"Rank these renewable energy sources from most to least promising:","options":["Solar","Wind","Nuclear","Hydroelectric"],"timerSeconds":30,"points":0}`)
  }
  if (sc > 0) {
    typeInstructions += `\n- ${sc} Scenario questions: type "case", exactly 4 options, "correctAnswer" is a string index ("0","1","2","3"). Include a "scenarioText" field (situation narrative, max 500 chars) and optionally a "supportingDetail" field. The question text should ask what to do or decide given the scenario.`
    examples.push(`{"type":"case","text":"What should the team lead do first?","scenarioText":"A software team discovers a critical security vulnerability in production just before a major demo to investors. The fix requires 4 hours but the demo is in 2 hours.","options":["Postpone the demo","Deploy a hotfix during demo","Proceed and disclose after","Notify investors immediately"],"correctAnswer":"3","timerSeconds":30,"points":1000}`)
  }

  return `Generate exactly ${questionCount} ${difficulty} quiz questions based on the following content.

Return a JSON array with exactly ${questionCount} items in this breakdown:${typeInstructions}

Examples of each type:
${examples.join('\n')}

Rules:
- "timerSeconds" must be one of: 10, 15, 20, 30, 60
- "points" must be one of: 0, 500, 1000, 2000 (use 0 for poll, wordcloud, qa, rating, and ranking types)
- Each option must be a complete, meaningful answer — never blank, never a placeholder like "Option A"
- Never reference the source material in questions. Don't say "according to the passage", "based on the content", "extracted from", "as mentioned in", "from the text", etc. Write each question as a standalone knowledge question.
- Return nothing except the JSON array

Content:
${text}`
}

function buildSimplePrompt(text: string, questionCount: number, difficulty: string): string {
  return buildUserPrompt(text, questionCount, difficulty, { mcq: questionCount })
}

async function callModel(contentText: string, questionCount: number, difficulty: string, typeMix?: TypeMix, modelOverride?: string): Promise<unknown[]> {
  const prompt = typeMix
    ? buildUserPrompt(contentText, questionCount, difficulty, typeMix)
    : buildSimplePrompt(contentText, questionCount, difficulty)

  const response = await client.chat.completions.create({
    model: modelOverride ?? MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt() },
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
    if (type === 'multiselect') {
      return Array.isArray(item.options) && item.options.length >= 2 &&
        (item.options as unknown[]).every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) &&
        Array.isArray(item.correctAnswers) && item.correctAnswers.length > 0 &&
        (item.correctAnswers as unknown[]).every((a: unknown) => typeof a === 'string')
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
    if (type === 'wordcloud') {
      return true // text + timer + points is enough
    }
    if (type === 'qa') {
      return true // text + timer + points is enough
    }
    if (type === 'rating') {
      return typeof item.ratingLabel === 'string' || true // ratingLabel optional in validation
    }
    if (type === 'ranking') {
      return Array.isArray(item.options) && item.options.length >= 3 &&
        (item.options as unknown[]).every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0)
    }
    if (type === 'case') {
      return Array.isArray(item.options) && item.options.length >= 2 &&
        (item.options as unknown[]).every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) &&
        typeof item.correctAnswer === 'string' &&
        typeof item.scenarioText === 'string'
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

  // Abuse rate-limit: cheap per-user + per-IP throttle BEFORE we touch OpenAI.
  // Blocks credential-sharing bursts and anonymous-IP abuse even if monthly
  // question budget is not yet exhausted.
  const rl = await rateLimitRequest(req, {
    bucket: 'generate-quiz',
    userId: user.id,
    userLimit: 20,
    ipLimit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  // AI quota — proportional (count questions, not calls)
  const quota = await checkAiQuota(user.id, 'ai_generate', 1)
  const plan = quota.plan
  if (!quota.allowed) {
    return NextResponse.json({
      error: `You've used all ${quota.limit} AI question credits this month (${quota.used}/${quota.limit}). Email info@quizotic.live if you need more — we review every request. Limit resets next month.`,
    }, { status: 429 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  let questionCount = 5
  let difficulty = 'medium'
  let contentText = ''
  let typeMix: TypeMix | undefined
  let mode = 'document'
  let topicOrUrl: string | null = null
  // For analytics + UI transparency: which extraction tier produced the
  // content. logAiUsage records this so we can audit success rates and
  // catch regressions where one tier suddenly stops working.
  let extractionSource: 'text' | 'ocr' | 'vision' | 'none' | 'docx' | 'topic' | 'url' = 'topic'
  let extractionPageCount = 0
  let extractionOcrPages = 0
  let extractionVisionPages = 0
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
      if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.pdf')) {
        // Robust three-tier extractor: text → Tesseract OCR → Vision LLM.
        // See src/lib/pdf-extract.mjs for the policy.
        const extracted = await extractPdfText(buffer) as { text: string; source: 'text' | 'ocr' | 'vision' | 'none'; pageCount: number; ocrPagesUsed: number; visionPagesUsed: number; charCount: number }
        extractionSource = extracted.source
        extractionPageCount = extracted.pageCount
        extractionOcrPages = extracted.ocrPagesUsed
        extractionVisionPages = extracted.visionPagesUsed ?? 0

        if (extracted.source === 'none') {
          // CRITICAL — the original bug was sending empty content to the AI,
          // which then fabricated a wildly-unrelated quiz. With three tiers
          // (text, OCR, vision LLM) failing all together is rare, but when
          // it happens we refuse and skip the AI call so the user isn't
          // charged quota for garbage. 422 lets the client show the message
          // verbatim.
          console.warn(`[generate-quiz] PDF extraction returned no usable content from any tier: pages=${extracted.pageCount} ocrPages=${extracted.ocrPagesUsed} visionPages=${extracted.visionPagesUsed} fileName=${file.name}`)
          return NextResponse.json({
            error: "We couldn't read enough text from this PDF to generate a quiz. The file may be corrupted, password-protected, or contain only blank pages. Try a different file, or paste the content directly.",
            code: 'extraction_failed',
            pageCount: extracted.pageCount,
          }, { status: 422 })
        }
        contentText = extracted.text  // already slice-limited inside the helper
      } else if (fileName.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        contentText = result.value.slice(0, CONTENT_SLICE_LIMIT)
        extractionSource = 'docx'
      } else {
        return NextResponse.json({ error: 'Only .pdf and .docx files are supported' }, { status: 400 })
      }
    }
    // ── JSON modes (topic / url) ───────────────────────────────────────────────
    else {
      const body = await req.json()
      mode = body.mode ?? 'topic'
      // Accept the builder's internal tab ids as synonyms so a client that
      // forwards the raw tab id ('aitopic'/'aiurl') doesn't get rejected with
      // "Invalid mode". Defense-in-depth: the client already maps these, but
      // this kept regressing via stale monorepo syncs.
      if (mode === 'aitopic') mode = 'topic'
      else if (mode === 'aiurl') mode = 'url'
      questionCount = body.questionCount ?? 5
      difficulty = body.difficulty ?? 'medium'
      typeMix = body.typeMix as TypeMix | undefined

      if (mode === 'topic') {
        if (!body.topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        contentText = `Topic: ${body.topic}`
        topicOrUrl = body.topic?.slice(0, 100) || null
        extractionSource = 'topic'
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
          const res = await safeFetchFollowRedirects(url, controller.signal)
          html = await res.text()
        } catch {
          return NextResponse.json({ error: 'Could not fetch URL — try another' }, { status: 400 })
        } finally {
          clearTimeout(timeout)
        }
        // Strip HTML tags, collapse whitespace, truncate
        contentText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CONTENT_SLICE_LIMIT)
        extractionSource = 'url'
      } else {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }
    }

    // Clamp questionCount to plan limits
    questionCount = Math.min(Math.max(questionCount, 3), maxQ)

    // Final guardrail before we burn AI quota. Topic mode is naturally short
    // ("Topic: photosynthesis") and that's fine — the AI is generating from
    // its own knowledge rather than from a passage. For document/url modes
    // we require real content so the AI grounds its questions in the source.
    if (mode !== 'topic' && contentText.replace(/\s+/g, ' ').trim().length < MIN_AI_INPUT_CHARS) {
      console.warn(`[generate-quiz] aborted before AI call — content too short: source=${extractionSource} chars=${contentText.length}`)
      return NextResponse.json({
        error: 'Not enough content to generate a meaningful quiz. Try a larger document or paste the text directly.',
        code: 'content_too_short',
      }, { status: 422 })
    }

    // ── Call model with backoff retry ──────────────────────────────────────────
    // Three attempts: original, after 1.5s, after 3.5s. Without the backoff
    // a 504/429 retry hits the same upstream rate-window and just fails
    // again. The fallback model on the third attempt is a different size
    // tier so a model-specific 429 doesn't doom us.
    const FALLBACK_MODEL = process.env.QUIZ_AI_FALLBACK_MODEL ?? 'google/gemini-2.5-flash'
    const attempts: Array<{ delayMs: number; model?: string }> = [
      { delayMs: 0 },
      { delayMs: 1_500 },
      { delayMs: 3_500, model: FALLBACK_MODEL },
    ]
    let questions: unknown[] | null = null
    let lastStatus: number | null = null
    let lastErr: unknown = null
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i]
      if (a.delayMs > 0) await sleep(a.delayMs)
      try {
        questions = await callModel(contentText, questionCount, difficulty, typeMix, a.model)
        break
      } catch (err) {
        lastErr = err
        lastStatus = inferUpstreamStatus(err)
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[generate-quiz] attempt ${i + 1}/${attempts.length} failed (model=${a.model ?? MODEL} status=${lastStatus ?? 'unknown'} contentChars=${contentText.length}): ${msg}`)
      }
    }
    if (questions === null) {
      const description = describeAiFailure(lastStatus)
      console.error(`[generate-quiz] all ${attempts.length} attempts failed; surfacing ${description.httpStatus} to client`, { lastStatus, lastErr: lastErr instanceof Error ? lastErr.message : lastErr })
      return NextResponse.json({
        error: description.message,
        code: lastStatus === 404 ? 'ai_model_unavailable' : lastStatus === 429 ? 'rate_limited' : lastStatus === 504 ? 'upstream_timeout' : 'ai_error',
      }, { status: description.httpStatus })
    }

    if (!validateQuestions(questions)) {
      console.error('[generate-quiz] validation failed — model returned malformed JSON', { sample: JSON.stringify(questions).slice(0, 500) })
      return NextResponse.json({ error: 'AI returned an unexpected format. Please try again.' }, { status: 502 })
    }

    // Shuffle MCQ options so the correct answer isn't always in the same position
    for (const q of questions as Record<string, unknown>[]) {
      if ((q.type === 'mcq' || (!q.type && Array.isArray(q.options) && typeof q.correctAnswer === 'string')) &&
          Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
        const opts = q.options as string[]
        const correctIdx = parseInt(q.correctAnswer, 10)
        if (correctIdx >= 0 && correctIdx < opts.length) {
          const correctText = opts[correctIdx]
          // Fisher-Yates shuffle
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]]
          }
          // Update correctAnswer to new position
          q.correctAnswer = String(opts.indexOf(correctText))
        }
      }
    }

    await logAiUsage(user.id, 'ai_generate', {
      model: MODEL,
      questionCount,
      difficulty,
      mode,
      typeMix: typeMix ? { ...typeMix } : null,
      topic: topicOrUrl,
      extractionSource,
      extractionPageCount,
      extractionOcrPages,
      extractionVisionPages,
      contentChars: contentText.length,
    })

    // Keep the response body shape (a JSON array) for back-compat with
    // existing client code. Metadata about how the source content was
    // extracted ships in custom response headers so the UI can show a
    // contextual notice (e.g. "Read via OCR — please review").
    const res = NextResponse.json(questions)
    res.headers.set('x-quizotic-extraction-source', extractionSource)
    res.headers.set('x-quizotic-page-count', String(extractionPageCount))
    res.headers.set('x-quizotic-ocr-pages', String(extractionOcrPages))
    res.headers.set('x-quizotic-vision-pages', String(extractionVisionPages))
    res.headers.set('x-quizotic-content-chars', String(contentText.length))
    return res
  } catch (err) {
    console.error('[generate-quiz]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
