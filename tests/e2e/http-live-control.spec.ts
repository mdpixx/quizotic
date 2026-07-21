// Critical-path integration test for the HTTP live-session control surface
// (the foundation the Office/Google Slides add-ins sit on).
//
// What this proves (any failure blocks the deploy):
//   1. A live session created via POST /api/v1/sessions/create lands in the
//      SAME in-memory `sessions` Map the socket layer reads — a participant
//      can join it over Socket.IO immediately afterward.
//   2. POST /api/v1/sessions/:code/control with action=start drives the
//      session and emits the SAME socket events as the socket start_quiz
//      path — the participant receives `question_show`.
//   3. GET /api/v1/sessions/:code/snapshot reflects the new phase.
//
// Together these prove there is no forked state machine: HTTP control and
// socket control operate on one source of truth and are indistinguishable
// to anyone in the room.

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { encode } from '@auth/core/jwt'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const COOKIE_NAME = 'authjs.session-token'

// Read secrets from the project .env the same way scheduled-quiz.spec.ts does
// — Playwright doesn't auto-load .env, and we need both NEXTAUTH_SECRET (to
// mint the host JWT) and DATABASE_URL (to seed the User + Quiz rows the HTTP
// control surface needs).
function readEnv(key: string): string {
  const envPath = join(process.cwd(), '.env')
  const raw = readFileSync(envPath, 'utf8')
  const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!match) throw new Error(`${key} not found in .env`)
  return match[1].replace(/^["']|["']$/g, '').trim()
}

function loadSecret(): string {
  return process.env.NEXTAUTH_SECRET || readEnv('NEXTAUTH_SECRET')
}

function dbUrl(): string {
  return process.env.DATABASE_URL || readEnv('DATABASE_URL')
}

async function sql(query: string, params: unknown[] = []): Promise<void> {
  const client = new Client({ connectionString: dbUrl() })
  await client.connect()
  try {
    await client.query(query, params)
  } finally {
    await client.end()
  }
}

/**
 * Mint a NEXTAUTH session cookie AND ensure the backing User row exists (the
 * HTTP control test sets an API key on the user, which requires the row).
 * Returns both the cookie header and the userId.
 *
 * Uses raw SQL via the pg Pool (the same one server.mjs uses as `dbPool`)
 * rather than Prisma's upsert — Prisma 7's adapter path was throwing an
 * empty PrismaClientKnownRequestError here, and a raw INSERT ... ON CONFLICT
 * is idempotent and dependency-light for the test path.
 */
async function hostUser(label = 'host'): Promise<{ userId: string; cookie: string }> {
  const userId = `e2e-http-${label}-${Math.random().toString(36).slice(2, 10)}`
  const email = `${userId}@e2e.test`
  await sql(
    `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
     VALUES ($1, $2, 'E2E Host', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [userId, email]
  )
  const token = await encode({
    token: { sub: userId, userId },
    secret: loadSecret(),
    salt: COOKIE_NAME,
    maxAge: 3600,
  })
  return { userId, cookie: `${COOKIE_NAME}=${token}` }
}

/** Set the API key on a user row (raw SQL — the apiKey column is unique). */
async function setApiKey(userId: string, apiKey: string): Promise<void> {
  await sql(`UPDATE "User" SET "apiKey" = $1, "updatedAt" = NOW() WHERE id = $2`, [apiKey, userId])
}

/** Clear the API key (cleanup). */
async function clearApiKey(userId: string): Promise<void> {
  await sql(`UPDATE "User" SET "apiKey" = NULL, "updatedAt" = NOW() WHERE id = $1`, [userId])
}

const TEST_QUIZ = {
  title: 'HTTP Control E2E',
  questions: [
    {
      id: 'q1',
      type: 'mcq',
      text: 'HTTP-driven: pick B',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: '1',
      timerSeconds: 30,
      points: 1000,
    },
  ],
}

function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    })
    const t = setTimeout(() => { s.disconnect(); reject(new Error('socket connect timeout')) }, 10_000)
    s.on('connect', () => { clearTimeout(t); resolve(s) })
    s.on('connect_error', (err) => { clearTimeout(t); reject(new Error(`connect_error: ${err.message}`)) })
  })
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event ${event} did not arrive within ${timeoutMs}ms`)), timeoutMs)
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload) })
  })
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs)
    socket.emit(event, payload, (res: T) => { clearTimeout(t); resolve(res) })
  })
}

/**
 * Seed a quiz owned by the test host user, return its id. Idempotent so the
 * test can re-run without piling up quizzes.
 */
async function seedQuiz(userId: string): Promise<string> {
  const id = `e2e-http-control-${userId}`
  await sql(
    `INSERT INTO "Quiz" (id, title, questions, "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET title = $2, questions = $3, "userId" = $4, "updatedAt" = NOW()`,
    [id, TEST_QUIZ.title, JSON.stringify(TEST_QUIZ.questions), userId]
  )
  return id
}

