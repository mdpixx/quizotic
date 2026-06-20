import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression guard for the "Invalid mode" bug in AI quiz generation.
//
// The builder's AIGenerateForm keeps the active tab in `mode` state with
// internal ids ('aitopic' | 'aiurl' | 'aidoc'). /api/generate-quiz only
// accepts 'topic' | 'url' in its JSON branch and returns 400 "Invalid mode"
// for anything else. Two regressions in this area have already shipped to
// production by a stale monorepo deploy sync silently reverting the client
// mapping. These tests fail the build if either side regresses again.

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

const VALID_QUESTIONS = [
  { type: 'mcq', text: 'Who founded the Maurya Empire?', options: ['Chandragupta Maurya', 'Ashoka', 'Bindusara', 'Bimbisara'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
]

function jsonReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AI quiz generation — mode handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'sk-test'
    getCurrentUserMock.mockResolvedValue(currentUser)
    quotaMock.mockResolvedValue({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 30 })
    chatCreateMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(VALID_QUESTIONS) } }] })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('accepts the canonical topic mode', async () => {
    const res = await generateQuiz(jsonReq({ mode: 'topic', topic: 'Indian history', questionCount: 5, difficulty: 'easy' }))
    expect(res.status).toBe(200)
  })

  it('accepts the builder tab alias "aitopic" without "Invalid mode"', async () => {
    const res = await generateQuiz(jsonReq({ mode: 'aitopic', topic: 'Indian history', questionCount: 5, difficulty: 'easy' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).not.toHaveProperty('error')
  })

  it('still rejects genuinely unknown modes with "Invalid mode"', async () => {
    const res = await generateQuiz(jsonReq({ mode: 'banana', topic: 'Indian history', questionCount: 5 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid mode')
  })
})

describe('AIGenerateForm — client mode contract', () => {
  it('does not forward the raw "aitopic"/"aiurl" tab id as the API mode', () => {
    const src = readFileSync(
      join(__dirname, '../components/host/builder/AIGenerateForm.tsx'),
      'utf8',
    )
    // The JSON body must map the tab id to the API contract value. A bare
    // `mode,` shorthand ships the internal tab id and brings back the
    // "Invalid mode" 400. Require the explicit mapping instead.
    expect(src).toContain("mode === 'aitopic' ? 'topic' : 'url'")
  })
})
