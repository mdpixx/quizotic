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
import { POST as answerPost } from '../app/api/async/[slug]/answer/route'
import { POST as finishPost } from '../app/api/async/[slug]/finish/route'
import { POST as startPost } from '../app/api/async/[slug]/start/route'
import { POST as statePost } from '../app/api/async/[slug]/state/route'

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
  prismaMock.quizVersion.create.mockResolvedValue({ id: 'version-new', questionCount: 2, createdAt: new Date('2026-05-20T10:00:01Z') })
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
  it('creates an async session with the full mixed-question snapshot', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue(null)
    prismaMock.gameSession.findUnique.mockResolvedValue(null)

    const res = await publishPost(req('http://localhost/api/quizzes/quiz-1/publish'), params({ id: 'quiz-1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.questionCount).toBe(2)
    expect(prismaMock.quizVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        snapshot: [
          expect.objectContaining({ id: 'q1' }),
          expect.objectContaining({ id: 'p1' }),
        ],
        questionCount: 2,
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

describe('async answer API', () => {
  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      mode: 'async',
      status: 'open',
      closesAt: null,
      quizVersion: {
        snapshot: [
          { id: 'p1', type: 'poll', text: 'Favorite planet?', options: ['Earth', 'Saturn'], timerSeconds: 20, points: 1000 },
          { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
        ],
      },
    })
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null })
    prismaMock.answer.findFirst.mockResolvedValue(null)
    prismaMock.answer.findMany.mockResolvedValue([])
    prismaMock.answer.create.mockResolvedValue({})
  })

  it('records non-scored self-paced answers as participation without points', async () => {
    const res = await answerPost(req('http://localhost/api/async/abc/answer', {
      participantId: 'pid-1',
      attendeeId: 'att-1',
      questionIndex: 0,
      answer: '1',
      timeMs: 5000,
    }), params({ slug: 'abc' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.isCorrect).toBeNull()
    expect(json.data.points).toBe(0)
    expect(json.data.nextQuestion.index).toBe(1)
    expect(prismaMock.answer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isCorrect: null,
        basePoints: 0,
        streakBonus: 0,
        points: 0,
      }),
    })
  })
})

