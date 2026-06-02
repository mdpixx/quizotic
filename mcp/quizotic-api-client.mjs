const DEFAULT_BASE_URL = 'https://www.quizotic.live'

function trimBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(`${trimBaseUrl(baseUrl)}${path}`)
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url
}

async function requestJson({ baseUrl, apiKey, fetchImpl }, path, options = {}) {
  if (!apiKey) {
    throw new Error('QUIZOTIC_API_KEY is required for Quizotic MCP tools.')
  }

  const url = buildUrl(baseUrl, path, options.query)
  const response = await fetchImpl(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = json?.error?.message || json?.error || `Quizotic API returned ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.payload = json
    throw error
  }

  return json
}

export function createQuizoticClient(options = {}) {
  const clientOptions = {
    baseUrl: options.baseUrl || process.env.QUIZOTIC_BASE_URL || DEFAULT_BASE_URL,
    apiKey: options.apiKey || process.env.QUIZOTIC_API_KEY,
    fetchImpl: options.fetchImpl || globalThis.fetch,
  }

  if (!clientOptions.fetchImpl) {
    throw new Error('A fetch implementation is required for Quizotic MCP tools.')
  }

  return {
    generateQuiz(input) {
      return requestJson(clientOptions, '/api/v1/quizzes/generate', { method: 'POST', body: input })
    },
    createQuiz(input) {
      return requestJson(clientOptions, '/api/v1/quizzes', { method: 'POST', body: input })
    },
    publishSelfPacedQuiz(input) {
      const { quizId, ...body } = input || {}
      if (!quizId) throw new Error('quizId is required.')
      return requestJson(clientOptions, `/api/v1/quizzes/${encodeURIComponent(quizId)}/publish`, { method: 'POST', body })
    },
    listQuizzes(input = {}) {
      return requestJson(clientOptions, '/api/v1/quizzes', {
        query: { limit: input.limit, offset: input.offset },
      })
    },
    getReport(input) {
      const { sessionId } = input || {}
      if (!sessionId) throw new Error('sessionId is required.')
      return requestJson(clientOptions, `/api/v1/sessions/${encodeURIComponent(sessionId)}/results`)
    },
  }
}
