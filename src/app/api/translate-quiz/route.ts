import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { Question } from '@/lib/quiz-types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

export async function POST(req: NextRequest) {
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

    return NextResponse.json(merged)
  } catch (err) {
    console.error('[translate-quiz]', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
