import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  gameSession: { findMany: vi.fn() },
  presentation: { count: vi.fn(), findMany: vi.fn() },
  quiz: { findMany: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/analytics/route'

function results({ score, questionText, correctPct, confidenceGrid = { sureCorrect: 6, sureWrong: 2, unsureCorrect: 1, unsureWrong: 1 } }: {
  score: number
  questionText: string
  correctPct: number
  confidenceGrid?: { sureCorrect: number; sureWrong: number; unsureCorrect: number; unsureWrong: number }
}) {
  return {
    maxScore: 1000,
    questionCount: 1,
    duration: 420,
    leaderboard: [{ name: 'Asha', archetype: 'Solar Panther', score }],
    questionStats: [{
      index: 0,
      text: questionText,
      correctPct,
      confidenceGrid,
      bloomsLevel: 'Understand',
    }],
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-01T10:00:00Z'))
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1' } })
  prismaMock.presentation.count.mockResolvedValue(3)
  prismaMock.quiz.findMany.mockResolvedValue([
    { id: 'quiz-recent', title: 'Digital Literacy Recap', updatedAt: new Date('2026-07-31T09:00:00Z') },
  ])
  prismaMock.presentation.findMany.mockResolvedValue([
    { id: 'presentation-recent', title: 'Future of AI', updatedAt: new Date('2026-07-30T09:00:00Z') },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/analytics dashboard contract', () => {
  it('returns 401 for an anonymous request', async () => {
    authMock.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/analytics'))

    expect(response.status).toBe(401)
  })

  it('defaults to 30 days and separates the comparison period', async () => {
    prismaMock.gameSession.findMany
      .mockResolvedValueOnce([
        {
          id: 'current-new', type: 'quiz', quizId: 'quiz-1', presentationId: null,
          createdAt: new Date('2026-07-28T10:00:00Z'), endedAt: new Date('2026-07-28T10:10:00Z'),
          status: 'ended', participantCount: 10,
          results: results({
            score: 450,
            questionText: 'What does context window mean in an AI model?',
            correctPct: 20,
            confidenceGrid: { sureCorrect: 7, sureWrong: 1, unsureCorrect: 1, unsureWrong: 1 },
          }),
          quiz: { id: 'quiz-1', title: 'AI Masterclass' }, presentation: null,
        },
        {
          id: 'current-old', type: 'quiz', quizId: 'quiz-1', presentationId: null,
          createdAt: new Date('2026-07-20T10:00:00Z'), endedAt: new Date('2026-07-20T10:10:00Z'),
          status: 'ended', participantCount: 10,
          results: results({
            score: 700,
            questionText: 'What is machine learning?',
            correctPct: 60,
            confidenceGrid: { sureCorrect: 0, sureWrong: 9, unsureCorrect: 1, unsureWrong: 0 },
          }),
          quiz: { id: 'quiz-1', title: 'AI Masterclass' }, presentation: null,
        },
        {
          id: 'previous', type: 'quiz', quizId: 'quiz-2', presentationId: null,
          createdAt: new Date('2026-06-20T10:00:00Z'), endedAt: new Date('2026-06-20T10:10:00Z'),
          status: 'ended', participantCount: 5,
          results: results({ score: 600, questionText: 'What is a prompt?', correctPct: 60 }),
          quiz: { id: 'quiz-2', title: 'AI Basics' }, presentation: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'scheduled-1', quizId: 'quiz-recent', shareSlug: 'schedule-me', status: 'open',
          opensAt: new Date('2026-08-02T09:00:00Z'), closesAt: new Date('2026-08-03T09:00:00Z'),
          participantCount: 0, quizVersion: { title: 'Digital Literacy Recap', questionCount: 12 },
        },
      ])

    const response = await GET(new Request('http://localhost/api/analytics'))
    const json = await response.json()

    const historyQuery = prismaMock.gameSession.findMany.mock.calls[0][0]
    expect(historyQuery.where.createdAt.gte).toEqual(new Date('2026-06-02T10:00:00Z'))
    expect(json.range).toBe(30)
    expect(json.learningPulse.learnerReach).toMatchObject({ value: 20, previous: 5, delta: 300 })
    expect(json.recentSessions.map((item: { id: string }) => item.id)).toEqual(['current-new', 'current-old'])
    expect(json.teachingBrief).toMatchObject({
      sessionId: 'current-new',
      topic: 'Context window',
      hardQuestionCount: 1,
      confidentlyWrongPct: 10,
      confidentlyWrongCount: 1,
      misconceptionQuestionCount: 1,
      supportLearnerCount: 1,
    })
    expect(json.confidenceGrid).toEqual({ sureCorrect: 7, sureWrong: 10, unsureCorrect: 2, unsureWrong: 1 })
    expect(json.supportLearners[0]).toMatchObject({ name: 'Asha', latestScore: 45, change: -25 })
    expect(json.nextScheduled).toMatchObject({ sessionId: 'scheduled-1', phase: 'upcoming' })
    expect(json.scheduleCount).toBe(1)
    expect(json.recentContent.map((item: { type: string }) => item.type)).toEqual(['quiz', 'presentation'])
  })

  it('returns safe empty states when the host has no analytics data', async () => {
    prismaMock.gameSession.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const response = await GET(new Request('http://localhost/api/analytics?range=90'))
    const json = await response.json()

    expect(json.range).toBe(90)
    expect(json.learningPulse.accuracy.value).toBeNull()
    expect(json.learningPulse.accuracy.delta).toBeNull()
    expect(json.teachingBrief).toBeNull()
    expect(json.supportLearners).toEqual([])
    expect(json.nextScheduled).toBeNull()
  })
})
