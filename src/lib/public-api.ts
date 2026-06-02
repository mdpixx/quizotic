import { NextResponse } from 'next/server'
import type { Question } from '@/lib/quiz-types'

export function apiError(code: string, message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({
    error: { code, message, ...(details === undefined ? {} : { details }) },
  }, { status })
}

export function unauthorizedApiKey(): NextResponse {
  return apiError('unauthorized', 'Pass your Quizotic API key as: Authorization: Bearer <key>', 401)
}

export function normalizeQuestion(raw: unknown, index: number): Question {
  const q = (raw && typeof raw === 'object' ? raw : {}) as Partial<Question>
  const type = q.type ?? 'mcq'
  const base: Question = {
    id: typeof q.id === 'string' && q.id ? q.id : `q_${index + 1}_${crypto.randomUUID()}`,
    type,
    text: typeof q.text === 'string' ? q.text.trim() : '',
    timerSeconds: q.timerSeconds ?? 20,
    points: q.points ?? (['poll', 'wordcloud', 'qa', 'rating', 'ranking'].includes(type) ? 500 : 1000),
  }
  if (Array.isArray(q.options)) base.options = q.options
  if (q.correctAnswer !== undefined) base.correctAnswer = q.correctAnswer
  if (Array.isArray(q.correctAnswers)) base.correctAnswers = q.correctAnswers
  if (Array.isArray(q.correctOrder)) base.correctOrder = q.correctOrder
  if (q.imageUrl) base.imageUrl = q.imageUrl
  if (q.explanation) base.explanation = q.explanation
  if (q.bloomsLevel) base.bloomsLevel = q.bloomsLevel
  if (q.scenarioText) base.scenarioText = q.scenarioText
  if (q.supportingDetail) base.supportingDetail = q.supportingDetail
  return base
}

export function normalizeQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return []
  return raw.map((q, index) => normalizeQuestion(q, index))
}

export function parsePagination(url: URL, defaults = { limit: 50, max: 200 }) {
  const rawLimit = Number(url.searchParams.get('limit') ?? defaults.limit)
  const rawOffset = Number(url.searchParams.get('offset') ?? 0)
  return {
    limit: Math.min(defaults.max, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaults.limit)),
    offset: Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0),
  }
}
