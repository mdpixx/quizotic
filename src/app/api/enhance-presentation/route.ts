export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { checkAiQuota, logAiUsage } from '@/lib/ai-quota'

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
  // Optional URL (absolute or relative like `/api/img/...`) of the slide
  // image. When present the server fetches the object from R2 and sends it
  // to the vision-capable model so the AI can actually see what's on the
  // slide (charts, diagrams, photos) — not just what python-pptx extracted.
  imageUrl?: string
}

interface SlideInputWithImage extends SlideInput {
  imageDataUrl?: string
}

// ─── R2 image fetch for multimodal prompts ──────────────────────────────────

function extractR2Key(url: string | undefined): string | null {
  if (!url) return null
  // Our rewrite produces `/api/img/images/<userId>/<yyyy-mm>/pptx-<uuid>.png`.
  // For legacy decks still pointing at pub-*.r2.dev, strip the origin.
  const marker = '/api/img/'
  const i = url.indexOf(marker)
  if (i >= 0) return url.slice(i + marker.length)
  const legacyMarker = '.r2.dev/'
  const j = url.indexOf(legacyMarker)
  if (j >= 0) return url.slice(j + legacyMarker.length)
  return null
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const MAX_IMAGE_BYTES = 1_500_000 // 1.5MB per image — skip huge ones

async function fetchSlideImageAsDataUrl(url: string | undefined): Promise<string | undefined> {
  const key = extractR2Key(url)
  if (!key) return undefined
  try {
    const r2 = getR2Client()
    const out = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME ?? 'quizotic-uploads',
        Key: key,
      }),
    )
    if (!out.Body) return undefined
    const contentLength = out.ContentLength ?? 0
    if (contentLength > MAX_IMAGE_BYTES) {
      console.warn(`[enhance] skipping oversize image ${key} (${contentLength} bytes)`)
      return undefined
    }
    const chunks: Buffer[] = []
    const stream = out.Body as unknown as AsyncIterable<Uint8Array>
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    const buf = Buffer.concat(chunks)
    const mime = out.ContentType ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn(`[enhance] failed to fetch R2 key ${key}:`, err)
    return undefined
  }
}

// Cap the number of slide images we send to keep token cost and latency
// predictable. Prioritise slides where the AI benefits most — those with
// thin text (visual-only slides) fall through first, up to the cap.
const MAX_MULTIMODAL_IMAGES = 12

