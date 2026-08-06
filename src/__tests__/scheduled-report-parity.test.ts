import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// A scheduled quiz should report through the same template, with the same
// details, as a live one. The clearest way that broke: leaderboard "flow"
// slides live in the questions[] snapshot but are never SERVED in a self-paced
// attempt (lib/scoring.ts skips them), so any report builder that walks the
// snapshot un-filtered invents a phantom question with zero responses. The live
// builders already filter (report-data.ts, sessions/[id]/matrix); this one did
// not, which made a scheduled report visibly different from a live one.

const mockUser = { id: 'user-1', email: 'host@example.com' }

const prismaMock = vi.hoisted(() => ({
  gameSession: { findFirst: vi.fn() },
  attendee: { findMany: vi.fn() },
  answer: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth-helpers', () => ({ getCurrentUser: vi.fn(async () => mockUser) }))
vi.mock('@/lib/billing', () => ({ getUserPlan: vi.fn(async () => 'free') }))

import { GET as reportGet } from '../app/api/quizzes/[id]/report/route'

// Leaderboard slides deliberately bracket and separate the real questions, so a
// filter that only trimmed the ends would still fail this.
const SNAPSHOT = [
  { id: 'lb0', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
  { id: 'q1', type: 'mcq', text: 'Closest planet?', options: ['Mercury', 'Mars'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'lb2', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
  { id: 'p3', type: 'poll', text: 'Favorite planet?', options: ['Earth', 'Saturn'], timerSeconds: 20, points: 0 },
  { id: 'lb4', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 },
]

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

describe('scheduled quiz report — leaderboard slides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      shareSlug: 'abc12345',
      status: 'ended',
      allowRetries: false,
      closesAt: null,
      participantCount: 2,
      createdAt: new Date('2026-06-27T10:00:00Z'),
      quizVersion: { title: 'Space', subject: 'Science', questionCount: 2, snapshot: SNAPSHOT },
    })
    prismaMock.attendee.findMany.mockResolvedValue([
      { id: 'att-1', nickname: 'Asha', joinedAt: new Date('2026-06-27T10:01:00Z'), leftAt: new Date('2026-06-27T10:05:00Z'), finalScore: 1000 },
    ])
    prismaMock.answer.findMany.mockResolvedValue([
      { questionIndex: 1, isCorrect: true, points: 1000, attendeeId: 'att-1', answer: 0, submittedAt: new Date('2026-06-27T10:02:00Z'), timeMs: 0 },
      { questionIndex: 3, isCorrect: null, points: 0, attendeeId: 'att-1', answer: 1, submittedAt: new Date('2026-06-27T10:03:00Z'), timeMs: 0 },
    ])
  })

  it('omits leaderboard slides from questionStats', async () => {
    const res = await reportGet(new NextRequest('http://localhost/api/quizzes/quiz-1/report'), params('quiz-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    const stats = json.data.questionStats
    expect(stats).toHaveLength(2)
    expect(stats.some((s: { type: string }) => s.type === 'leaderboard')).toBe(false)
    expect(stats.map((s: { text: string }) => s.text)).toEqual(['Closest planet?', 'Favorite planet?'])
  })

  // `index` is the raw snapshot position that Answer rows key on. Renumbering
  // it to the display position would silently attach every response to the
  // wrong question, so the filter has to run AFTER the map.
  it('keeps raw snapshot indices so answers stay attached to their question', async () => {
    const res = await reportGet(new NextRequest('http://localhost/api/quizzes/quiz-1/report'), params('quiz-1'))
    const json = await res.json()

    const stats = json.data.questionStats
    expect(stats.map((s: { index: number }) => s.index)).toEqual([1, 3])
    expect(stats[0].totalResponses).toBe(1)
    expect(stats[0].correctPct).toBe(100)
  })

  it('reports no phantom zero-response questions', async () => {
    const res = await reportGet(new NextRequest('http://localhost/api/quizzes/quiz-1/report'), params('quiz-1'))
    const json = await res.json()

    const unanswered = json.data.questionStats.filter((s: { totalResponses: number }) => s.totalResponses === 0)
    expect(unanswered).toHaveLength(0)
  })
})

// ─── Accuracy denominator ────────────────────────────────────────────────────
// Reported from a real test run: the participant's own result screen said
// 4/9 = 44% while the host's report said 4/11 = 36% for the same attempt. The
// host route divided correct by EVERY answer, including two polls that can
// never be `isCorrect`. Accuracy must be correct ÷ scored questions — the
// definition report-data.ts (Excel) and sessions/[id]/matrix already used.

// 9 scored (mcq/truefalse) + 2 non-scored (poll/wordcloud) = 11 answerable.
const MIXED_SNAPSHOT = [
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `q${i}`, type: 'mcq', text: `Q${i}`, options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000,
  })),
  { id: 'poll', type: 'poll', text: 'Which did you enjoy?', options: ['x', 'y'], timerSeconds: 20, points: 0 },
  { id: 'cloud', type: 'wordcloud', text: 'One word?', timerSeconds: 20, points: 0 },
]

