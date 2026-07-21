import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const apiUser = { id: 'user-1', email: 'host@example.com' }

const prismaMock = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn(async (): Promise<typeof apiUser | null> => apiUser))
const rateLimitMock = vi.hoisted(() => vi.fn(async () => ({ ok: true })))
const rateLimitResponseMock = vi.hoisted(() => vi.fn(() => Response.json({ error: 'rate limited' }, { status: 429 })))

// Mock the live-control client so these route tests don't require the custom
// server to be running. Each test wires the return values it needs.
const createLiveSessionMock = vi.hoisted(() => vi.fn())
const controlLiveSessionMock = vi.hoisted(() => vi.fn())
const snapshotLiveSessionMock = vi.hoisted(() => vi.fn())
const sessionOwnerMatchesMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/api-key-auth', () => ({ authenticateApiKey: authMock }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitRequest: rateLimitMock,
  rateLimitResponse: rateLimitResponseMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}))
vi.mock('@/lib/live-control', () => ({
  createLiveSession: createLiveSessionMock,
  controlLiveSession: controlLiveSessionMock,
  snapshotLiveSession: snapshotLiveSessionMock,
  sessionOwnerMatches: sessionOwnerMatchesMock,
}))

import { POST as createSession } from '../app/api/v1/sessions/create/route'
import { GET as getSnapshot } from '../app/api/v1/sessions/[id]/snapshot/route'
import { POST as controlSession } from '../app/api/v1/sessions/[id]/control/route'

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
  authMock.mockResolvedValue(apiUser)
  rateLimitMock.mockResolvedValue({ ok: true })
  sessionOwnerMatchesMock.mockReturnValue(false)
})

describe('POST /api/v1/sessions/create', () => {
  it('rejects requests without an API key', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', { quizId: 'q1' }))
    expect(res.status).toBe(401)
  })

  it('rejects when quizId is missing', async () => {
    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', {}))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error.code).toBe('validation_error')
  })

  it('404s when the quiz does not exist or is not owned by the caller', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce(null)
    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', { quizId: 'foreign' }))
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error.code).toBe('not_found')
  })

  it('rejects a quiz with no questions', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce({
      id: 'q1', title: 'Empty', subject: null, language: null, theme: null, questions: [],
    })
    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', { quizId: 'q1' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error.code).toBe('empty_quiz')
  })

  it('creates a live session and returns gameCode + join/embed URLs', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce({
      id: 'q1',
      title: 'Test quiz',
      subject: null,
      language: null,
      theme: null,
      questions: [{ type: 'mcq', text: 'Q1', options: ['A', 'B'], correctAnswer: '0' }],
    })
    createLiveSessionMock.mockResolvedValueOnce({
      ok: true,
      gameCode: '654321',
      hostResumeToken: 'resume-abc',
    })

    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', { quizId: 'q1' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.gameCode).toBe('654321')
    expect(json.data.hostControlToken).toBe('resume-abc')
    expect(json.data.joinUrl).toContain('/join?code=654321')
    expect(json.data.embedUrl).toContain('/embed/session/654321')
    // Confirms ownership was checked BEFORE delegation: findFirst received
    // the userId so a foreign quiz would have been rejected at the DB layer.
    expect(prismaMock.quiz.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'q1', userId: 'user-1' },
    }))
    // primaryHostSocketId must be null for the HTTP path (no socket to bind).
    expect(createLiveSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      primaryHostSocketId: null,
    }))
  })

  it('surfaces a 503 when the bridge reports capacity / auth failure', async () => {
    prismaMock.quiz.findFirst.mockResolvedValueOnce({
      id: 'q1', title: 'T', subject: null, language: null, theme: null,
      questions: [{ type: 'mcq', text: 'Q1' }],
    })
    createLiveSessionMock.mockResolvedValueOnce({ ok: false, error: 'Server capacity reached.' })
    const res = await createSession(jsonReq('http://localhost/api/v1/sessions/create', { quizId: 'q1' }))
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.error.code).toBe('session_create_failed')
  })
})

describe('GET /api/v1/sessions/:code/snapshot', () => {
  it('rejects without an API key', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await getSnapshot(getReq('http://localhost/api/v1/sessions/654321/snapshot'), params({ id: '654321' }))
    expect(res.status).toBe(401)
  })

  it('404s when the caller does not own the session', async () => {
    sessionOwnerMatchesMock.mockReturnValue(false)
    const res = await getSnapshot(getReq('http://localhost/api/v1/sessions/654321/snapshot'), params({ id: '654321' }))
    expect(res.status).toBe(404)
    // Bridge must NOT be called when ownership fails — defends against leaking
    // a foreign host's live state to another API-key owner.
    expect(snapshotLiveSessionMock).not.toHaveBeenCalled()
  })

  it('404s when the bridge reports no live session', async () => {
    sessionOwnerMatchesMock.mockReturnValue(true)
    snapshotLiveSessionMock.mockReturnValueOnce(null)
    const res = await getSnapshot(getReq('http://localhost/api/v1/sessions/654321/snapshot'), params({ id: '654321' }))
    expect(res.status).toBe(404)
  })

  it('returns the snapshot JSON for an owned live session', async () => {
    sessionOwnerMatchesMock.mockReturnValue(true)
    const fakeSnap = { gameCode: '654321', phase: 'lobby', connectedCount: 3 }
    snapshotLiveSessionMock.mockReturnValueOnce(fakeSnap)
    const res = await getSnapshot(getReq('http://localhost/api/v1/sessions/654321/snapshot'), params({ id: '654321' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toEqual(fakeSnap)
  })
})

describe('POST /api/v1/sessions/:code/control', () => {
  it('rejects without an API key', async () => {
    authMock.mockResolvedValueOnce(null)
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'start' }), params({ id: '654321' }))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid action', async () => {
    sessionOwnerMatchesMock.mockReturnValue(true)
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'bogus' }), params({ id: '654321' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error.code).toBe('validation_error')
    expect(controlLiveSessionMock).not.toHaveBeenCalled()
  })

  it('404s when the caller does not own the session', async () => {
    sessionOwnerMatchesMock.mockReturnValue(false)
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'next' }), params({ id: '654321' }))
    expect(res.status).toBe(404)
    expect(controlLiveSessionMock).not.toHaveBeenCalled()
  })

  it('forwards a valid action and returns the control result', async () => {
    sessionOwnerMatchesMock.mockReturnValue(true)
    controlLiveSessionMock.mockResolvedValueOnce({ ok: true, status: 'active', currentQuestionIndex: 0 })
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'start' }), params({ id: '654321' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.ok).toBe(true)
    expect(json.data.status).toBe('active')
    expect(controlLiveSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'start',
      gameCode: '654321',
      actor: 'http:add-in',
    }))
  })

  it('maps a bridge not-found error to 404', async () => {
    sessionOwnerMatchesMock.mockReset()
    sessionOwnerMatchesMock.mockReturnValue(true)
    controlLiveSessionMock.mockReset()
    controlLiveSessionMock.mockResolvedValue({ ok: false, error: 'Session not found.' })
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'end' }), params({ id: '654321' }))
    expect(res.status).toBe(404)
  })

  it('maps a state-transition error to 409', async () => {
    sessionOwnerMatchesMock.mockReset()
    sessionOwnerMatchesMock.mockReturnValue(true)
    controlLiveSessionMock.mockReset()
    controlLiveSessionMock.mockResolvedValue({ ok: false, error: 'Session already started.' })
    const res = await controlSession(jsonReq('http://localhost/api/v1/sessions/654321/control', { action: 'start' }), params({ id: '654321' }))
    expect(res.status).toBe(409)
  })
})
