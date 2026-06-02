import { describe, expect, it, vi } from 'vitest'
import { createQuizoticClient } from '../../mcp/quizotic-api-client.mjs'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'Content-Type': 'application/json' } })
}

describe('Quizotic MCP API client', () => {
  it('maps generate_quiz to the v1 generate endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { questions: [] } }))
    const client = createQuizoticClient({ baseUrl: 'https://quizotic.test/', apiKey: 'qz_key', fetchImpl: fetchMock })

    await client.generateQuiz({ mode: 'topic', topic: 'fractions', questionCount: 5 })

    expect(fetchMock).toHaveBeenCalledWith(new URL('https://quizotic.test/api/v1/quizzes/generate'), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer qz_key', 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode: 'topic', topic: 'fractions', questionCount: 5 }),
    }))
  })

  it('maps create and publish to saved quiz endpoints', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { id: 'quiz-1' } }))
    const client = createQuizoticClient({ baseUrl: 'https://quizotic.test', apiKey: 'qz_key', fetchImpl: fetchMock })

    await client.createQuiz({ title: 'Fractions', questions: [{ text: '1/2 + 1/2?', options: ['1'], correctAnswer: '0' }] })
    await client.publishSelfPacedQuiz({ quizId: 'quiz-1', allowRetries: true })

    expect(fetchMock).toHaveBeenNthCalledWith(1, new URL('https://quizotic.test/api/v1/quizzes'), expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL('https://quizotic.test/api/v1/quizzes/quiz-1/publish'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ allowRetries: true }),
    }))
  })

  it('maps list_quizzes and get_report to read endpoints', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }))
    const client = createQuizoticClient({ baseUrl: 'https://quizotic.test', apiKey: 'qz_key', fetchImpl: fetchMock })

    await client.listQuizzes({ limit: 10, offset: 20 })
    await client.getReport({ sessionId: 'session-1' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, new URL('https://quizotic.test/api/v1/quizzes?limit=10&offset=20'), expect.objectContaining({ method: 'GET' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL('https://quizotic.test/api/v1/sessions/session-1/results'), expect.objectContaining({ method: 'GET' }))
  })

  it('raises API errors with Quizotic response payloads', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: { code: 'unauthorized', message: 'Invalid API key' } }, { status: 401 }))
    const client = createQuizoticClient({ baseUrl: 'https://quizotic.test', apiKey: 'qz_bad', fetchImpl: fetchMock })

    await expect(client.listQuizzes()).rejects.toMatchObject({ status: 401, message: 'Invalid API key' })
  })
})
