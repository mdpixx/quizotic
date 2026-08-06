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

  // Self-paced play has no per-question timer, so there is no speed bonus and a
  // correct answer is worth its full points — that is what the Assign modal
  // promises the host. This used to fall out of calcPoints() only because the
  // client always posted timeMs: 0; a client that reported a real elapsed time
  // would have started docking points with no code change anywhere.
  it('awards full points for a correct answer regardless of elapsed time', async () => {
    const scores: number[] = []
    for (const timeMs of [0, 5000, 19_000, 60_000]) {
      prismaMock.answer.create.mockClear()
      const res = await answerPost(req('http://localhost/api/async/abc/answer', {
        participantId: 'pid-1',
        attendeeId: 'att-1',
        questionIndex: 1,
        answer: '0',
        timeMs,
      }), params({ slug: 'abc' }))
      const json = await res.json()
      expect(json.data.isCorrect).toBe(true)
      scores.push(json.data.points)
      expect(prismaMock.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isCorrect: true, basePoints: 1000, timeMs }),
      })
    }
    expect(new Set(scores).size).toBe(1)
    expect(scores[0]).toBe(1000)
  })

  it('still awards zero for a wrong answer', async () => {
    const res = await answerPost(req('http://localhost/api/async/abc/answer', {
      participantId: 'pid-1',
      attendeeId: 'att-1',
      questionIndex: 1,
      answer: '1',
      timeMs: 1000,
    }), params({ slug: 'abc' }))
    const json = await res.json()

    expect(json.data.isCorrect).toBe(false)
    expect(json.data.points).toBe(0)
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
    // "Next" means the next UNANSWERED question in this participant's serve
    // order, not the next one by snapshot position — that distinction is what
    // makes shuffled serving work. So reaching the last answerable question
    // (index 3) requires the earlier one (index 1) to already be on record.
    prismaMock.answer.findMany.mockResolvedValue([{ questionIndex: 1, isCorrect: true }])

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

// ─── Shuffling ───────────────────────────────────────────────────────────────
// Scheduled quizzes shuffle question order per participant by default. The
// serve order is DERIVED from (sessionId, participantId) rather than stored, so
// the properties worth pinning at the API boundary are: it is honoured, it is
// stable across a resume, a name-capture slide stays first, and turning it off
// restores authored order.

const SHUFFLE_SNAPSHOT = [
  { id: 'n0', type: 'openended', text: 'Enter your full name (as per records)', isNameCapture: true, timerSeconds: 30, points: 1000 },
  { id: 'q1', type: 'mcq', text: 'Q1', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'q2', type: 'mcq', text: 'Q2', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'q3', type: 'mcq', text: 'Q3', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'q4', type: 'mcq', text: 'Q4', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'q5', type: 'mcq', text: 'Q5', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
]

function shuffleSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    mode: 'async',
    status: 'open',
    userId: null,
    allowRetries: false,
    opensAt: null,
    closesAt: null,
    timeLimitMinutes: null,
    shuffleQuestions: true,
    shuffleOptions: true,
    quizVersion: { snapshot: SHUFFLE_SNAPSHOT, questionCount: 6 },
    ...overrides,
  }
}

describe('async serving — shuffled question order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.attendee.create.mockResolvedValue({ id: 'att-9' })
    prismaMock.answer.count.mockResolvedValue(0)
  })

  async function firstServedFor(participantId: string, session = shuffleSession()) {
    prismaMock.gameSession.findUnique.mockResolvedValue(session)
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null, finalScore: 0 })
    prismaMock.answer.findMany.mockResolvedValue([])
    const res = await statePost(
      req('http://localhost/api/async/abc/state', { participantId, attendeeId: 'att-1' }),
      params({ slug: 'abc' }),
    )
    return (await res.json()).data
  }

  it('pins the name-capture slide first for every participant', async () => {
    for (const p of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      const data = await firstServedFor(p)
      expect(data.nextQuestion.index).toBe(0)
      expect(data.nextQuestion.ordinal).toBe(1)
    }
  })

  it('serves a different second question to different participants', async () => {
    const seconds = new Set<number>()
    for (let i = 0; i < 12; i++) {
      prismaMock.gameSession.findUnique.mockResolvedValue(shuffleSession())
      prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null, finalScore: 0 })
      // Name slide already answered — next is the first shuffled question.
      prismaMock.answer.findMany.mockResolvedValue([{ questionIndex: 0, points: 0, isCorrect: null }])
      const res = await statePost(
        req('http://localhost/api/async/abc/state', { participantId: `pid-${i}`, attendeeId: 'att-1' }),
        params({ slug: 'abc' }),
      )
      seconds.add((await res.json()).data.nextQuestion.index)
    }
    expect(seconds.size).toBeGreaterThan(1)
  })

  it('replays the identical sequence on resume', async () => {
    const a = await firstServedFor('stable-pid')
    const b = await firstServedFor('stable-pid')
    expect(a.nextQuestion.index).toBe(b.nextQuestion.index)
  })

  it('numbers ordinals by the participant sequence, not the snapshot', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(shuffleSession())
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null, finalScore: 0 })
    prismaMock.answer.findMany.mockResolvedValue([
      { questionIndex: 0, points: 0, isCorrect: null },
      { questionIndex: 4, points: 1000, isCorrect: true },
    ])
    const res = await statePost(
      req('http://localhost/api/async/abc/state', { participantId: 'pid-x', attendeeId: 'att-1' }),
      params({ slug: 'abc' }),
    )
    const q = (await res.json()).data.nextQuestion
    expect(q.total).toBe(6)
    expect(q.ordinal).toBeGreaterThanOrEqual(1)
    expect(q.ordinal).toBeLessThanOrEqual(6)
  })

  it('serves authored order when the host turns shuffling off', async () => {
    for (const p of ['p1', 'p2', 'p3']) {
      const data = await firstServedFor(p, shuffleSession({ shuffleQuestions: false }))
      expect(data.nextQuestion.index).toBe(0)
    }
    prismaMock.gameSession.findUnique.mockResolvedValue(shuffleSession({ shuffleQuestions: false }))
    prismaMock.attendee.findFirst.mockResolvedValue({ id: 'att-1', leftAt: null, deadlineAt: null, finalScore: 0 })
    prismaMock.answer.findMany.mockResolvedValue([{ questionIndex: 0, points: 0, isCorrect: null }])
    const res = await statePost(
      req('http://localhost/api/async/abc/state', { participantId: 'pid-1', attendeeId: 'att-1' }),
      params({ slug: 'abc' }),
    )
    expect((await res.json()).data.nextQuestion.index).toBe(1)
  })

  it('echoes shuffleOptions so the player can jumble its tiles', async () => {
    const on = await firstServedFor('pid-1')
    expect(on.shuffleOptions).toBe(true)
    const off = await firstServedFor('pid-1', shuffleSession({ shuffleOptions: false }))
    expect(off.shuffleOptions).toBe(false)
  })
})