describe('async finish API', () => {
  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue({
      id: 'session-1',
      mode: 'async',
      quizVersion: {
        questionCount: 3,
        snapshot: [
          { id: 'q1', type: 'mcq' },
          { id: 'p1', type: 'poll' },
          { id: 'q2', type: 'truefalse' },
        ],
      },
    })
    prismaMock.answer.findMany.mockResolvedValue([
      { points: 1000, isCorrect: true, questionIndex: 0 },
      { points: 0, isCorrect: null, questionIndex: 1 },
      { points: 0, isCorrect: false, questionIndex: 2 },
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
    expect(json.data.questionCount).toBe(3)
    expect(json.data.scoredQuestionCount).toBe(2)
    expect(json.data.participationAnsweredCount).toBe(1)
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

// ─── Leaderboard-slide skipping ──────────────────────────────────────────────
// Host-placed leaderboard slides are live-session flow markers; the async
// player must never be served one (it has no input renderer, so serving one
// permanently wedges the attempt). Slides at the start, middle, and end of
// the snapshot each exercise a different serving path.

const LB_SNAPSHOT = [
  { id: 'lb0', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
  { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'lb2', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
  { id: 'p3', type: 'poll', text: 'Favorite planet?', options: ['Earth', 'Saturn'], timerSeconds: 20, points: 0 },
  { id: 'lb4', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
]

function lbSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    mode: 'async',
    status: 'open',
    userId: null,
    allowRetries: false,
    opensAt: null,
    closesAt: null,
    timeLimitMinutes: null,
    quizVersion: { snapshot: LB_SNAPSHOT, questionCount: 5 },
    ...overrides,
  }
}

describe('async start API — leaderboard slides', () => {
  it('serves the first answerable question, not a leading slide, with answerable counts', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(lbSession())
    prismaMock.attendee.create.mockResolvedValue({ id: 'att-9' })

    const res = await startPost(req('http://localhost/api/async/abc/start', { name: 'Asha' }), params({ slug: 'abc' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.question.index).toBe(1)
    expect(json.data.question.ordinal).toBe(1)
    expect(json.data.question.total).toBe(2)
    expect(json.data.total).toBe(2)
  })
})

describe('async answer API — leaderboard slides', () => {
  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue(lbSession())
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null })
    prismaMock.answer.findFirst.mockResolvedValue(null)
    prismaMock.answer.findMany.mockResolvedValue([])
    prismaMock.answer.create.mockResolvedValue({})
  })

  function submit(questionIndex: number, answer: unknown) {
    return answerPost(req('http://localhost/api/async/abc/answer', {
      participantId: 'pid-1', attendeeId: 'att-1', questionIndex, answer, timeMs: 5000,
    }), params({ slug: 'abc' }))
  }

  it('skips a middle slide when serving nextQuestion', async () => {
    const json = await (await submit(1, '0')).json()

    expect(json.data.nextQuestion.index).toBe(3)
    expect(json.data.nextQuestion.ordinal).toBe(2)
    expect(json.data.nextQuestion.total).toBe(2)
  })

  it('ends the quiz over a trailing slide (nextQuestion null)', async () => {
    const json = await (await submit(3, '1')).json()

    expect(json.data.nextQuestion).toBeNull()
  })

  it('skips slides on the cached-idempotent duplicate-submit path too', async () => {
    prismaMock.answer.findFirst.mockResolvedValue({ isCorrect: true, points: 800 })

    const json = await (await submit(1, '0')).json()

    expect(json.data.nextQuestion.index).toBe(3)
    expect(prismaMock.answer.create).not.toHaveBeenCalled()
  })

  it('rejects a submit aimed at a leaderboard index', async () => {
    const res = await submit(2, '0')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('invalid_answer')
  })
})

describe('async state API — leaderboard slides', () => {
  function stateReq() {
    return statePost(req('http://localhost/api/async/abc/state', { participantId: 'pid-1', attendeeId: 'att-1' }), params({ slug: 'abc' }))
  }

  beforeEach(() => {
    prismaMock.gameSession.findUnique.mockResolvedValue(lbSession())
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, finalScore: null, deadlineAt: null })
  })

  it('resumes on the next answerable question, never a slide (pre-fix stuck shape)', async () => {
    prismaMock.answer.findMany.mockResolvedValue([{ questionIndex: 1, points: 1000, isCorrect: true }])

    const json = await (await stateReq()).json()

    expect(json.data.status).toBe('in_progress')
    expect(json.data.nextQuestion.index).toBe(3)
    expect(json.data.nextQuestion.total).toBe(2)
    expect(json.data.answeredCount).toBe(1)
    expect(json.data.total).toBe(2)
  })

  it('auto-finalizes when every answerable question is answered (only slides left)', async () => {
    prismaMock.answer.findMany.mockResolvedValue([
      { questionIndex: 1, points: 1000, isCorrect: true },
      { questionIndex: 3, points: 0, isCorrect: null },
    ])
    prismaMock.attendee.updateMany.mockResolvedValue({ count: 1 })

    const json = await (await stateReq()).json()

    expect(json.data.status).toBe('finished')
    expect(json.data.result.finalScore).toBe(1000)
    expect(json.data.result.questionCount).toBe(2)
    expect(prismaMock.attendee.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ leftAt: null }),
    }))
    expect(prismaMock.gameSession.update).toHaveBeenCalledOnce()
  })

  it('auto-finalize is idempotent when another request finalized first', async () => {
    prismaMock.answer.findMany.mockResolvedValue([
      { questionIndex: 1, points: 1000, isCorrect: true },
      { questionIndex: 3, points: 0, isCorrect: null },
    ])
    prismaMock.attendee.updateMany.mockResolvedValue({ count: 0 })

    const json = await (await stateReq()).json()

    expect(json.data.status).toBe('finished')
    expect(prismaMock.gameSession.update).not.toHaveBeenCalled()
  })
})

describe('async finish API — leaderboard slides', () => {
  it('reports questionCount excluding slides', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(lbSession())
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', sessionId: 'session-1', leftAt: null, finalScore: 0 })
    prismaMock.answer.findMany.mockResolvedValue([
      { points: 1000, isCorrect: true, questionIndex: 1 },
      { points: 0, isCorrect: null, questionIndex: 3 },
    ])
    prismaMock.attendee.updateMany.mockResolvedValue({ count: 1 })

    const json = await (await finishPost(req('http://localhost/api/async/abc/finish', { participantId: 'pid-1', attendeeId: 'att-1' }), params({ slug: 'abc' }))).json()

    expect(json.data.questionCount).toBe(2)
    expect(json.data.scoredQuestionCount).toBe(1)
    expect(json.data.participationAnsweredCount).toBe(1)
  })
})
