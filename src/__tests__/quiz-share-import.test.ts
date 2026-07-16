// Share-a-copy links: owner-side create/revoke (share-link route) and
// recipient-side clone (import route). Prisma/auth/billing/rate-limit are
// mocked; handlers are called directly, matching async-quiz-api.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockUser = { id: 'user-1', email: 'host@example.com' }

const prismaMock = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  quizShareLink: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}))

const getCurrentUserMock = vi.hoisted(() => vi.fn(async (): Promise<{ id: string; email: string } | null> => mockUser))
const getUserPlanMock = vi.hoisted(() => vi.fn(async () => 'free'))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth-helpers', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/billing', () => ({ getUserPlan: getUserPlanMock }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: vi.fn(async () => ({ ok: true })),
  rateLimitResponse: vi.fn(() => new Response('rate limited', { status: 429 })),
}))

import { POST as shareLinkPost, DELETE as shareLinkDelete } from '../app/api/quizzes/[id]/share-link/route'
import { POST as importPost } from '../app/api/import/[token]/route'

function req(url: string, method = 'POST') {
  return new NextRequest(url, { method })
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) }
}

const sourceQuestions = [
  { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'q2', type: 'poll', text: 'Favorite planet?', options: ['Earth', 'Saturn'], timerSeconds: 20, points: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUserMock.mockResolvedValue(mockUser)
  getUserPlanMock.mockResolvedValue('free')
})

