// Unit tests for scheduled self-paced quiz feature.
// Covers publish validation, async GET scheduled state, start gate, answer
// close-time grace, and confidence persistence.
//
// Mock scaffolding mirrors async-quiz-api.test.ts — prisma fully mocked via
// vi.hoisted, route handlers imported directly, req()/params() helpers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockUser = { id: 'user-1', email: 'host@example.com' }

const prismaMock = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn(), findMany: vi.fn() },
  quizVersion: { create: vi.fn(), findUnique: vi.fn() },
  gameSession: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  attendee: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  answer: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUser: vi.fn(async () => mockUser),
}))
vi.mock('@/lib/billing', () => ({
  getUserPlan: vi.fn(async () => 'free'),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: vi.fn(async () => ({ ok: true })),
  rateLimitResponse: vi.fn(() => new Response('rate limited', { status: 429 })),
}))

import { POST as publishPost, PATCH as publishPatch } from '../app/api/quizzes/[id]/publish/route'
import { GET as asyncGet } from '../app/api/async/[slug]/route'
import { POST as startPost } from '../app/api/async/[slug]/start/route'
import { POST as answerPost } from '../app/api/async/[slug]/answer/route'

// ─── Helpers ────────────────────────────────────────────────────────────────

function req(url: string, body?: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
}

function getReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) }
}

// ─── Shared quiz fixture ─────────────────────────────────────────────────────

