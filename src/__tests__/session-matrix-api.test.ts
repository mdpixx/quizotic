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