async function hydrateSlideImages(slides: SlideInput[]): Promise<SlideInputWithImage[]> {
  // Rank slides by "how much does the AI need the image?" — ones with thin
  // text content go first since python-pptx couldn't see their visual.
  const ranked = [...slides]
    .map((s, originalIdx) => ({ s, originalIdx }))
    .sort((a, b) => a.s.textContent.length - b.s.textContent.length)
  const selected = new Set<number>()
  let budget = MAX_MULTIMODAL_IMAGES
  for (const { originalIdx } of ranked) {
    if (budget <= 0) break
    if (slides[originalIdx].imageUrl) {
      selected.add(originalIdx)
      budget--
    }
  }
  const hydrated: SlideInputWithImage[] = await Promise.all(
    slides.map(async (s, i) => {
      if (!selected.has(i)) return { ...s }
      const dataUrl = await fetchSlideImageAsDataUrl(s.imageUrl)
      return { ...s, imageDataUrl: dataUrl }
    }),
  )
  return hydrated
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

## Spelling fidelity (STRICT)
- NEVER invent, misspell, or mangle words. If you quote a term from the slide, copy it character-for-character from the source.
- If a source word looks unusual — domain jargon, PSU / government / petroleum terminology, legal language, Hindi / Hinglish — treat it as intentional. Do NOT "correct", paraphrase its letters, or swap it for a similar-sounding word.
- For Word Duel / Ranking / MCQ options: prefer direct quotes from the slide over re-worded alternatives. If the slide says "derecognize", your option must say "derecognize" — never "deregognize", "de-recognise", or similar.
- Any acronym or proper noun (LOI, OMC, RO, MCI, IOCL, etc.) must be preserved in its exact source casing.

Return ONLY valid JSON — no markdown fences, no explanation, no preamble.`

function getSlidePosition(index: number, total: number): string {
  const pct = index / total
  if (pct < 0.15) return 'opening'
  if (pct < 0.4) return 'early'
  if (pct < 0.7) return 'middle'
  if (pct < 0.9) return 'late'
  return 'closing'
}

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

function buildMultimodalUserPrompt(
  slides: SlideInputWithImage[],
  targetCount: number,
  analysis: DeckAnalysis,
): MultimodalPart[] {
  const deckContext = `## Deck Analysis
Topic: ${analysis.topic}
Audience: ${analysis.audience}
Content type: ${analysis.contentType}
Key topics: ${analysis.keyTopics.join(', ')}
Narrative arc: ${analysis.narrativeArc}
Total slides: ${slides.length}
`
  const parts: MultimodalPart[] = [{ type: 'text', text: `${deckContext}\n## Slides\n` }]
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]
    const position = getSlidePosition(s.index, slides.length)
    const prevTitle = i > 0 ? slides[i - 1].textContent.split('\n')[0].slice(0, 60) : '(start)'
    const nextTitle = i < slides.length - 1 ? slides[i + 1].textContent.split('\n')[0].slice(0, 60) : '(end)'
    const slideHeader = `\n[Slide ${s.index} of ${slides.length}] (${s.type} slide, position: ${position})\nContent: ${s.textContent.slice(0, 2500)}\nPrevious: "${prevTitle}"\nNext: "${nextTitle}"`
    parts.push({ type: 'text', text: slideHeader })
    if (s.imageDataUrl) {
      parts.push({ type: 'image_url', image_url: { url: s.imageDataUrl } })
    }
  }
  parts.push({
    type: 'text',
    text: `\n\n## Task
Suggest exactly ${targetCount} interactive slides. For each:
- "afterSlideIndex": the slide index to insert AFTER
- "type": one of the 8 interactive types
- "slideData": complete data object with all required fields
- "rationale": one sentence explaining WHY this interactivity fits at this point

When slides include attached images, READ THEM carefully — charts, diagrams, labelled figures, numerical data often contain the most testable details. Reference what you see, not what you guess.

Space them evenly. Match the type to the content's cognitive level. Reference specific content from the slides.

Return a JSON array:
[
  { "afterSlideIndex": 2, "type": "word_cloud", "slideData": { "question": "...", "maxWords": 1 }, "rationale": "..." },
  ...
]`,
  })
  return parts
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

// ─── Mangled-word detection (defends against AI typo-ing source words) ─────

// Common English suffix / pattern heuristic — fast pre-filter for real words.
const DICTIONARY_PATTERN = /^(?:[a-z]+(?:tion|ment|ness|ity|ance|ence|ship|able|ible|ous|ive|ary|ory|ize|ise|ise|ing|ed|er|est|ly|ful|less|al|ic|ism|ist|age|ate|ure|hood|dom)|[a-z]{1,5})$/i

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i - 1], dp[i])
      prev = tmp
    }
  }
  return dp[a.length]
}

function extractCandidateWords(obj: Record<string, unknown>): string[] {
  const words: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') {
      for (const w of v.split(/[^A-Za-z'-]+/)) {
        if (w.length >= 6) words.push(w)
      }
    } else if (Array.isArray(v)) {
      for (const item of v) push(item)
    }
  }
  push(obj.question)
  push(obj.optionA)
  push(obj.optionB)
  push(obj.options)
  push(obj.items)
  return words
}

/**
 * Detects words in a suggestion that look like AI mangled a source term.
 * Returns the list of mangled words; empty array = clean suggestion.
 *
 * A word is "mangled" when it meets ALL of:
 * 1. Not a substring (case-insensitive) of any source slide's text
 * 2. Fails the English-suffix dictionary heuristic
 * 3. Has Levenshtein distance ≤ 2 to some source token (length ≥ 6)
 *
 * The combination (near-miss to a source word, not in source, not a plain English word)
 * is a strong signal the AI corrupted a quoted term (e.g. "derecognize" → "Deregognize").
 */
