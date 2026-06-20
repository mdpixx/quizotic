import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression coverage for the "Invalid mode" bug: the builder's Topic/URL tabs
// posted the internal tab ids ('aitopic'/'aiurl') as the API `mode`, which the
// backend rejected. The backend now normalizes those aliases. Also covers the
// Language selection being threaded into the generation prompt.

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

function jsonReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// A valid 5-question MCQ payload so validateQuestions() passes and the route
// returns 200 with the generated array.
function mockAiQuestions() {
  const questions = Array.from({ length: 5 }, (_, i) => ({
    type: 'mcq',
    text: `Question ${i + 1}?`,
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: '0',
    timerSeconds: 20,
    points: 1000,
  }))
  chatCreateMock.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(questions) } }],
  })
}

describe('generate-quiz mode normalization + language', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'sk-test'
    getCurrentUserMock.mockResolvedValue(currentUser)
    quotaMock.mockResolvedValue({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 30 })
  })

  it('accepts the "aitopic" UI alias as topic mode (no "Invalid mode")', async () => {
    mockAiQuestions()
    const res = await generateQuiz(jsonReq({
      mode: 'aitopic',
      topic: 'Indian history',
      questionCount: 5,
      difficulty: 'easy',
      typeMix: { mcq: 5 },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBeGreaterThan(0)
  })

  it('normalizes the "aiurl" alias to url mode (reaches URL validation, not "Invalid mode")', async () => {
    // A non-https url fails the https check *after* alias normalization,
    // proving 'aiurl' was accepted as 'url' rather than rejected as invalid.
    const res = await generateQuiz(jsonReq({ mode: 'aiurl', url: 'ftp://example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Only https:// URLs are supported')
  })

  it('still accepts the canonical "topic" mode', async () => {
    mockAiQuestions()
    const res = await generateQuiz(jsonReq({
      mode: 'topic',
      topic: 'photosynthesis',
      questionCount: 5,
      difficulty: 'medium',
      typeMix: { mcq: 5 },
    }))
    expect(res.status).toBe(200)
  })

  it('still rejects a genuinely unknown mode with "Invalid mode"', async () => {
    const res = await generateQuiz(jsonReq({ mode: 'bogus', topic: 'x' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid mode')
  })

  it('threads the selected language into the generation prompt', async () => {
    mockAiQuestions()
    await generateQuiz(jsonReq({
      mode: 'topic',
      topic: 'Indian history',
      questionCount: 5,
      difficulty: 'easy',
      typeMix: { mcq: 5 },
      language: 'Hindi',
    }))
    const prompt = chatCreateMock.mock.calls[0][0].messages[1].content as string
    expect(prompt).toContain('Hindi')
  })

  it('omits the language instruction when English (default behavior unchanged)', async () => {
    mockAiQuestions()
    await generateQuiz(jsonReq({
      mode: 'topic',
      topic: 'Indian history',
      questionCount: 5,
      difficulty: 'easy',
      typeMix: { mcq: 5 },
      language: 'English',
    }))
    const prompt = chatCreateMock.mock.calls[0][0].messages[1].content as string
    expect(prompt).not.toContain('Write ALL question text')
  })
})
