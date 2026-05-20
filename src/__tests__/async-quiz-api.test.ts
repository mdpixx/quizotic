import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import { POST as publishPost, DELETE as publishDelete } from '../app/api/quizzes/[id]/publish/route'
import { POST as finishPost } from '../app/api/async/[slug]/finish/route'

function req(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) }
}

beforeEach(() => {
  vi.clearAllMocks()

  prismaMock.quiz.findFirst.mockResolvedValue({
    id: 'quiz-1',
    userId: 'user-1',
    title: 'Solar System',
    subject: 'Science',
    language: 'English',
    theme: null,
    updatedAt: new Date('2026-05-20T10:00:00Z'),
    questions: [
      { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
      { id: 'p1', type: 'poll', text: 'Favorite planet?', options: ['Earth', 'Saturn'], timerSeconds: 20, points: 0 },
    ],
  })
  prismaMock.gameSession.count.mockResolvedValue(0)
  prismaMock.quizVersion.create.mockResolvedValue({ id: 'version-new', questionCount: 1, createdAt: new Date('2026-05-20T10:00:01Z') })
  prismaMock.gameSession.create.mockResolvedValue({
    id: 'session-1',
    shareSlug: 'abc123xy',
    allowRetries: false,
    closesAt: null,
    createdAt: new Date('2026-05-20T10:00:01Z'),
    participantCount: 0,
  })
})

describe('async publish API', () => {
  it('creates an async session with an auto-gradeable snapshot', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue(null)
    prismaMock.gameSession.findUnique.mockResolvedValue(null)

    const res = await publishPost(req('http://localhost/api/quizzes/quiz-1/publish'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.questionCount).toBe(1)
    expect(prismaMock.quizVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        snapshot: [expect.objectContaining({ id: 'q1' })],
        questionCount: 1,
      }),
    }))
    expect(prismaMock.gameSession.create).toHaveBeenCalledOnce()
  })

  it('republishes an existing open link when the quiz changed after the snapshot', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      shareSlug: 'oldslug1',
      allowRetries: true,
      closesAt: null,
      participantCount: 4,
      createdAt: new Date('2026-05-19T10:00:00Z'),
      quizVersionId: 'version-old',
      quizVersion: { questionCount: 1, createdAt: new Date('2026-05-19T10:00:00Z') },
    })

    const res = await publishPost(req('http://localhost/api/quizzes/quiz-1/publish'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.shareSlug).toBe('oldslug1')
    expect(json.data.republished).toBe(true)
    expect(prismaMock.quizVersion.create).toHaveBeenCalledOnce()
    expect(prismaMock.gameSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { quizVersionId: 'version-new' },
    })
  })

  it('deactivates only the owner active async link', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue({ id: 'session-1' })
    prismaMock.gameSession.update.mockResolvedValue({})

    const res = await publishDelete(new NextRequest('http://localhost/api/quizzes/quiz-1/publish'), params({ id: 'quiz-1' }))

    expect(res.status).toBe(200)
    expect(prismaMock.gameSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: 'ended', endedAt: expect.any(Date) },
    })
  })
})

describe('async finish API', () => {
  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      mode: 'async',
      quizVersion: { questionCount: 2 },
    })
    prismaMock.answer.findMany.mockResolvedValue([
      { points: 1000, isCorrect: true },
      { points: 0, isCorrect: false },
    ])
    prismaMock.attendee.findMany.mockResolvedValue([{ finalScore: 1000 }, { finalScore: 500 }])
  })

  it('finalizes once and increments participantCount once', async () => {
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', sessionId: 'session-1', leftAt: null, finalScore: 0 })
    prismaMock.attendee.updateMany.mockResolvedValue({ count: 1 })

    const res = await finishPost(req('http://localhost/api/async/abc/finish', { participantId: 'pid-1', attendeeId: 'att-1' }), params({ slug: 'abc' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.finalScore).toBe(1000)
    expect(json.data.correctCount).toBe(1)
    expect(json.data.questionCount).toBe(2)
    expect(prismaMock.gameSession.update).toHaveBeenCalledOnce()
  })

  it('is idempotent for already-finished attendees', async () => {
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', sessionId: 'session-1', leftAt: new Date(), finalScore: 1000 })
    prismaMock.attendee.updateMany.mockResolvedValue({ count: 0 })

    const res = await finishPost(req('http://localhost/api/async/abc/finish', { participantId: 'pid-1', attendeeId: 'att-1' }), params({ slug: 'abc' }))

    expect(res.status).toBe(200)
    expect(prismaMock.gameSession.update).not.toHaveBeenCalled()
  })
})