describe('scheduled quiz report — accuracy is over scored questions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      shareSlug: 'abc12345',
      status: 'ended',
      allowRetries: false,
      closesAt: null,
      participantCount: 1,
      createdAt: new Date('2026-08-06T10:00:00Z'),
      quizVersion: { title: 'AI Masterclass', subject: null, questionCount: 11, snapshot: MIXED_SNAPSHOT },
    })
    prismaMock.attendee.findMany.mockResolvedValue([
      { id: 'att-1', nickname: 'Mahesh', joinedAt: new Date('2026-08-06T10:01:00Z'), leftAt: new Date('2026-08-06T10:09:00Z'), finalScore: 4000 },
    ])
    // Answered all 11: 4 scored correct, 5 scored wrong, 2 non-scored.
    prismaMock.answer.findMany.mockResolvedValue([
      ...Array.from({ length: 4 }, (_, i) => ({
        questionIndex: i, isCorrect: true, points: 1000, attendeeId: 'att-1', answer: 0,
        submittedAt: new Date('2026-08-06T10:02:00Z'), timeMs: 0,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        questionIndex: 4 + i, isCorrect: false, points: 0, attendeeId: 'att-1', answer: 1,
        submittedAt: new Date('2026-08-06T10:03:00Z'), timeMs: 0,
      })),
      { questionIndex: 9, isCorrect: null, points: 0, attendeeId: 'att-1', answer: 0, submittedAt: new Date('2026-08-06T10:04:00Z'), timeMs: 0 },
      { questionIndex: 10, isCorrect: null, points: 0, attendeeId: 'att-1', answer: 'hello', submittedAt: new Date('2026-08-06T10:05:00Z'), timeMs: 0 },
    ])
  })

  async function report() {
    const res = await reportGet(new NextRequest('http://localhost/api/quizzes/quiz-1/report'), params('quiz-1'))
    return (await res.json()).data
  }

  it('reports 44%, matching the participant — not 36%', async () => {
    const entry = (await report()).leaderboard[0]
    expect(entry.accuracy).toBe(44)
    expect(entry.accuracy).not.toBe(36)
  })

  it('exposes the scored denominator so the table can render 4/9', async () => {
    const entry = (await report()).leaderboard[0]
    expect(entry.correctCount).toBe(4)
    expect(entry.scoredCount).toBe(9)
  })

  it('still reports everything answered, separately from the denominator', async () => {
    const entry = (await report()).leaderboard[0]
    expect(entry.answeredCount).toBe(11)
  })

  it('carries the same denominator into the summary average', async () => {
    expect((await report()).summary.avgAccuracy).toBe(44)
  })

  // Leaderboard slides are not questions and must not dilute accuracy either.
  it('excludes leaderboard slides from the denominator', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1', shareSlug: 'abc12345', status: 'ended', allowRetries: false, closesAt: null,
      participantCount: 1, createdAt: new Date('2026-08-06T10:00:00Z'),
      quizVersion: {
        title: 'AI Masterclass', subject: null, questionCount: 12,
        snapshot: [...MIXED_SNAPSHOT, { id: 'lb', type: 'leaderboard', text: '', timerSeconds: 20, points: 1000, topN: 5 }],
      },
    })
    const entry = (await report()).leaderboard[0]
    expect(entry.scoredCount).toBe(9)
    expect(entry.accuracy).toBe(44)
  })

  it('reports null accuracy rather than 0 when a quiz has no scored questions', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1', shareSlug: 'abc12345', status: 'ended', allowRetries: false, closesAt: null,
      participantCount: 1, createdAt: new Date('2026-08-06T10:00:00Z'),
      quizVersion: {
        title: 'Survey', subject: null, questionCount: 2,
        snapshot: [
          { id: 'poll', type: 'poll', text: 'A?', options: ['x', 'y'], timerSeconds: 20, points: 0 },
          { id: 'cloud', type: 'wordcloud', text: 'B?', timerSeconds: 20, points: 0 },
        ],
      },
    })
    prismaMock.answer.findMany.mockResolvedValue([
      { questionIndex: 0, isCorrect: null, points: 0, attendeeId: 'att-1', answer: 0, submittedAt: new Date(), timeMs: 0 },
    ])
    const entry = (await report()).leaderboard[0]
    expect(entry.accuracy).toBeNull()
  })
})
