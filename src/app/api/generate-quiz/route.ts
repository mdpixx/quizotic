import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

const SYSTEM_PROMPT = `You are a quiz generator. Return only valid JSON — no markdown, no explanation, no code fences.`

function buildUserPrompt(text: string, questionCount: number, difficulty: string): string {
  return `Generate ${questionCount} ${difficulty} quiz questions based on the following content.

Return a JSON array. Each item must have exactly this shape:
{
  "type": "mcq",
  "text": "Question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "1",
  "timerSeconds": 20,
  "points": 1000
}

Rules:
- "correctAnswer" is always a string index into the options array ("0", "1", "2", or "3")
- "timerSeconds" must be one of: 10, 15, 20, 30, 60
- "points" must be one of: 500, 1000, 2000
- All questions must be MCQ with exactly 4 options
- Return nothing except the JSON array

Content:
${text}`
}

async function callModel(prompt: string, questionCount: number, difficulty: string): Promise<unknown[]> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(prompt, questionCount, difficulty) },
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
    return (
      typeof item.text === 'string' &&
      Array.isArray(item.options) &&
      typeof item.correctAnswer === 'string' &&
      typeof item.timerSeconds === 'number' &&
      typeof item.points === 'number'
    )
  })
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''

  let questionCount = 5
  let difficulty = 'medium'
  let contentText = ''

  try {
    // ── Document mode ──────────────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      questionCount = Number(formData.get('questionCount') ?? 5)
      difficulty = (formData.get('difficulty') as string) ?? 'medium'

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
      const mode: string = body.mode
      questionCount = body.questionCount ?? 5
      difficulty = body.difficulty ?? 'medium'

      if (mode === 'topic') {
        if (!body.topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        contentText = `Topic: ${body.topic}`
      } else if (mode === 'url') {
        const url: string = body.url ?? ''
        if (!url.startsWith('https://')) {
          return NextResponse.json({ error: 'Only https:// URLs are supported' }, { status: 400 })
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

    // ── Call model, validate, retry once on bad JSON ───────────────────────────
    let questions: unknown[]
    try {
      questions = await callModel(contentText, questionCount, difficulty)
    } catch {
      // Retry once
      try {
        questions = await callModel(contentText, questionCount, difficulty)
      } catch {
        return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
      }
    }

    if (!validateQuestions(questions)) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    return NextResponse.json(questions)
  } catch (err) {
    console.error('[generate-quiz]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