const baseQuiz = {
  id: 'quiz-1',
  userId: 'user-1',
  title: 'Scheduled Test Quiz',
  subject: 'Science',
  language: 'English',
  theme: null,
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  questions: [
    { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  ],
}

const baseVersionCreate = { id: 'version-new', questionCount: 1, createdAt: new Date('2026-06-01T10:00:01Z') }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.quiz.findFirst.mockResolvedValue(baseQuiz)
  prismaMock.gameSession.findFirst.mockResolvedValue(null)
  prismaMock.gameSession.findUnique.mockResolvedValue(null)
  prismaMock.gameSession.count.mockResolvedValue(0)
  prismaMock.quizVersion.create.mockResolvedValue(baseVersionCreate)
  prismaMock.gameSession.create.mockResolvedValue({
    id: 'session-1',
    shareSlug: 'sched1234',
    allowRetries: false,
    opensAt: null,
    closesAt: null,
    timeLimitMinutes: null,
    createdAt: new Date('2026-06-01T10:00:01Z'),
    participantCount: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Publish POST — scheduling validation ────────────────────────────────────

describe('publish POST — scheduled quiz validation', () => {
  it('returns 400 when opensAt is set but no closesAt is provided', async () => {
    const opensAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const res = await publishPost(
      req('http://localhost/api/quizzes/quiz-1/publish', { opensAt }),
      params({ id: 'quiz-1' }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/close time|needs a close time/i)
  })

  it('returns 400 when opensAt >= closesAt', async () => {
    const now = Date.now()
    const opensAt = new Date(now + 10 * 60 * 1000).toISOString()
    const closesAt = new Date(now + 5 * 60 * 1000).toISOString() // earlier than opensAt
    const res = await publishPost(
      req('http://localhost/api/quizzes/quiz-1/publish', { opensAt, closesAt }),
      params({ id: 'quiz-1' }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/close time must be after/i)
  })

  it('returns 400 when opensAt is more than 60s in the past', async () => {
    const opensAt = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
    const closesAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const res = await publishPost(
      req('http://localhost/api/quizzes/quiz-1/publish', { opensAt, closesAt }),
      params({ id: 'quiz-1' }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/in the past/i)
  })

  it('returns 200 with echoed opensAt/closesAt and calls gameSession.create with Date values', async () => {
    const opensAt = new Date(Date.now() + 10 * 60 * 1000)
    const closesAt = new Date(Date.now() + 60 * 60 * 1000)

    // Mock create to echo back the schedule fields
    prismaMock.gameSession.create.mockResolvedValue({
      id: 'session-sched',
      shareSlug: 'sched5678',
      allowRetries: false,
      opensAt,
      closesAt,
      timeLimitMinutes: null,
      createdAt: new Date(),
      participantCount: 0,
    })

    const res = await publishPost(
      req('http://localhost/api/quizzes/quiz-1/publish', {
        opensAt: opensAt.toISOString(),
        closesAt: closesAt.toISOString(),
      }),
      params({ id: 'quiz-1' }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // Response echoes the schedule
    expect(json.data.opensAt).toBeTruthy()
    expect(json.data.closesAt).toBeTruthy()

    // gameSession.create called with Date objects
    expect(prismaMock.gameSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opensAt: expect.any(Date),
          closesAt: expect.any(Date),
        }),
      }),
    )
  })
})

// ─── Publish PATCH — scheduling validation ───────────────────────────────────

describe('publish PATCH — scheduled quiz validation', () => {
  it('returns 400 when setting opensAt on a session that has no closesAt', async () => {
    // Existing session has opensAt=null and closesAt=null
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      shareSlug: 'abc123',
      allowRetries: false,
      opensAt: null,
      closesAt: null,
    })

    const opensAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    // Not providing closesAt — effective closesAt remains null
    const res = await publishPatch(
      req('http://localhost/api/quizzes/quiz-1/publish', { opensAt }, 'PATCH'),
      params({ id: 'quiz-1' }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/close time|needs a close time/i)
  })
})

// ─── async GET — scheduled state ─────────────────────────────────────────────

describe('async GET — scheduled state', () => {
  it('returns state:scheduled with serverNow when opensAt is in the future', async () => {
    const opensAt = new Date(Date.now() + 30 * 60 * 1000)
    const closesAt = new Date(Date.now() + 90 * 60 * 1000)

    prismaMock.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      mode: 'async',
      status: 'open',
      allowRetries: false,
      opensAt,
      closesAt,
      timeLimitMinutes: null,
      quizVersion: {
        title: 'Scheduled Quiz',
        subject: 'Science',
        questionCount: 1,
        snapshot: [
          { id: 'q1', type: 'mcq', text: 'Q1', options: ['A', 'B'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
        ],
      },
    })

    const res = await asyncGet(getReq('http://localhost/api/async/sched1234'), params({ slug: 'sched1234' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.state).toBe('scheduled')
    expect(json.data.serverNow).toBeTruthy()
    expect(json.data.opensAt).toBeTruthy()
    expect(json.data.questionCount).toBe(1)
    // Must NOT include open-state snapshot-derived fields
    expect(json.data.estimatedSeconds).toBeUndefined()
    expect(json.data.maxBaseScore).toBeUndefined()
  })
})

// ─── async start — not-open-yet gate ─────────────────────────────────────────

describe('async start — not-open-yet gate', () => {
  it('returns 403 with code:not_open_yet when opensAt is in the future', async () => {
    const opensAt = new Date(Date.now() + 15 * 60 * 1000)
    const closesAt = new Date(Date.now() + 90 * 60 * 1000)

    prismaMock.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      mode: 'async',
      status: 'open',
      opensAt,
      closesAt,
      allowRetries: false,
      timeLimitMinutes: null,
      userId: 'user-1',
      quizVersion: {
        snapshot: [
          { id: 'q1', type: 'mcq', text: 'Q1', options: ['A', 'B'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
        ],
        questionCount: 1,
      },
    })

    const res = await startPost(
      req('http://localhost/api/async/sched1234/start', { name: 'Alice' }),
      params({ slug: 'sched1234' }),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.code).toBe('not_open_yet')
    expect(json.opensAt).toBeTruthy()
    expect(json.serverNow).toBeTruthy()
  })
})

// ─── async answer — closesAt grace window ────────────────────────────────────

describe('async answer — closesAt grace window', () => {
  // Base session for answer tests — already open and within grace
  const answerSession = (closesAt: Date) => ({
    id: 'session-1',
    mode: 'async',
    status: 'open',
    opensAt: null,
    closesAt,
    quizVersion: {
      snapshot: [
        { id: 'q1', type: 'mcq', text: 'Q1', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
      ],
    },
  })

  const answerBody = {
    participantId: 'pid-1',
    attendeeId: 'att-1',
    questionIndex: 0,
    answer: '0',
    timeMs: 3000,
  }

  beforeEach(() => {
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null })
    prismaMock.answer.findFirst.mockResolvedValue(null)
    prismaMock.answer.findMany.mockResolvedValue([])
    prismaMock.answer.create.mockResolvedValue({})
  })

  it('succeeds when closesAt was only 10 seconds ago (within 30s grace)', async () => {
    const closesAt = new Date(Date.now() - 10 * 1000) // 10s ago
    prismaMock.gameSession.findUnique.mockResolvedValue(answerSession(closesAt))

    const res = await answerPost(
      req('http://localhost/api/async/abc/answer', answerBody),
      params({ slug: 'abc' }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 410 with code:closed when closesAt was 120 seconds ago (past grace)', async () => {
    const closesAt = new Date(Date.now() - 120 * 1000) // 120s ago
    prismaMock.gameSession.findUnique.mockResolvedValue(answerSession(closesAt))

    const res = await answerPost(
      req('http://localhost/api/async/abc/answer', answerBody),
      params({ slug: 'abc' }),
    )
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.success).toBe(false)
    expect(json.code).toBe('closed')
  })
})

// ─── async answer — confidence persistence ───────────────────────────────────

describe('async answer — confidence persistence', () => {
  const openSession = {
    id: 'session-1',
    mode: 'async',
    status: 'open',
    opensAt: null,
    closesAt: null,
    quizVersion: {
      snapshot: [
        { id: 'q1', type: 'mcq', text: 'Q1', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
      ],
    },
  }

  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue(openSession)
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null })
    prismaMock.answer.findFirst.mockResolvedValue(null)
    prismaMock.answer.findMany.mockResolvedValue([])
    prismaMock.answer.create.mockResolvedValue({})
  })

  it("persists confidence:'sure' when provided", async () => {
    await answerPost(
      req('http://localhost/api/async/abc/answer', {
        participantId: 'pid-1',
        attendeeId: 'att-1',
        questionIndex: 0,
        answer: '0',
        timeMs: 2000,
        confidence: 'sure',
      }),
      params({ slug: 'abc' }),
    )

    expect(prismaMock.answer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confidence: 'sure' }),
      }),
    )
  })

  it('persists confidence:null when an invalid value is sent', async () => {
    await answerPost(
      req('http://localhost/api/async/abc/answer', {
        participantId: 'pid-1',
        attendeeId: 'att-1',
        questionIndex: 0,
        answer: '0',
        timeMs: 2000,
        confidence: 'maybe', // invalid
      }),
      params({ slug: 'abc' }),
    )

    expect(prismaMock.answer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confidence: null }),
      }),
    )
  })
})
