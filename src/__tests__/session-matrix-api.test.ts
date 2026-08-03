import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCurrentUserMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  gameSession: { findFirst: vi.fn() },
  attendee: { findMany: vi.fn() },
  answer: { findMany: vi.fn() },
}))

vi.mock('@/lib/auth-helpers', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/sessions/[id]/matrix/route'

const routeContext = { params: Promise.resolve({ id: 'session-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUserMock.mockResolvedValue({ id: 'host-1' })
  prismaMock.gameSession.findFirst.mockResolvedValue({
    id: 'session-1',
    results: {
      questionStats: [
        { index: 0, text: 'Question one', type: 'mcq' },
        { index: 1, text: 'Question two', type: 'mcq' },
      ],
    },
    quizVersion: { snapshot: null },
  })
  prismaMock.attendee.findMany.mockResolvedValue([
    { id: 'att-1', nickname: 'Asha', finalScore: 100 },
  ])
  prismaMock.answer.findMany.mockResolvedValue([
    { attendeeId: 'att-1', participantId: 'participant-1', questionIndex: 0, isCorrect: false, points: 0, confidence: 'sure' },
    { attendeeId: 'att-1', participantId: 'participant-1', questionIndex: 1, isCorrect: true, points: 100, confidence: null },
  ])
})

describe('GET /api/sessions/[id]/matrix', () => {
  it('returns confidence values aligned with participant cells', async () => {
    const response = await GET(new NextRequest('http://localhost/api/sessions/session-1/matrix'), routeContext)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.gameSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'host-1', OR: [{ id: 'session-1' }, { code: 'session-1' }] },
    }))
    expect(prismaMock.answer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ confidence: true }),
    }))
    expect(json.data.participants[0]).toMatchObject({
      name: 'Asha',
      cells: [0, 1],
      confidences: ['sure', null],
    })
  })

  it('ships typed answers truncated server-side, never the full text', async () => {
    // 100 participants x 60 questions x 2000 chars would be a multi-MB payload
    // on the classroom connections this product is built for. The cap has to
    // live on the server — a client-side clamp still pays the transfer.
    const longAnswer = 'x'.repeat(2000)
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      results: { questionStats: [{ index: 0, text: 'Describe it', type: 'openended' }] },
      quizVersion: { snapshot: null },
    })
    prismaMock.answer.findMany.mockResolvedValue([
      { attendeeId: 'att-1', participantId: 'p-1', questionIndex: 0, isCorrect: null, points: 0, confidence: null, answer: longAnswer },
    ])

    const response = await GET(new NextRequest('http://localhost/api/sessions/session-1/matrix'), routeContext)
    const json = await response.json()

    expect(prismaMock.answer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ answer: true }),
    }))
    const cell = json.data.participants[0].texts[0]
    expect(cell).toHaveLength(83) // 80 chars + the '...' marker
    expect(cell.endsWith('...')).toBe(true)
    expect(cell.length).toBeLessThan(longAnswer.length)
  })

  it('leaves non-string answers as dots rather than leaking a blob into a cell', async () => {
    // Answer is Json: a ranking array or a drawing data URL must never render
    // as text. Only the short-string types get a cell.
    prismaMock.gameSession.findFirst.mockResolvedValue({
      id: 'session-1',
      results: { questionStats: [{ index: 0, text: 'Rank these', type: 'ranking' }] },
      quizVersion: { snapshot: null },
    })
    prismaMock.answer.findMany.mockResolvedValue([
      { attendeeId: 'att-1', participantId: 'p-1', questionIndex: 0, isCorrect: null, points: 0, confidence: null, answer: [3, 1, 2] },
    ])

    const response = await GET(new NextRequest('http://localhost/api/sessions/session-1/matrix'), routeContext)
    const json = await response.json()

    expect(json.data.questions[0].hasText).toBe(false)
    expect(json.data.participants[0].texts[0]).toBeNull()
  })

  it('does not query another host\'s matrix when unauthenticated', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/sessions/session-1/matrix'), routeContext)

    expect(response.status).toBe(401)
    expect(prismaMock.gameSession.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the authenticated host does not own the session', async () => {
    prismaMock.gameSession.findFirst.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/sessions/session-1/matrix'), routeContext)

    expect(response.status).toBe(404)
    expect(prismaMock.attendee.findMany).not.toHaveBeenCalled()
    expect(prismaMock.answer.findMany).not.toHaveBeenCalled()
  })
})