test.describe('HTTP live-session control surface', () => {
  test('HTTP-created session is drivable from socket POV (single source of truth)', async () => {
    const { userId } = await hostUser('host')
    const quizId = await seedQuiz(userId)

    // Mint an API key for the test user (the v1 HTTP surface requires one).
    const apiKey = `qz_e2e_${userId}_${Math.random().toString(36).slice(2, 10)}`
    await setApiKey(userId, apiKey)

    const participant = await connectSocket()
    try {
      // 1. Create a live session via HTTP.
      const createRes = await fetch(`${baseURL}/api/v1/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ quizId }),
      })
      expect(createRes.status).toBe(201)
      const createJson = (await createRes.json()) as { data: { gameCode: string; joinUrl: string } }
      const gameCode = createJson.data.gameCode
      expect(gameCode).toMatch(/^\d{6}$/)

      // 2. A socket participant can JOIN that HTTP-created session — proves
      //    the session lives in the same Map the socket layer reads.
      const joined = await emitWithAck<{ success: boolean; participantId?: string }>(
        participant,
        'join_session',
        { gameCode, displayName: 'HTTP-Control Player' },
      )
      expect(joined.success).toBe(true)
      expect(joined.participantId).toBeTruthy()

      // 3. Drive the session via HTTP control — action: start.
      //    Register the question_show listener BEFORE issuing the HTTP start
      //    call — presentQuestion emits synchronously on start, so a listener
      //    registered after the await would miss the event (the original bug
      //    this test caught during development).
      const questionShown = waitForEvent<{ index: number }>(participant, 'question_show', 6_000)

      const startRes = await fetch(`${baseURL}/api/v1/sessions/${gameCode}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ action: 'start' }),
      })
      expect(startRes.status).toBe(200)
      const startJson = (await startRes.json()) as { data: { ok: boolean; status: string } }
      expect(startJson.data.ok).toBe(true)
      expect(startJson.data.status).toBe('active')

      // 4. The participant receives question_show over Socket.IO — the HTTP
      //    control path emitted the same event the socket start_quiz path
      //    would have. This is the smoking-gun assertion for shared state.
      const q = await questionShown
      expect(q.index).toBe(0)

      // 5. The snapshot endpoint reflects the active phase.
      const snapRes = await fetch(`${baseURL}/api/v1/sessions/${gameCode}/snapshot`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      expect(snapRes.status).toBe(200)
      const snapJson = (await snapRes.json()) as { data: { phase: string; currentQuestionIndex: number } }
      expect(snapJson.data.phase).toBe('active')
      expect(snapJson.data.currentQuestionIndex).toBe(0)
    } finally {
      participant.disconnect()
      // Best-effort cleanup — don't leave the test API key around.
      await clearApiKey(userId).catch(() => {})
    }
  })

  test('rejects control from a foreign API key (ownership enforced)', async () => {
    const { userId: ownerId } = await hostUser('owner')
    const { userId: attackerId } = await hostUser('attacker')
    const ownerKey = `qz_e2e_owner_${Math.random().toString(36).slice(2, 10)}`
    const attackerKey = `qz_e2e_attacker_${Math.random().toString(36).slice(2, 10)}`
    await setApiKey(ownerId, ownerKey)
    await setApiKey(attackerId, attackerKey)
    const quizId = await seedQuiz(ownerId)

    try {
      // Owner creates.
      const createRes = await fetch(`${baseURL}/api/v1/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerKey}` },
        body: JSON.stringify({ quizId }),
      })
      expect(createRes.status).toBe(201)
      const { data } = (await createRes.json()) as { data: { gameCode: string } }
      const gameCode = data.gameCode

      // Attacker cannot snapshot or control — gets 404 (no leak that it exists).
      const attackSnap = await fetch(`${baseURL}/api/v1/sessions/${gameCode}/snapshot`, {
        headers: { Authorization: `Bearer ${attackerKey}` },
      })
      expect(attackSnap.status).toBe(404)

      const attackControl = await fetch(`${baseURL}/api/v1/sessions/${gameCode}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attackerKey}` },
        body: JSON.stringify({ action: 'end' }),
      })
      expect(attackControl.status).toBe(404)

      // Owner can still drive it — confirms the foreign attempt didn't lock it.
      const ownerControl = await fetch(`${baseURL}/api/v1/sessions/${gameCode}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerKey}` },
        body: JSON.stringify({ action: 'end' }),
      })
      expect(ownerControl.status).toBe(200)
    } finally {
      await clearApiKey(ownerId).catch(() => {})
      await clearApiKey(attackerId).catch(() => {})
    }
  })
})