describe('share-link POST', () => {
  beforeEach(() => {
    prismaMock.quiz.findFirst.mockResolvedValue({ id: 'quiz-1', questions: sourceQuestions })
    prismaMock.quizShareLink.findFirst.mockResolvedValue(null)
    prismaMock.quizShareLink.create.mockResolvedValue({ token: 'tok_new', importCount: 0, createdAt: new Date() })
  })

  it('creates a high-entropy link for an owned quiz', async () => {
    const res = await shareLinkPost(req('http://localhost/api/quizzes/quiz-1/share-link'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.created).toBe(true)
    expect(json.data.url).toBe('/import/tok_new')
    const createdWith = prismaMock.quizShareLink.create.mock.calls[0][0].data
    expect(createdWith.quizId).toBe('quiz-1')
    expect(createdWith.token.length).toBeGreaterThanOrEqual(22)
  })

  it('reuses the active link instead of rotating the token', async () => {
    prismaMock.quizShareLink.findFirst.mockResolvedValue({ token: 'tok_live', importCount: 3, createdAt: new Date() })

    const res = await shareLinkPost(req('http://localhost/api/quizzes/quiz-1/share-link'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.token).toBe('tok_live')
    expect(json.data.importCount).toBe(3)
    expect(json.data.created).toBe(false)
    expect(prismaMock.quizShareLink.create).not.toHaveBeenCalled()
  })

  it('404s for a quiz the caller does not own', async () => {
    prismaMock.quiz.findFirst.mockResolvedValue(null)

    const res = await shareLinkPost(req('http://localhost/api/quizzes/quiz-9/share-link'), params({ id: 'quiz-9' }))

    expect(res.status).toBe(404)
    expect(prismaMock.quizShareLink.create).not.toHaveBeenCalled()
  })

  it('400s when the quiz has no questions', async () => {
    prismaMock.quiz.findFirst.mockResolvedValue({ id: 'quiz-1', questions: [] })

    const res = await shareLinkPost(req('http://localhost/api/quizzes/quiz-1/share-link'), params({ id: 'quiz-1' }))

    expect(res.status).toBe(400)
  })

  it('401s when signed out', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const res = await shareLinkPost(req('http://localhost/api/quizzes/quiz-1/share-link'), params({ id: 'quiz-1' }))

    expect(res.status).toBe(401)
  })
})

describe('share-link DELETE', () => {
  it('revokes the active link for an owned quiz', async () => {
    prismaMock.quiz.findFirst.mockResolvedValue({ id: 'quiz-1' })
    prismaMock.quizShareLink.updateMany.mockResolvedValue({ count: 1 })

    const res = await shareLinkDelete(req('http://localhost/api/quizzes/quiz-1/share-link', 'DELETE'), params({ id: 'quiz-1' }))

    expect(res.status).toBe(200)
    expect(prismaMock.quizShareLink.updateMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('404s for a quiz the caller does not own', async () => {
    prismaMock.quiz.findFirst.mockResolvedValue(null)

    const res = await shareLinkDelete(req('http://localhost/api/quizzes/quiz-9/share-link', 'DELETE'), params({ id: 'quiz-9' }))

    expect(res.status).toBe(404)
    expect(prismaMock.quizShareLink.updateMany).not.toHaveBeenCalled()
  })
})

describe('import POST', () => {
  const sourceQuiz = {
    userId: 'owner-2',
    title: 'Solar System',
    subject: 'Science',
    language: 'English',
    theme: 'space',
    questions: sourceQuestions,
    selfPaced: true,
    timeLimitMinutes: 30,
    allowRetries: true,
  }

  beforeEach(() => {
    prismaMock.quizShareLink.findUnique.mockResolvedValue({ id: 'link-1', revokedAt: null, quiz: sourceQuiz })
    prismaMock.quiz.count.mockResolvedValue(2)
    prismaMock.quiz.create.mockResolvedValue({ id: 'quiz-new' })
    prismaMock.quizShareLink.update.mockResolvedValue({})
  })

  it('clones the quiz into the importer library with fresh question ids', async () => {
    const res = await importPost(req('http://localhost/api/import/tok_live'), params({ token: 'tok_live' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.quizId).toBe('quiz-new')

    const data = prismaMock.quiz.create.mock.calls[0][0].data
    expect(data.userId).toBe('user-1')
    expect(data.title).toBe('Solar System')
    expect(data.selfPaced).toBe(true)
    expect(data.timeLimitMinutes).toBe(30)
    expect(data.allowRetries).toBe(true)
    // Row-level fields must never transfer from the source quiz.
    expect(data.id).toBeUndefined()
    // Questions keep content but get fresh ids.
    expect(data.questions).toHaveLength(2)
    expect(data.questions[0].text).toBe('Closest planet?')
    expect(data.questions[0].correctAnswer).toBe('0')
    const sourceIds = sourceQuestions.map(q => q.id)
    for (const q of data.questions) {
      expect(sourceIds).not.toContain(q.id)
    }

    expect(prismaMock.quizShareLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { importCount: { increment: 1 } },
    })
  })

  it('403 LIBRARY_FULL when the free library is at its limit', async () => {
    prismaMock.quiz.count.mockResolvedValue(20)

    const res = await importPost(req('http://localhost/api/import/tok_live'), params({ token: 'tok_live' }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('LIBRARY_FULL')
    expect(prismaMock.quiz.create).not.toHaveBeenCalled()
  })

  it('410 REVOKED for a turned-off link', async () => {
    prismaMock.quizShareLink.findUnique.mockResolvedValue({ id: 'link-1', revokedAt: new Date(), quiz: sourceQuiz })

    const res = await importPost(req('http://localhost/api/import/tok_dead'), params({ token: 'tok_dead' }))
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.code).toBe('REVOKED')
    expect(prismaMock.quiz.create).not.toHaveBeenCalled()
  })

  it('404 NOT_FOUND for an unknown token', async () => {
    prismaMock.quizShareLink.findUnique.mockResolvedValue(null)

    const res = await importPost(req('http://localhost/api/import/garbage'), params({ token: 'garbage' }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })

  it('409 SELF_IMPORT when the owner opens their own link', async () => {
    prismaMock.quizShareLink.findUnique.mockResolvedValue({
      id: 'link-1',
      revokedAt: null,
      quiz: { ...sourceQuiz, userId: 'user-1' },
    })

    const res = await importPost(req('http://localhost/api/import/tok_live'), params({ token: 'tok_live' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe('SELF_IMPORT')
    expect(prismaMock.quiz.create).not.toHaveBeenCalled()
  })

  it('401s when signed out', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const res = await importPost(req('http://localhost/api/import/tok_live'), params({ token: 'tok_live' }))

    expect(res.status).toBe(401)
  })
})