function detectMangledWords(suggestion: AiSuggestion, sourceSlides: SlideInput[]): string[] {
  const sourceText = sourceSlides.map(s => s.textContent).join('\n').toLowerCase()
  const sourceTokens = new Set(
    sourceText.split(/[^a-z'-]+/).filter(w => w.length >= 6)
  )
  const candidates = extractCandidateWords(suggestion.slideData as Record<string, unknown>)
  const mangled: string[] = []
  for (const word of candidates) {
    const lower = word.toLowerCase()
    if (sourceText.includes(lower)) continue                    // quoted verbatim → OK
    if (DICTIONARY_PATTERN.test(lower)) continue                // real English word → OK
    let nearMiss = false
    for (const tok of sourceTokens) {
      if (Math.abs(tok.length - lower.length) > 2) continue
      if (levenshtein(lower, tok) <= 2) { nearMiss = true; break }
    }
    if (nearMiss) mangled.push(word)
  }
  return mangled
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

  const rl = await rateLimitRequest(req, {
    bucket: 'enhance-presentation',
    userId: user.id,
    userLimit: 15,
    ipLimit: 20,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  // AI enhancement quota — 1 row per call
  const quota = await checkAiQuota(user.id, 'ai_enhance', 1)
  if (!quota.allowed) {
    return NextResponse.json(
      { success: false, error: `AI enhancement limit reached (${quota.limit}/month). Email info@quizotic.live if you need more — we review every request.`, usage: { used: quota.used, limit: quota.limit } },
      { status: 429 }
    )
  }

  // Parse request
  const body = await req.json() as { slides?: SlideInput[]; level?: string }
  const { slides, level = 'moderate' } = body

  if (!slides || !Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json({ success: false, error: 'No slides provided' }, { status: 400 })
  }

  // Filter to slides worth enhancing — either text-heavy OR image-bearing
  // (imported PPTX slides are type 'image' with minimal text but the visual
  // is the signal, so we should include them).
  const contentSlides = slides.filter(s =>
    ['title', 'bullets', 'image'].includes(s.type) &&
    (s.textContent.trim().length > 10 || !!s.imageUrl)
  )

  if (contentSlides.length === 0) {
    return NextResponse.json({ success: false, error: 'No text-heavy content slides found to enhance.' }, { status: 400 })
  }

  const targetCount = getTargetCount(contentSlides.length, level)

  try {
    // Pass 1: Analyze the deck for topic, audience, and narrative
    const analysis = await analyzeDeck(contentSlides)

    // Hydrate a subset of slide images as base64 for multimodal prompting.
    // Only runs for slides that opt in via `imageUrl`; capped by MAX_MULTIMODAL_IMAGES.
    const hydrated = await hydrateSlideImages(contentSlides)
    const attachedCount = hydrated.filter(s => s.imageDataUrl).length
    console.log(`[enhance] deck=${contentSlides.length} slides, target=${targetCount}, images=${attachedCount}`)

    // Pass 2: Generate suggestions with full context. Use multimodal when we
    // have images to show, otherwise fall back to the plain-text prompt.
    const userContent: MultimodalPart[] | string =
      attachedCount > 0
        ? buildMultimodalUserPrompt(hydrated, targetCount, analysis)
        : buildUserPrompt(contentSlides, targetCount, analysis)

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: userContent as any },
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

    let suggestions = validateSuggestions(parsed)

    if (suggestions.length === 0) {
      return NextResponse.json({ success: false, error: 'AI could not generate valid suggestions. Please try again.' }, { status: 500 })
    }

    // ─── Anti-mangling guard: detect suggestions where AI typo-ed a source word ──
    const mangledReport = suggestions.map(s => ({ sug: s, bad: detectMangledWords(s, contentSlides) }))
    const offenders = mangledReport.filter(r => r.bad.length > 0)
    if (offenders.length > 0) {
      const allBad = Array.from(new Set(offenders.flatMap(o => o.bad)))
      console.warn('[enhance] mangled word(s) detected — retrying:', allBad)
      try {
        const retry = await client.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(contentSlides, targetCount, analysis) },
            { role: 'assistant', content: raw },
            { role: 'user', content: `Your previous output contained words that do not appear in the source slides and look like misspellings of source terms: ${allBad.join(', ')}. Re-generate the ENTIRE array. Use exact source spellings only. Do not invent variant spellings. Return ONLY the JSON array.` },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        })
        const retryRaw = retry.choices[0]?.message?.content?.trim() ?? ''
        const retryCleaned = retryRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        const retryParsed = JSON.parse(retryCleaned)
        if (Array.isArray(retryParsed)) {
          const retrySuggestions = validateSuggestions(retryParsed)
          if (retrySuggestions.length > 0) suggestions = retrySuggestions
        }
      } catch (retryErr) {
        console.warn('[enhance] retry failed, dropping offenders:', retryErr)
      }
      // After retry, drop any suggestion that is STILL mangled rather than show bad output
      suggestions = suggestions.filter(s => detectMangledWords(s, contentSlides).length === 0)
    }

    // ─── Top-up when the AI under-delivers vs the requested level ───────────
    //
    // Issue: for "heavy" on 20 slides the user expects ~8 suggestions, but
    // when the mangling filter drops a chunk or the model just returns fewer,
    // the user gets 2-3 and thinks the feature is broken. If we're below ~70%
    // of target, issue a focused top-up asking ONLY for the shortfall, with
    // the existing suggestions as context so it doesn't duplicate them.
    const topUpThreshold = Math.max(1, Math.ceil(targetCount * 0.7))
    if (suggestions.length < topUpThreshold) {
      const short = targetCount - suggestions.length
      console.warn(`[enhance] Under-delivered (${suggestions.length}/${targetCount}) — requesting ${short} more`)
      try {
        const existingSummary = suggestions.map(s =>
          `- afterSlide ${s.afterSlideIndex}, type ${s.type}: "${(s.slideData.question as string) ?? ''}".`
        ).join('\n')
        const topUp = await client.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(contentSlides, targetCount, analysis) },
            { role: 'assistant', content: JSON.stringify(suggestions) },
            {
              role: 'user',
              content: `That was a good start but only ${suggestions.length} of the ${targetCount} requested suggestions came through. Please return ${short} ADDITIONAL suggestions (not duplicates) covering slides that weren't yet enhanced. Space them across the deck. Use exact source spellings only. Return ONLY a JSON array of the ${short} new suggestions — do NOT repeat the existing ones listed above:\n${existingSummary}`,
            },
          ],
          temperature: 0.4,
          max_tokens: 4000,
        })
        const topUpRaw = topUp.choices[0]?.message?.content?.trim() ?? ''
        const topUpCleaned = topUpRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        const topUpParsed = JSON.parse(topUpCleaned)
        if (Array.isArray(topUpParsed)) {
          const fresh = validateSuggestions(topUpParsed).filter(
            s => detectMangledWords(s, contentSlides).length === 0,
          )
          // Dedupe by afterSlideIndex+type+question to guard against overlap
          const seen = new Set(
            suggestions.map(s => `${s.afterSlideIndex}::${s.type}::${(s.slideData.question as string) ?? ''}`),
          )
          for (const s of fresh) {
            const key = `${s.afterSlideIndex}::${s.type}::${(s.slideData.question as string) ?? ''}`
            if (!seen.has(key)) {
              suggestions.push(s)
              seen.add(key)
              if (suggestions.length >= targetCount) break
            }
          }
        }
      } catch (topUpErr) {
        console.warn('[enhance] top-up failed:', topUpErr)
      }
    }

    if (suggestions.length === 0) {
      return NextResponse.json({ success: false, error: 'AI could not generate clean suggestions. Please try again.' }, { status: 500 })
    }

    await logAiUsage(user.id, 'ai_enhance', { slideCount: suggestions.length, level })

    const post = await checkAiQuota(user.id, 'ai_enhance', 0)
    return NextResponse.json({
      success: true,
      suggestions,
      usage: { used: post.used, limit: post.limit },
    })
  } catch (err) {
    console.error('AI enhance error:', err)
    return NextResponse.json(
      { success: false, error: 'AI service error. Please try again in a moment.' },
      { status: 500 }
    )
  }
}
