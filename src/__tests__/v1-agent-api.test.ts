import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const apiUser = { id: 'user-1', email: 'host@example.com' }

const prismaMock = vi.hoisted(() => ({
  quiz: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  quizVersion: { create: vi.fn() },
  gameSession: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  attendee: { findMany: vi.fn() },
  answer: { findMany: vi.fn() },
}))

const authMock = vi.hoisted(() => vi.fn(async () => apiUser))
const quotaMock = vi.hoisted(() => vi.fn(async () => ({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 25 })))
const logUsageMock = vi.hoisted(() => vi.fn(async () => {}))
const chatCreateMock = vi.hoisted(() => vi.fn(async () => ({
  choices: [{ message: { content: JSON.stringify([
    { type: 'mcq', text: 'What is 2+2?', options: ['3', '4', '5', '6'], correctAnswer: '1', timerSeconds: 20, points: 1000 },
  ]) } }],
})))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/api-key-auth', () => ({ authenticateApiKey: authMock }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: vi.fn(async () => ({ ok: true })),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate limited' }, { status: 429 })),
}))
vi.mock('@/lib/billing', () => ({ getUserPlan: vi.fn(async () => 'free') }))
vi.mock('@/lib/ai-quota', () => ({ checkAiQuota: quotaMock, logAiUsage: logUsageMock }))
vi.mock('openai', () => ({
  default: vi.fn(function MockOpenAI() {
    return { chat: { completions: { create: chatCreateMock } } }
  }),
}))

import { POST as createQuiz } from '../app/api/v1/quizzes/route'
import { POST as generateQuiz } from '../app/api/v1/quizzes/generate/route'
import { GET as getQuiz } from '../app/api/v1/quizzes/[id]/route'
import { POST as publishQuiz } from '../app/api/v1/quizzes/[id]/publish/route'
import { GET as getResults } from '../app/api/v1/sessions/[id]/results/route'

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer qz_test' },
  })
}

function getReq(url: string) {
  return new NextRequest(url, { headers: { Authorization: 'Bearer qz_test' } })
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OPENROUTER_API_KEY = 'sk-test'
  authMock.mockResolvedValue(apiUser)
  quotaMock.mockResolvedValue({ allowed: true, plan: 'free', used: 0, limit: 30, remaining: 25 })
  prismaMock.quiz.count.mockResolvedValue(0)
  prismaMock.quiz.create.mockResolvedValue({
    id: 'quiz-1',
    title: 'Math quiz',
    subject: 'Math',
    language: 'English',
    theme: null,
    questions: [],
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  })
})

describe('v1 agent quiz API', () => {
  it('creates a validated quiz for the API-key owner', async () => {
    const res = await createQuiz(jsonReq('http://localhost/api/v1/quizzes', {
      id: 'quiz-1',
      title: 'Math quiz',
      subject: 'Math',
      language: 'English',
      questions: [
        { type: 'mcq', text: 'What is 2+2?', options: ['3', '4'], correctAnswer: '1', timerSeconds: 20, points: 1000 },
      ],
    }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.id).toBe('quiz-1')
    expect(prismaMock.quiz.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', title: 'Math quiz' }),
    }))
  })

  it('rejects missing API keys', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await createQuiz(jsonReq('http://localhost/api/v1/quizzes', { title: 'Nope', questions: [] }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe('unauthorized')
  })

  it('generates questions through the metered AI path', async () => {
    const res = await generateQuiz(jsonReq('http://localhost/api/v1/quizzes/generate', {
      mode: 'topic',
      topic: 'basic arithmetic',
      questionCount: 3,
      difficulty: 'easy',
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.questions).toHaveLength(1)
    expect(quotaMock).toHaveBeenCalledWith('user-1', 'ai_generate', 3)
    expect(logUsageMock).toHaveBeenCalledWith('user-1', 'ai_generate', expect.objectContaining({ mode: 'topic', questionCount: 3 }))
  })

  it('does not call the model when quota is exhausted', async () => {
    quotaMock.mockResolvedValueOnce({ allowed: false, plan: 'free', used: 30, limit: 30, remaining: 0 })
    const res = await generateQuiz(jsonReq('http://localhost/api/v1/quizzes/generate', {
      mode: 'text',
      text: 'Long enough source text for a small test quiz about arithmetic and number sense.',
      questionCount: 5,
    }))

    expect(res.status).toBe(429)
    expect(chatCreateMock).not.toHaveBeenCalled()
  })

  it('returns one owned quiz by id', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce({
      id: 'quiz-1',
      title: 'Math',
      subject: null,
      language: null,
      theme: null,
      questions: [],
      createdAt: new Date('2026-06-01T10:00:00Z'),
      updatedAt: new Date('2026-06-01T10:00:00Z'),
    })

    const res = await getQuiz(getReq('http://localhost/api/v1/quizzes/quiz-1'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.id).toBe('quiz-1')
  })

  it('publishes an owned quiz as a self-paced link', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce({
      id: 'quiz-1',
      title: 'Math',
      subject: null,
      language: null,
      theme: null,
      updatedAt: new Date('2026-06-01T10:00:00Z'),
      questions: [{ id: 'q1', type: 'mcq', text: '2+2?', options: ['3', '4'], correctAnswer: '1', timerSeconds: 20, points: 1000 }],
    })
    prismaMock.gameSession.findFirst.mockResolvedValueOnce(null)
    prismaMock.gameSession.findUnique.mockResolvedValue(null)
    prismaMock.quizVersion.create.mockResolvedValueOnce({ id: 'version-1', questionCount: 1, createdAt: new Date('2026-06-01T10:00:00Z') })
    prismaMock.gameSession.create.mockResolvedValueOnce({ id: 'session-1', shareSlug: 'abc123xy', allowRetries: false, closesAt: null, timeLimitMinutes: null })

    const res = await publishQuiz(jsonReq('http://localhost/api/v1/quizzes/quiz-1/publish', { allowRetries: true }), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.shareUrl).toBe(`/q/${json.data.shareSlug}`)
    expect(prismaMock.gameSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: 'async', status: 'open', userId: 'user-1', allowRetries: true, shareSlug: json.data.shareSlug }),
    }))
  })

  it('adds teacher insights to session results', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValueOnce({
      id: 'session-1',
      quizId: 'quiz-1',
      participantCount: 2,
      createdAt: new Date('2026-06-01T10:00:00Z'),
      endedAt: new Date('2026-06-01T10:10:00Z'),
      results: {
        leaderboard: [],
        questionStats: [{
          index: 0,
          text: 'Hard question',
          type: 'mcq',
          correctPct: 40,
          confidenceGrid: { sureCorrect: 0, sureWrong: 1, unsureCorrect: 1, unsureWrong: 0 },
          bloomsLevel: null,
          explanation: null,
          isNonScored: false,
        }],
      },
    })
    prismaMock.attendee.findMany.mockResolvedValueOnce([
      { nickname: 'A', email: null, joinedAt: new Date(), leftAt: new Date(), durationSec: 100, finalScore: 1000, team: null },
      { nickname: 'B', email: null, joinedAt: new Date(), leftAt: null, durationSec: null, finalScore: 0, team: null },
    ])

    const res = await getResults(getReq('http://localhost/api/v1/sessions/session-1/results'), params({ id: 'session-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.insights.weakestQuestions[0].text).toBe('Hard question')
    expect(json.data.insights.completion.completionRate).toBe(50)
  })
})
