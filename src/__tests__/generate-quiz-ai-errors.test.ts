import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const currentUser = { id: 'user-1', email: 'host@example.com' }

const chatCreateMock = vi.hoisted(() => vi.fn())
const getCurrentUserMock = vi.hoisted(() => vi.fn(async () => currentUser))
const quotaMock = vi.hoisted(() => vi.fn(async () => ({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 30 })))
const logUsageMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@/lib/auth-helpers', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: vi.fn(async () => ({ ok: true })),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate limited' }, { status: 429 })),
}))
vi.mock('@/lib/ai-quota', () => ({ checkAiQuota: quotaMock, logAiUsage: logUsageMock }))
vi.mock('openai', () => ({
  default: vi.fn(function MockOpenAI() {
    return { chat: { completions: { create: chatCreateMock } } }
  }),
}))

import { POST as generateQuiz } from '../app/api/generate-quiz/route'

function topicReq(topic = 'photosynthesis') {
  return new NextRequest('http://localhost/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'topic',
      topic,
      questionCount: 5,
      difficulty: 'medium',
      typeMix: { mcq: 5 },
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('legacy AI quiz generation error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.OPENROUTER_API_KEY = 'sk-test'
    getCurrentUserMock.mockResolvedValue(currentUser)
    quotaMock.mockResolvedValue({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 30 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function generateWithRetries(req: NextRequest) {
    const pending = generateQuiz(req)
    await vi.runAllTimersAsync()
    return pending
  }

  it('maps upstream 404 model failures to model-unavailable copy', async () => {
    chatCreateMock.mockRejectedValue(Object.assign(new Error('404 No endpoints found for google/gemini-2.0-flash-001.'), { status: 404 }))

    const res = await generateWithRetries(topicReq())
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.code).toBe('ai_model_unavailable')
    expect(json.error).toBe('AI model is temporarily unavailable. Please try again in a minute.')
  })

  it('keeps rate-limit copy for upstream 429 failures', async () => {
    chatCreateMock.mockRejectedValue(Object.assign(new Error('429 rate limited'), { status: 429 }))

    const res = await generateWithRetries(topicReq())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.code).toBe('rate_limited')
    expect(json.error).toContain('rate-limited')
  })

  it('keeps timeout copy for upstream 504 failures', async () => {
    chatCreateMock.mockRejectedValue(Object.assign(new Error('504 timeout'), { status: 504 }))

    const res = await generateWithRetries(topicReq())
    const json = await res.json()

    expect(res.status).toBe(504)
    expect(json.code).toBe('upstream_timeout')
    expect(json.error).toContain('took too long')
  })
})
