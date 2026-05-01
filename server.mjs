import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'

// ─── Sentry (Socket.IO + custom server runtime) ────────────────
// Initialized at the very top so any module-load throw is captured.
// Graceful no-DSN: if SENTRY_DSN isn't set, init is skipped silently.
// This is the layer where the 2026-05-01 bug class lives — schema
// validation rejects, scoring guards, persist failures — every one
// of which previously logged once to stdout and was forgotten until
// a customer complained.
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  try {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.05,
      environment: process.env.RAILWAY_ENVIRONMENT || 'production',
    })
    console.log('[sentry] initialized for custom server')
  } catch (err) {
    console.warn('[sentry] init failed:', err instanceof Error ? err.message : err)
  }
}

import { assignArchetype } from './src/lib/archetypes.mjs'
import {
  CreateSessionSchema,
  CreatePresenterSessionSchema,
  GameCodeOnlySchema,
  HostResumeSchema,
  JoinFollowupSchema,
  JoinSessionSchema,
  PingTimeSchema,
  PresenterResponseSchema,
  PresenterSlideSchema,
  SubmitAnswerSchema,
  SubmitDrawingSchema,
  validateSocketPayload,
} from './src/lib/socket-schemas.mjs'
import pg from 'pg'
import { parse as parseCookie } from 'cookie'
import { randomUUID } from 'crypto'
import {
  getConnectedCount as _getConnectedCount,
  buildSessionStateSnapshot as _buildSessionStateSnapshot,
  flushPendingPersist as _flushPendingPersist,
} from './src/lib/session-state.mjs'

// ─── Startup env var validation ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const REQUIRED = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'OPENROUTER_API_KEY']
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      console.error(`[FATAL] Missing required env var: ${key}`)
      process.exit(1)
    }
  }
}

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// ─── Database pool for session persistence ─────────────────────
let dbPool = null
if (process.env.DATABASE_URL) {
  dbPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
}

// ─── Belt-and-suspenders schema guard ──────────────────────────
// Prisma's migrate state can drift from the actual DB (ledger row present but
// DDL never landed). Re-run idempotent ALTER TABLE IF NOT EXISTS statements
// for columns the save paths hard-depend on, so a container restart always
// repairs drift even when `prisma migrate deploy` is a no-op against the
// drifted ledger. Runs once before we call app.prepare().
async function ensureCriticalColumns() {
  if (!dbPool) return
  const stmts = [
    'ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "theme" TEXT',
    'ALTER TABLE "Presentation" ADD COLUMN IF NOT EXISTS "theme" TEXT',
  ]
  for (const sql of stmts) {
    try {
      await dbPool.query(sql)
      console.log(`[boot:ensure-columns] OK — ${sql}`)
    } catch (err) {
      console.warn(`[boot:ensure-columns] skipped: ${sql} — ${err.message}`)
    }
  }
}

async function persistGameSession(data, attempt = 1) {
  if (!dbPool) return
  const { code, type, quizId, presentationId, userId, hostName, status, participantCount, results, sessionId } = data
  try {
    if (sessionId) {
      // Row was pre-created at first-join; update with final results.
      await dbPool.query(
        `UPDATE "GameSession"
         SET status = $1, "participantCount" = $2, results = $3::jsonb, "endedAt" = now()
         WHERE id = $4`,
        [status, participantCount, JSON.stringify(results), sessionId]
      )
    } else {
      await dbPool.query(
        `INSERT INTO "GameSession" (id, code, type, "quizId", "presentationId", "userId", "hostName", status, "participantCount", results, "createdAt", "endedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now(), now())`,
        [randomUUID(), code, type, quizId || null, presentationId || null, userId || null, hostName || null, status, participantCount, JSON.stringify(results)]
      )
    }
    console.log(`[db] persisted ${type} session: ${code}`)
  } catch (err) {
    console.error(`[db] session persist failed (attempt ${attempt}):`, err.message)
    if (attempt < 3) {
      setTimeout(() => persistGameSession(data, attempt + 1), attempt * 2000)
    }
  }
}

// Snapshot the quiz content into a QuizVersion row so historical session
// reports stay accurate even if the host edits the quiz afterwards.
// Returns the QuizVersion id (or null if anything fails — best-effort).
async function snapshotQuizVersion(session) {
  if (!dbPool) return null
  if (!session?.quizData) return null
  if (session.quizVersionId) return session.quizVersionId
  try {
    const id = randomUUID()
    const questions = Array.isArray(session.quizData.questions) ? session.quizData.questions : []
    await dbPool.query(
      `INSERT INTO "QuizVersion" (id, "quizId", title, subject, language, theme, snapshot, "questionCount", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())`,
      [
        id,
        session.quizData.id || null,
        String(session.quizData.title || 'Untitled Quiz').slice(0, 200),
        session.quizData.subject || null,
        session.quizData.language || null,
        session.quizData.theme || null,
        JSON.stringify(questions),
        questions.length,
      ]
    )
    session.quizVersionId = id
    return id
  } catch (err) {
    console.error('[db] snapshotQuizVersion failed:', err.message)
    return null
  }
}

// Lazily insert a GameSession row the first time a participant joins so
// per-attendee inserts can reference it. Returns the row id (or null on failure).
async function ensureGameSessionRow(session, code, type) {
  if (!dbPool) return null
  if (session.dbId) return session.dbId
  if (session._dbInsertPromise) return session._dbInsertPromise
  const id = randomUUID()
  session._dbInsertPromise = (async () => {
    try {
      // Take a content snapshot first (only for quiz sessions). The
      // GameSession row references it via quizVersionId. If snapshot fails
      // we still create the GameSession row — the snapshot is an
      // observability win, not a correctness requirement.
      const quizVersionId = type === 'quiz' ? await snapshotQuizVersion(session) : null
      await dbPool.query(
        `INSERT INTO "GameSession" (id, code, type, "quizId", "quizVersionId", "presentationId", "userId", "hostName", status, "participantCount", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 0, now())`,
        [
          id,
          code,
          type,
          type === 'quiz' ? (session.quizData?.id || null) : null,
          quizVersionId,
          type === 'presentation' ? (session.presentationData?.id || null) : null,
          session.userId || null,
          session.hostName || null,
        ]
      )
      session.dbId = id
      return id
    } catch (err) {
      console.error('[db] ensureGameSessionRow failed:', err.message)
      session._dbInsertPromise = null
      return null
    }
  })()
  return session._dbInsertPromise
}

function sanitizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase().slice(0, 120)
  if (!trimmed) return null
  if (!/.+@.+\..+/.test(trimmed)) return null
  return trimmed
}

async function insertAttendee(sessionDbId, { nickname, realName, email, archetype, socketId }) {
  if (!dbPool || !sessionDbId) return null
  try {
    const id = randomUUID()
    await dbPool.query(
      `INSERT INTO "Attendee" (id, "sessionId", nickname, "realName", email, archetype, "socketId", "joinedAt", "finalScore")
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), 0)`,
      [id, sessionDbId, nickname, realName || null, email || null, archetype || null, socketId || null]
    )
    return id
  } catch (err) {
    console.error('[db] attendee insert failed:', err.message)
    return null
  }
}

// Persist a single answer to the audit log. Fire-and-forget — never blocks
// the submit_answer hot path. Idempotent via the (sessionId, participantId,
// questionIndex) unique constraint, so client outbox retries are safe.
//
// Robustness: if `session` is supplied and its DB row hasn't landed yet
// (ensureGameSessionRow Promise still in flight), the payload is queued on
// `session._pendingPersist` and flushed once the row is created. Without
// this, the very first participant's answer can hit the no-op early-return
// and be silently dropped.
function persistAnswer({ session, sessionDbId, attendeeId, participantId, questionIndex, answer, isCorrect, basePoints, streakBonus, points, timeMs, confidence }) {
  if (!dbPool || !participantId) return
  const dbId = sessionDbId || session?.dbId || null
  const payload = {
    attendeeId: attendeeId || null,
    participantId,
    questionIndex: Number(questionIndex) || 0,
    answer,
    isCorrect: isCorrect == null ? null : Boolean(isCorrect),
    basePoints: Number(basePoints) || 0,
    streakBonus: Number(streakBonus) || 0,
    points: Number(points) || 0,
    timeMs: Number(timeMs) || 0,
    confidence: confidence == null ? null : String(confidence),
  }
  if (!dbId) {
    if (session) {
      if (!session._pendingPersist) session._pendingPersist = []
      session._pendingPersist.push(payload)
      // Trigger flush once the in-flight insert completes.
      if (session._dbInsertPromise && !session._pendingFlushBound) {
        session._pendingFlushBound = true
        session._dbInsertPromise.then((newId) => {
          session._pendingFlushBound = false
          flushPendingPersist(session, newId || session.dbId)
        }).catch(() => { session._pendingFlushBound = false })
      }
    } else {
      console.warn(`[db] answer skipped: no sessionDbId and no session ref (pid=${participantId} q=${payload.questionIndex})`)
    }
    return
  }
  insertAnswerRow(dbId, payload)
}

function insertAnswerRow(sessionDbId, p) {
  dbPool.query(
    `INSERT INTO "Answer" (id, "sessionId", "attendeeId", "participantId", "questionIndex", answer, "isCorrect", "basePoints", "streakBonus", points, "timeMs", confidence, "submittedAt")
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, now())
     ON CONFLICT ("sessionId", "participantId", "questionIndex") DO NOTHING`,
    [
      randomUUID(),
      sessionDbId,
      p.attendeeId,
      p.participantId,
      p.questionIndex,
      JSON.stringify(p.answer ?? null),
      p.isCorrect,
      p.basePoints,
      p.streakBonus,
      p.points,
      p.timeMs,
      p.confidence,
    ]
  ).catch(err => console.error(`[db] answer insert failed (pid=${p.participantId} q=${p.questionIndex}):`, err.message))
}

function flushPendingPersist(session, sessionDbId) {
  const flushed = _flushPendingPersist(session, sessionDbId, insertAnswerRow)
  if (flushed > 0) {
    console.log(`[db] flushed ${flushed} buffered answer(s) for session dbId=${sessionDbId}`)
  }
}

// Recovery path used at session end. If RAM scores look wrong (lost participant
// state, partial restart, etc.) we recompute from the Answer audit log.
async function recomputeScoresFromAnswers(sessionDbId) {
  if (!dbPool || !sessionDbId) return null
  try {
    const { rows } = await dbPool.query(
      `SELECT "participantId", SUM(points)::int AS total
         FROM "Answer"
        WHERE "sessionId" = $1
        GROUP BY "participantId"`,
      [sessionDbId]
    )
    const totals = new Map()
    for (const row of rows) totals.set(row.participantId, Number(row.total) || 0)
    return totals
  } catch (err) {
    console.error('[db] recomputeScoresFromAnswers failed:', err.message)
    return null
  }
}

async function updateAttendeeOnLeave(attendeeId, joinedAt) {
  if (!dbPool || !attendeeId) return
  try {
    const durationSec = joinedAt ? Math.round((Date.now() - new Date(joinedAt).getTime()) / 1000) : null
    await dbPool.query(
      `UPDATE "Attendee" SET "leftAt" = COALESCE("leftAt", now()), "durationSec" = COALESCE("durationSec", $1) WHERE id = $2`,
      [durationSec, attendeeId]
    )
  } catch (err) {
    console.error('[db] attendee leave update failed:', err.message)
  }
}

async function finalizeAttendee(attendeeId, { joinedAt, finalScore, team }) {
  if (!dbPool || !attendeeId) return
  try {
    const durationSec = joinedAt ? Math.round((Date.now() - new Date(joinedAt).getTime()) / 1000) : null
    await dbPool.query(
      `UPDATE "Attendee"
       SET "leftAt" = COALESCE("leftAt", now()),
           "durationSec" = COALESCE("durationSec", $1),
           "finalScore" = $2,
           team = $3
       WHERE id = $4`,
      [durationSec, Number(finalScore) || 0, team || null, attendeeId]
    )
  } catch (err) {
    console.error('[db] attendee finalize failed:', err.message)
  }
}

async function getHostName(userId) {
  if (!dbPool || !userId) return null
  try {
    const result = await dbPool.query(`SELECT name FROM "User" WHERE id = $1 LIMIT 1`, [userId])
    return result.rows[0]?.name || null
  } catch { return null }
}

async function getHostPlan(userId) {
  if (!dbPool || !userId) return 'free'
  try {
    const result = await dbPool.query(
      `SELECT plan, status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1 LIMIT 1`,
      [userId]
    )
    const sub = result.rows[0]
    if (!sub) return 'free'
    if (sub.status === 'active' && sub.currentPeriodEnd > new Date()) return 'pro'
    return 'free'
  } catch { return 'free' }
}

// Returns the session's host plan, refreshing from DB if the cached value is
// stale (older than HOST_PLAN_TTL_MS). Prevents Pro features from lingering
// after a mid-session cancellation.
const HOST_PLAN_TTL_MS = 60_000
async function getSessionHostPlan(session) {
  const now = Date.now()
  if (session.hostPlan !== null && session.hostPlanFetchedAt && (now - session.hostPlanFetchedAt) < HOST_PLAN_TTL_MS) {
    return session.hostPlan
  }
  session.hostPlan = await getHostPlan(session.userId)
  session.hostPlanFetchedAt = now
  return session.hostPlan
}

// Verifies that `userId` owns the content with `id` in the given table.
// Returns 'ok' (allow), 'foreign' (owned by someone else — reject), or
// 'unknown' (not found — allow, lets new drafts pass through).
// Anonymous sockets (userId=null) cannot claim any existing id: if the id
// resolves to an owned row, we return 'foreign'.
async function verifyOwnership(table, id, userId) {
  if (!dbPool || !id) return 'ok'
  try {
    const result = await dbPool.query(
      `SELECT "userId" FROM "${table}" WHERE id = $1 LIMIT 1`,
      [id]
    )
    const row = result.rows[0]
    if (!row) return 'unknown'
    if (row.userId === null) return 'ok'
    if (userId && row.userId === userId) return 'ok'
    return 'foreign'
  } catch (err) {
    console.error(`[ownership] ${table} lookup failed:`, err.message)
    return 'ok'
  }
}

// ─── Socket.io auth: verify NextAuth JWT from cookie ──────────
async function getSocketUserId(socket) {
  try {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) return null
    const rawCookie = socket.handshake.headers.cookie
    if (!rawCookie) return null
    const cookies = parseCookie(rawCookie)
    const secureCookie = cookies['__Secure-authjs.session-token']
    const cookieName = secureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token'
    const token = cookies[cookieName]
    if (!token) return null
    const { decode } = await import('@auth/core/jwt')
    const decoded = await decode({ token, secret, salt: cookieName })
    return decoded?.userId || decoded?.sub || null
  } catch { return null }
}

// In-memory session store
const sessions = new Map()
const MAX_CONCURRENT_SESSIONS = 500

// Follow-up quiz store — keyed by unique 8-char code
// { questions, quizTitle, label, createdAt }
const followupSessions = new Map()

// Clean up expired followup sessions every hour (30-day TTL)
setInterval(() => {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000
  for (const [k, v] of followupSessions) {
    if (v.createdAt < cutoff) followupSessions.delete(k)
  }
}, 3600_000)

function generateGameCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

app.prepare().then(async () => {
  // Repair schema drift BEFORE the server starts handling requests. Safe on
  // every boot — ALTER TABLE IF NOT EXISTS is a no-op when columns are present.
  await ensureCriticalColumns()

  const httpServer = createServer((req, res) => {
    // Short-circuit: session lookup API (no auth, reads in-memory sessions Map)
    if (req.method === 'GET' && req.url && req.url.startsWith('/api/session/lookup')) {
      try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const code = String(url.searchParams.get('code') || '').trim()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        if (!/^\d{6}$/.test(code)) {
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, exists: false }))
          return
        }
        const session = sessions.get(code)
        if (!session) {
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, exists: false }))
          return
        }
        const type = session.type === 'presenter' ? 'presenter' : 'quiz'
        res.statusCode = 200
        res.end(JSON.stringify({ ok: true, exists: true, type, status: session.status }))
      } catch (err) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, exists: false }))
      }
      return
    }
    handle(req, res)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.HOST_DOMAIN, process.env.JOIN_DOMAIN].filter(Boolean)
        : '*',
      methods: ['GET', 'POST'],
    },
    // Mobile-friendly ping: tolerate brief tab backgrounding, still detect
    // a true zombie within ~45s. Defaults (25s/20s) were too aggressive for
    // iOS Safari background tabs and caused silent drops during lobby idle.
    pingInterval: 20000,
    pingTimeout: 25000,
  })

  // ─── REDIS ADAPTER (optional) ──────────────────────────────────
  // When REDIS_URL is set, cross-instance event broadcasting is enabled.
  // Note: session state still lives in the in-memory `sessions` Map on each
  // instance — Railway sticky sessions keep a given client pinned to one
  // process. The Redis adapter only relays broadcasts. A future phase will
  // migrate session state to Redis for fully-stateless instances.
  if (process.env.REDIS_URL) {
    try {
      const [{ Redis }, { createAdapter }] = await Promise.all([
        import('ioredis'),
        import('@socket.io/redis-adapter'),
      ])
      const pubClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false })
      const subClient = pubClient.duplicate()
      await Promise.all([
        new Promise((res, rej) => pubClient.once('ready', res).once('error', rej)),
        new Promise((res, rej) => subClient.once('ready', res).once('error', rej)),
      ])
      io.adapter(createAdapter(pubClient, subClient))
      console.log('[socket.io] Redis adapter attached — cross-instance broadcast enabled')
    } catch (err) {
      console.error('[socket.io] Redis adapter failed to attach, falling back to in-memory:', err.message)
    }
  } else {
    console.log('[socket.io] Running with in-memory adapter (single-instance). Set REDIS_URL to enable horizontal scale.')
  }

  // Verify auth on socket connection — attach userId to socket.data
  io.use(async (socket, next) => {
    socket.data.userId = await getSocketUserId(socket)
    next()
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (user: ${socket.data.userId ?? 'anonymous'})`)

    // ─── HOST EVENTS ───────────────────────────────────────────────

    socket.on('create_session', async (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, CreateSessionSchema, rawPayload, callback, 'create_session')
      if (!parsed) return
      const { quizData, sessionMode, anonymousMode, teamMode, teamCount, ghostSessionId, displayMode } = parsed
      if (quizData.id) {
        const ownership = await verifyOwnership('Quiz', quizData.id, socket.data.userId)
        if (ownership === 'foreign') {
          console.warn(`[socket:create_session] ownership rejected for user=${socket.data.userId ?? 'anon'} quizId=${quizData.id}`)
          callback({ success: false, error: 'You do not own this quiz.' })
          return
        }
      }
      if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
        callback({ success: false, error: 'Server capacity reached. Try again in a few minutes.' })
        return
      }
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      const teamNames = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']
      const teamColors = ['#EF4444', '#3B82F6', '#16A34A', '#EAB308', '#7C3AED', '#F97316']
      const numTeams = Math.min(Math.max(teamCount ?? 2, 2), 6)

      const hostName = await getHostName(socket.data.userId)

      // Load ghost players from a past session if requested (Ghost Mode).
      let ghostPlayers = []
      if (ghostSessionId && dbPool) {
        try {
          const { rows } = await dbPool.query(
            'SELECT results FROM "GameSession" WHERE id = $1 AND "userId" = $2',
            [ghostSessionId, socket.data.userId || null]
          )
          if (rows[0]?.results) {
            const pastResults = typeof rows[0].results === 'string'
              ? JSON.parse(rows[0].results)
              : rows[0].results
            const pastLeaderboard = Array.isArray(pastResults.leaderboard) ? pastResults.leaderboard : []
            const totalQ = quizData.questions.length || 1
            ghostPlayers = pastLeaderboard.slice(0, 3).map((entry, i) => ({
              ghostId: `ghost::${i}`,
              name: `👻 ${entry.name || 'Ghost'}`,
              finalScore: entry.score || 0,
              perQuestionScore: Math.round((entry.score || 0) / totalQ),
              archetype: entry.archetype || 'ghost',
              score: 0,
            }))
          }
        } catch (err) {
          console.error('[ghost] failed to load ghost session:', err.message)
        }
      }

      const hostResumeToken = randomUUID()
      sessions.set(gameCode, {
        hostSocketId: socket.id,
        hostResumeToken,         // Layer 3.3 — used by host_resume to reclaim session
        quizData,
        currentQuestionIndex: -1,
        participants: new Map(), // socketId → { name, archetype, score, answers, team }
        status: 'lobby',
        sessionMode: sessionMode ?? 'competitive',
        // Accuracy mode = competitive flow but flat scoring (100 per correct,
        // no speed bonus, no streak). Defaults to classic for everything else.
        scoringFormula: sessionMode === 'accuracy' ? 'accuracy' : 'classic',
        displayMode: displayMode ?? 'full-device',
        anonymousMode: anonymousMode ?? false,
        teamMode: teamMode ?? false,
        teamCount: numTeams,
        teamNames: teamNames.slice(0, numTeams),
        teamColors: teamColors.slice(0, numTeams),
        teamJoinCounter: 0,
        userId: socket.data.userId || null,
        hostName,
        hostPlan: null,
        startedAt: Date.now(),
        ghostPlayers,            // Ghost Mode — synthetic leaderboard entries
        // Auto-end bookkeeping — per the "lower of two" rule (timer expires
        // OR all active participants answered). Reset on each question_show.
        questionEnded: false,
        endTimer: null,
        // Standings-cadence + top-movers bookkeeping (Phase 1). scoringFormula
        // is set above based on sessionMode (accuracy → 'accuracy', else
        // 'classic') so we don't redeclare it here.
        standingsCadence: sessionMode === 'accuracy' ? 999 : 3,
        scoredQuestionsSeen: 0,
        previousTopThree: [],
        previousRanks: new Map(),
        lastStandingsShownAt: 0,
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      // Start the periodic state broadcast right away so the host UI can
      // reconcile even before the first participant joins.
      startSessionStateBroadcast(io, gameCode, sessions.get(gameCode))
      console.log(`[session] created: ${gameCode}${teamMode ? ` (teams: ${numTeams})` : ''}`)
      callback({ success: true, gameCode, hostResumeToken })
    })

    // Layer 3.3 — host re-attach. Host's tab refreshes or socket dies and the
    // 5-min host disconnect grace (server.mjs disconnect handler) is still
    // running. The host client presents its session token from sessionStorage;
    // server rebinds hostSocketId to the new socket and the host UI keeps the
    // live game.
    socket.on('host_resume', (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, HostResumeSchema, rawPayload, callback, 'host_resume')
      if (!parsed) return
      const { gameCode, token } = parsed
      const session = sessions.get(gameCode)
      if (!session) {
        callback({ success: false, error: 'Session not found.' })
        return
      }
      if (!session.hostResumeToken || session.hostResumeToken !== token) {
        console.warn(`[host_resume] token mismatch code=${gameCode} sid=${socket.id}`)
        callback({ success: false, error: 'Invalid host resume token.' })
        return
      }
      // Optional defense: require same userId if both sides have one
      if (session.userId && socket.data.userId && session.userId !== socket.data.userId) {
        console.warn(`[host_resume] userId mismatch code=${gameCode}`)
        callback({ success: false, error: 'User mismatch.' })
        return
      }
      session.hostSocketId = socket.id
      delete session.hostDisconnectedAt
      delete session.hostDisconnectedSocketId
      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[host_resume] reattached code=${gameCode} sid=${socket.id}`)
      callback({
        success: true,
        gameCode,
        type: session.type || 'quiz',
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        currentSlideIndex: session.currentSlideIndex,
        participantCount: session.participants.size,
      })
    })

    socket.on('start_quiz', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'start_quiz')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.status = 'active'
      session.currentQuestionIndex = 0
      const question = sanitizeQuestion(session.quizData.questions[0])
      const startAt = Date.now() + 3500  // 3-second countdown window
      session.questionStartedAt = startAt

      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: 0,
        total: session.quizData.questions.length,
        serverTimestamp: session.questionStartedAt,
        startAt,
      })

      scheduleQuestionAutoEnd(io, gameCode, session)

      console.log(`[session] started: ${gameCode}`)
    })

    socket.on('pause_quiz', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'pause_quiz')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      session.paused = true
      // Stop the auto-end timer and snapshot how much time remains so resume
      // can reschedule with the same remaining ms (rather than restarting the
      // full timer or letting it elapse during pause).
      if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
      session.pauseRemainingMs = typeof session.questionEndsAt === 'number'
        ? Math.max(0, session.questionEndsAt - Date.now())
        : null
      io.to(`session:${gameCode}`).emit('quiz_paused')
      console.log(`[session] paused: ${gameCode}`)
    })

    socket.on('resume_quiz', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'resume_quiz')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      session.paused = false
      const timer = session.quizData?.questions[session.currentQuestionIndex]?.timerSeconds || 20
      // Re-anchor the question's wall-clock end time to "now + remaining".
      // Re-broadcast remainingMs to clients so their visual timers re-sync.
      const pausedRemainingMs = typeof session.pauseRemainingMs === 'number'
        ? session.pauseRemainingMs
        : null
      const remainingMs = pausedRemainingMs ?? (() => {
        const elapsed = session.questionStartedAt ? Date.now() - session.questionStartedAt : 0
        return Math.max(0, timer * 1000 - elapsed)
      })()
      session.pauseRemainingMs = null
      // Restart the auto-end timer only if there's actually time left and the
      // question wasn't already ended while paused (e.g. by host advancing).
      if (!session.questionEnded && pausedRemainingMs !== null && pausedRemainingMs > 0) {
        scheduleQuestionAutoEnd(io, gameCode, session, pausedRemainingMs)
      }
      io.to(`session:${gameCode}`).emit('quiz_resumed', { remainingMs })
      console.log(`[session] resumed: ${gameCode}`)
    })

    // Host manually ended the live question (confirm-tap "End Now") — fire
    // emitQuestionEnded for the current index if it isn't already ended,
    // mirroring what the auto-end timer would have done. The host then stays
    // on the question-review screen and advances when ready.
    socket.on('end_question', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'end_question')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      if (session.questionEnded) return
      session.questionEnded = true
      if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)
    })

    // Host advanced from the question-review screen to the standings screen.
    // Server just relays the signal so all participants flip phase together;
    // no scoring side-effect (the question has already been ended either by
    // the auto-end timer, the all-answered detector, or a manual end).
    socket.on('show_standings', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'show_standings')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      io.to(`session:${gameCode}`).emit('show_standings')
    })

    socket.on('next_question', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'next_question')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.currentQuestionIndex++
      const { currentQuestionIndex, quizData } = session

      if (currentQuestionIndex >= quizData.questions.length) {
        // Quiz over — this path is dead code: the host client emits end_session
        // on the last question instead of next_question. Kept for safety.
        emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)
        const leaderboard = buildLeaderboard(session.participants)
        const teamLeaderboard = buildTeamLeaderboard(session)
        const questionStats = buildQuestionStats(session)
        session.status = 'ended'
        socket.emit('session_ended', { leaderboard, teamLeaderboard, sessionMode: session.sessionMode, questionStats })
        socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, teamLeaderboard, sessionMode: session.sessionMode })
        console.log(`[session] ended: ${gameCode}`)

        // Persist to DB (with retry)
        persistGameSession({
          code: gameCode,
          type: 'quiz',
          quizId: session.quizData.id || null,
          presentationId: null,
          userId: session.userId,
          hostName: session.hostName || null,
          status: 'ended',
          participantCount: realParticipantCount(session.participants),
          sessionId: session.dbId || null,
          results: {
            leaderboard,
            teamLeaderboard,
            questionStats,
            quizTitle: session.quizData.title,
            questionCount: session.quizData.questions.length,
            maxScore: computeMaxScore(session),
            duration: Math.round((Date.now() - (session.startedAt || Date.now())) / 1000),
          },
        })
        setTimeout(() => sessions.delete(gameCode), 5 * 60 * 1000)
        return
      }

      // Only fire question_ended for the PREVIOUS question if it hasn't
      // already been ended by the auto-timer or the all-answered path.
      // Double-emitting caused the client to collapse standings → question in
      // a single microtask, hiding the standings screen entirely.
      const prevIndex = currentQuestionIndex - 1
      if (!session.questionEnded) {
        if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
        session.questionEnded = true
        emitQuestionEnded(io, gameCode, session, prevIndex)
      }

      const startAt = Date.now() + 3500  // 3-second countdown window
      session.questionStartedAt = startAt
      const question = sanitizeQuestion(quizData.questions[currentQuestionIndex])
      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: currentQuestionIndex,
        total: quizData.questions.length,
        serverTimestamp: session.questionStartedAt,
        startAt,
      })

      scheduleQuestionAutoEnd(io, gameCode, session)
    })

    // P3.4 — Drawing question type: participant submits a drawing (base64 JPEG).
    // The drawing is stored in their answer record and relayed to the host for gallery display.
    // Payload limited server-side: dataUrl is truncated at 100 KB to prevent abuse.
    socket.on('submit_drawing', (rawPayload, ackCallback) => {
      const parsed = validateSocketPayload(socket, SubmitDrawingSchema, rawPayload, undefined, 'submit_drawing')
      if (!parsed) return
      const { gameCode, participantId: incomingPid, dataUrl } = parsed
      const session = sessions.get(gameCode)
      const ack = typeof ackCallback === 'function' ? ackCallback : null

      const reject = (reason, extra = {}) => {
        console.warn(`[submit_drawing:reject] code=${gameCode} sid=${socket.id} pid=${incomingPid || 'none'} reason=${reason}`)
        socket.emit('answer_rejected', { reason, gameCode, ...extra })
        if (ack) ack({ accepted: false, reason, ...extra })
      }

      if (!session) return reject('no_session')
      let participant = (incomingPid && session.participantsById?.get(incomingPid)) || session.participants.get(socket.id)
      // Same disconnected-map rescue as submit_answer.
      if (!participant && incomingPid && session.disconnectedParticipants) {
        for (const [key, entry] of session.disconnectedParticipants.entries()) {
          if (entry?.participant?.participantId === incomingPid) {
            const recovered = entry.participant
            session.participants.delete(entry.socketId)
            delete recovered.disconnectedAt
            delete recovered.disconnectedSocketId
            recovered.socketId = socket.id
            session.participants.set(socket.id, recovered)
            session.disconnectedParticipants.delete(key)
            participant = recovered
            console.warn(`[submit_drawing:recover] code=${gameCode} pid=${incomingPid} re-linked from disconnected map`)
            break
          }
        }
      }
      if (!participant) return reject('unknown_participant')
      if (participant.socketId !== socket.id) {
        if (participant.socketId && session.participants.has(participant.socketId)) {
          session.participants.delete(participant.socketId)
        }
        participant.socketId = socket.id
        session.participants.set(socket.id, participant)
      }
      const qi = session.currentQuestionIndex
      const q = session.quizData.questions[qi]
      if (!q || q.type !== 'drawing') return reject('no_question', { questionIndex: qi })
      if (participant.answers[qi] !== undefined) return reject('duplicate', { questionIndex: qi })

      const safeDataUrl = typeof dataUrl === 'string' ? dataUrl.slice(0, 102400) : ''
      participant.answers[qi] = { answer: 'drawing', dataUrl: safeDataUrl, timeMs: 0 }

      // Relay to host for live gallery
      io.to(`host:${gameCode}`).emit('drawing_submitted', {
        name: participant.name,
        archetype: participant.archetype,
        dataUrl: safeDataUrl,
      })

      socket.emit('answer_confirmed', {
        isCorrect: false,
        pointsEarned: 0,
        totalScore: participant.score,
        streakCount: 0,
      })
      if (ack) ack({ accepted: true, questionIndex: qi })

      io.to(`host:${gameCode}`).emit('answer_received', {
        total: getConnectedCount(session),
        connectedCount: getConnectedCount(session),
        answered: countAnswers(session, qi),
      })
    })

    socket.on('end_session', async (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'end_session')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      // Stop the pending auto-end timer so it doesn't fire after the session
      // has been torn down.
      if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
      stopSessionStateBroadcast(session)
      session.questionEnded = true

      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)

      // Recovery: reconcile RAM scores against the Answer audit log. If the
      // log has higher totals (e.g. RAM was wiped mid-game and we recreated
      // participants), use the DB number — protects participants from getting
      // a zero-score result due to in-memory state loss.
      const dbTotals = await recomputeScoresFromAnswers(session.dbId)
      if (dbTotals && dbTotals.size > 0) {
        for (const p of session.participants.values()) {
          const dbScore = p.participantId ? dbTotals.get(p.participantId) : undefined
          if (dbScore !== undefined && dbScore > (p.score || 0)) {
            console.warn(`[recover] code=${gameCode} pid=${p.participantId} ram=${p.score} db=${dbScore} -> using db`)
            p.score = dbScore
          }
        }
      }

      const leaderboard = buildLeaderboard(session.participants)
      const teamLeaderboard = buildTeamLeaderboard(session)
      const questionStats = buildQuestionStats(session)
      session.status = 'ended'
      // Host gets full data including questionStats
      socket.emit('session_ended', { leaderboard, teamLeaderboard, sessionMode: session.sessionMode, questionStats })
      // Participants only get leaderboard + sessionMode flag + team leaderboard
      socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, teamLeaderboard, sessionMode: session.sessionMode })
      console.log(`[session] force-ended: ${gameCode}`)

      // Finalize Attendee rows for every still-tracked participant.
      if (session.dbId) {
        const updates = []
        for (const p of session.participants.values()) {
          if (!p.attendeeId) continue
          updates.push(finalizeAttendee(p.attendeeId, {
            joinedAt: p.joinedAt,
            finalScore: p.score || 0,
            team: p.team?.name || null,
          }).catch(console.error))
        }
        await Promise.all(updates)
      }

      // Persist to DB (with retry)
      persistGameSession({
        code: gameCode,
        type: 'quiz',
        quizId: session.quizData.id || null,
        presentationId: null,
        userId: session.userId,
        hostName: session.hostName || null,
        status: 'ended',
        participantCount: realParticipantCount(session.participants),
        sessionId: session.dbId || null,
        results: {
          leaderboard,
          teamLeaderboard,
          questionStats,
          quizTitle: session.quizData.title,
          questionCount: session.quizData.questions.length,
          maxScore: computeMaxScore(session),
          duration: Math.round((Date.now() - (session.startedAt || Date.now())) / 1000),
        },
      })

      // Clean up session after grace period
      setTimeout(() => sessions.delete(gameCode), 5 * 60 * 1000)
    })

    // ─── PRESENTER MODE EVENTS ─────────────────────────────────────

    socket.on('create_presenter_session', async (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, CreatePresenterSessionSchema, rawPayload, callback, 'create_presenter_session')
      if (!parsed) return
      const { presentationData } = parsed
      if (presentationData.id) {
        const ownership = await verifyOwnership('Presentation', presentationData.id, socket.data.userId)
        if (ownership === 'foreign') {
          console.warn(`[socket:create_presenter_session] ownership rejected for user=${socket.data.userId ?? 'anon'} presentationId=${presentationData.id}`)
          callback({ success: false, error: 'You do not own this presentation.' })
          return
        }
      }
      if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
        callback({ success: false, error: 'Server capacity reached. Try again in a few minutes.' })
        return
      }
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      const presenterHostName = await getHostName(socket.data.userId)

      const presenterHostResumeToken = randomUUID()
      sessions.set(gameCode, {
        hostSocketId: socket.id,
        hostResumeToken: presenterHostResumeToken,
        type: 'presenter',
        presentationData,
        currentSlideIndex: 0,
        participants: new Map(), // socketId → { name, archetype }
        status: 'active',
        // Per-slide aggregates keyed by slideIndex
        aggregates: {},
        userId: socket.data.userId || null,
        hostPlan: null, // lazy-loaded on first participant join
        hostName: presenterHostName,
        startedAt: Date.now(),
        // When false, content slides do not mirror to participant phones — they
        // see a "Waiting for next question" screen. Interactive slides always
        // show the input UI regardless of this flag.
        mirrorToParticipants: false,
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      startSessionStateBroadcast(io, gameCode, sessions.get(gameCode))
      console.log(`[presenter] created: ${gameCode}`)
      callback({ success: true, gameCode, hostResumeToken: presenterHostResumeToken })
    })

    socket.on('presenter_next_slide', (rawPayload) => {
      const parsed = validateSocketPayload(socket, PresenterSlideSchema, rawPayload, undefined, 'presenter_next_slide')
      if (!parsed) return
      const { gameCode, slideIndex } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      session.currentSlideIndex = slideIndex
      if (!session.aggregates[slideIndex]) {
        session.aggregates[slideIndex] = { total: 0, counts: [], words: {}, scores: [], emojis: {}, pins: [] }
      }

      const currentSlide = session.presentationData.slides[slideIndex]
      io.to(`session:${gameCode}`).emit('presenter_slide_changed', {
        slideIndex,
        total: session.presentationData.slides.length,
        slide: currentSlide,
        responseMode: currentSlide?.responseMode || 'instant',
        mirrorToParticipants: !!session.mirrorToParticipants,
      })
      console.log(`[presenter] ${gameCode} → slide ${slideIndex}`)
    })

    socket.on('presenter_prev_slide', (rawPayload) => {
      const parsed = validateSocketPayload(socket, PresenterSlideSchema, rawPayload, undefined, 'presenter_prev_slide')
      if (!parsed) return
      const { gameCode, slideIndex } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      session.currentSlideIndex = slideIndex
      // Reset aggregate so fresh votes can come in
      session.aggregates[slideIndex] = { total: 0, counts: [], words: {}, scores: [], emojis: {}, pins: [] }
      // Re-open voting for this slide for all participants
      for (const p of session.participants.values()) {
        if (p.votedSlides) delete p.votedSlides[slideIndex]
      }
      const currentSlide = session.presentationData.slides[slideIndex]
      io.to(`session:${gameCode}`).emit('presenter_slide_changed', {
        slideIndex,
        total: session.presentationData.slides.length,
        slide: currentSlide,
        responseMode: currentSlide?.responseMode || 'instant',
        mirrorToParticipants: !!session.mirrorToParticipants,
      })
    })

    // Host toggles whether content slides mirror to participant phones.
    // No schema validation because the payload is trivial — the authZ check
    // below (hostSocketId) prevents abuse.
    socket.on('toggle_mirror_to_participants', ({ gameCode, mirror } = {}) => {
      if (typeof gameCode !== 'string') return
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return
      session.mirrorToParticipants = !!mirror
      io.to(`session:${gameCode}`).emit('mirror_mode_changed', { mirrorToParticipants: session.mirrorToParticipants })
    })

    socket.on('submit_presenter_response', (rawPayload, ackCallback) => {
      const parsed = validateSocketPayload(socket, PresenterResponseSchema, rawPayload, undefined, 'submit_presenter_response')
      if (!parsed) return
      const { gameCode, slideIndex, response, participantId: incomingPid } = parsed
      const session = sessions.get(gameCode)
      const ack = typeof ackCallback === 'function' ? ackCallback : null
      if (!session || session.type !== 'presenter') {
        if (ack) ack({ accepted: false, reason: 'no_session' })
        return
      }

      let participant = session.participants.get(socket.id)
      // Recover via participantId if the socket was rebound after a reconnect.
      if (!participant && incomingPid && session.participantsById) {
        const byId = session.participantsById.get(incomingPid)
        if (byId) {
          if (byId.socketId && session.participants.has(byId.socketId)) {
            session.participants.delete(byId.socketId)
          }
          byId.socketId = socket.id
          delete byId.disconnectedAt
          delete byId.disconnectedSocketId
          session.participants.set(socket.id, byId)
          participant = byId
        }
      }
      // Last-resort: scan disconnectedParticipants by participantId.
      if (!participant && incomingPid && session.disconnectedParticipants) {
        for (const [key, entry] of session.disconnectedParticipants.entries()) {
          if (entry?.participant?.participantId === incomingPid) {
            const recovered = entry.participant
            session.participants.delete(entry.socketId)
            delete recovered.disconnectedAt
            delete recovered.disconnectedSocketId
            recovered.socketId = socket.id
            session.participants.set(socket.id, recovered)
            session.disconnectedParticipants.delete(key)
            participant = recovered
            console.warn(`[presenter_response:recover] code=${gameCode} pid=${incomingPid} re-linked from disconnected map`)
            break
          }
        }
      }
      if (!participant) {
        socket.emit('answer_rejected', { reason: 'unknown_participant', gameCode })
        if (ack) ack({ accepted: false, reason: 'unknown_participant' })
        return
      }

      // Prevent double-voting per slide per participant
      if (participant.votedSlides?.[slideIndex]) return
      if (!participant.votedSlides) participant.votedSlides = {}
      participant.votedSlides[slideIndex] = true

      // Initialize aggregate for this slide
      if (!session.aggregates[slideIndex]) {
        session.aggregates[slideIndex] = { total: 0, counts: [], words: {}, scores: [], emojis: {}, pins: [] }
      }
      const agg = session.aggregates[slideIndex]
      agg.total++

      // Accumulate based on response type
      const slide = session.presentationData.slides[slideIndex]
      if (slide?.type === 'word_cloud' || slide?.type === 'open_text') {
        const word = String(response).trim().toLowerCase().slice(0, 100)
        if (word) agg.words[word] = (agg.words[word] || 0) + 1
      } else if (slide?.type === 'rating_scale' || slide?.type === 'scale_100') {
        agg.scores.push(Number(response))
      } else if (slide?.type === 'emoji_pulse') {
        const em = String(response)
        agg.emojis[em] = (agg.emojis[em] || 0) + 1
      } else if (slide?.type === 'pinpoint' || slide?.type === 'grid_2x2') {
        const pin = typeof response === 'object' ? response : {}
        agg.pins.push({ x: Number(pin.x) || 0, y: Number(pin.y) || 0 })
      } else {
        // All bar-chart types: multiple_choice, word_duel, live_race, ranking, image_choice, quick_fire
        const idx = Number(response)
        while (agg.counts.length <= idx) agg.counts.push(0)
        agg.counts[idx]++
      }

      socket.emit('presenter_response_confirmed')
      if (ack) ack({ accepted: true, slideIndex })

      // Route aggregate updates based on responseMode
      const responseMode = slide?.responseMode || 'instant'
      if (responseMode === 'instant') {
        // Broadcast to everyone (host + all participants)
        io.to(`session:${gameCode}`).emit('presenter_aggregate_updated', agg)
      } else {
        // on_click and private: only host sees aggregates until revealed
        io.to(`host:${gameCode}`).emit('presenter_aggregate_updated', agg)
      }
    })

    // Host reveals results to participants (on_click mode)
    socket.on('presenter_reveal_results', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'presenter_reveal_results')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      const slideIndex = session.currentSlideIndex
      const agg = session.aggregates[slideIndex]
      if (!agg) return

      agg.revealed = true
      io.to(`session:${gameCode}`).emit('presenter_results_revealed', agg)
    })

    socket.on('end_presenter_session', async (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'end_presenter_session')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      session.status = 'ended'
      stopSessionStateBroadcast(session)

      // Send aggregates to host before cleanup so client can persist analytics
      socket.emit('presenter_session_summary', {
        aggregates: session.aggregates,
        participantCount: realParticipantCount(session.participants),
        slides: session.presentationData.slides,
      })

      io.to(`session:${gameCode}`).emit('presenter_ended')

      // Finalize Attendee rows for presenter participants.
      if (session.dbId) {
        const updates = []
        for (const p of session.participants.values()) {
          if (!p.attendeeId) continue
          updates.push(finalizeAttendee(p.attendeeId, {
            joinedAt: p.joinedAt,
            finalScore: 0,
            team: null,
          }).catch(console.error))
        }
        await Promise.all(updates)
      }

      // Persist to DB (with retry)
      persistGameSession({
        code: gameCode,
        type: 'presentation',
        quizId: null,
        presentationId: session.presentationData.id || null,
        userId: session.userId,
        hostName: session.hostName || null,
        status: 'ended',
        participantCount: realParticipantCount(session.participants),
        sessionId: session.dbId || null,
        results: {
          aggregates: session.aggregates,
          presentationTitle: session.presentationData.title,
          slideCount: session.presentationData.slides.length,
          duration: Math.round((Date.now() - (session.startedAt || Date.now())) / 1000),
        },
      })

      sessions.delete(gameCode)
      console.log(`[presenter] ended: ${gameCode}`)
    })

    socket.on('join_presenter_session', async (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, JoinSessionSchema, rawPayload, callback, 'join_presenter_session')
      if (!parsed) return
      const { gameCode, displayName, email, participantId: incomingPid } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.type !== 'presenter') {
        callback({ success: false, error: 'Presenter session not found.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'Session has ended.' })
        return
      }

      // Reconnect path — same shape as quiz join_session: prefer participantId
      // match, then fall back to disconnected-name grace.
      if (incomingPid) {
        const existing = session.participantsById?.get(incomingPid)
        if (existing) {
          if (existing.socketId && existing.socketId !== socket.id && session.participants.has(existing.socketId)) {
            session.participants.delete(existing.socketId)
          }
          existing.socketId = socket.id
          delete existing.disconnectedAt
          delete existing.disconnectedSocketId
          session.participants.set(socket.id, existing)
          const dKey = (existing.realName || existing.name || '').toLowerCase()
          if (dKey) session.disconnectedParticipants?.delete(dKey)
          socket.join(`session:${gameCode}`)
          const currentSlide = session.presentationData.slides[session.currentSlideIndex]
          callback({
            success: true,
            presentationTitle: session.presentationData.title,
            currentSlideIndex: session.currentSlideIndex,
            totalSlides: session.presentationData.slides.length,
            currentSlide,
            responseMode: currentSlide?.responseMode || 'instant',
            archetype: existing.archetype,
            reconnected: true,
            participantId: existing.participantId,
          })
          io.to(`host:${gameCode}`).emit('presenter_participant_rejoined', {
            name: existing.name,
            participantId: existing.participantId,
            archetype: existing.archetype,
            connectedCount: getConnectedCount(session),
          })
          console.log(`[presenter] ${existing.name} reconnected via participantId to ${gameCode}`)
          return
        }
      }

      // Participant limit check for presenter sessions
      const presenterPlan = await getSessionHostPlan(session)
      const presenterMaxP = presenterPlan === 'pro' ? Infinity : 50
      if (getConnectedCount(session) >= presenterMaxP) {
        callback({ success: false, error: 'This session is full (max 50 participants on Free plan). The host can upgrade to Pro for unlimited participants.' })
        return
      }

      const safeName = String(displayName ?? '').slice(0, 30).trim() || 'Anonymous'
      const safeEmail = sanitizeEmail(email)
      const archetype = assignArchetype()
      const newPid = incomingPid || randomUUID()
      const participant = {
        participantId: newPid,
        socketId: socket.id,
        name: safeName,
        realName: safeName,
        archetype,
        votedSlides: {},
        joinedAt: new Date(),
      }
      session.participants.set(socket.id, participant)
      if (!session.participantsById) session.participantsById = new Map()
      session.participantsById.set(newPid, participant)
      socket.join(`session:${gameCode}`)

      // Persist attendee record (best-effort, don't block join on DB error).
      try {
        const dbId = await ensureGameSessionRow(session, gameCode, 'presentation')
        if (dbId) {
          const attendeeId = await insertAttendee(dbId, {
            nickname: safeName,
            realName: safeName,
            email: safeEmail,
            archetype,
            socketId: socket.id,
          })
          if (attendeeId) participant.attendeeId = attendeeId
        }
      } catch (err) {
        console.error('[db] presenter attendee persist failed:', err)
      }

      const currentSlide = session.presentationData.slides[session.currentSlideIndex]

      callback({
        success: true,
        presentationTitle: session.presentationData.title,
        currentSlideIndex: session.currentSlideIndex,
        totalSlides: session.presentationData.slides.length,
        currentSlide,
        responseMode: currentSlide?.responseMode || 'instant',
        archetype,
        participantId: newPid,
      })

      io.to(`host:${gameCode}`).emit('presenter_participant_joined', {
        name: safeName,
        participantId: newPid,
        archetype,
        count: getConnectedCount(session),
        connectedCount: getConnectedCount(session),
      })
      startSessionStateBroadcast(io, gameCode, session)
      console.log(`[presenter] ${displayName} joined ${gameCode}`)
    })

    // ─── FOLLOW-UP EVENTS ───────────────────────────────────────────

    socket.on('generate_followup', async (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, callback, 'generate_followup')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) {
        callback({ success: false, error: 'Session not found.' })
        return
      }

      // Pro-only feature — re-query with TTL so cancellations take effect mid-session
      const followupPlan = await getSessionHostPlan(session)
      if (followupPlan !== 'pro') {
        callback({ success: false, error: 'Spaced retrieval follow-ups are a Pro feature. Upgrade to access.' })
        return
      }

      // Sample up to 5 scoreable questions from the session
      const scoreable = session.quizData.questions.filter(
        q => q.type === 'mcq' || q.type === 'truefalse'
      )
      if (scoreable.length === 0) {
        callback({ success: false, error: 'No scoreable questions in this session.' })
        return
      }
      const sampled = [...scoreable].sort(() => Math.random() - 0.5).slice(0, 5)

      const LABELS = ['Day 1 Follow-up', 'Day 7 Follow-up', 'Day 30 Follow-up']
      const followups = LABELS.map(label => {
        let code
        do { code = Math.random().toString(36).substr(2, 8).toUpperCase() }
        while (followupSessions.has(code))
        followupSessions.set(code, {
          questions: sampled,
          quizTitle: session.quizData.title,
          label,
          createdAt: Date.now(),
        })
        return { label, code }
      })

      console.log(`[followup] generated 3 follow-ups for session ${gameCode}`)
      callback({ success: true, followups })
    })

    socket.on('join_followup', (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, JoinFollowupSchema, rawPayload, callback, 'join_followup')
      if (!parsed) return
      const { code } = parsed
      const followup = followupSessions.get(code)
      if (!followup) {
        callback({ success: false, error: 'Follow-up not found or expired.' })
        return
      }
      callback({
        success: true,
        questions: followup.questions,
        quizTitle: followup.quizTitle,
        label: followup.label,
      })
    })

    // ─── PARTICIPANT EVENTS ─────────────────────────────────────────

    socket.on('join_session', async (rawPayload, callback) => {
      // Map legacy field (gameCode + displayName) through the schema so we
      // don't drop existing clients that send the canonical keys.
      const normalised = rawPayload && typeof rawPayload === 'object'
        ? {
            gameCode: String(rawPayload.gameCode ?? '').trim(),
            displayName: String(rawPayload.displayName ?? '').trim(),
            email: rawPayload.email ?? '',
            participantId: typeof rawPayload.participantId === 'string' && rawPayload.participantId
              ? rawPayload.participantId
              : undefined,
          }
        : rawPayload
      const parsed = validateSocketPayload(socket, JoinSessionSchema, normalised, callback, 'join_session')
      if (!parsed) return
      const { gameCode, displayName, email, participantId: incomingPid } = parsed
      const session = sessions.get(gameCode)

      if (!session) {
        callback({ success: false, error: 'Game not found. Check the code and try again.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'This game has already ended.' })
        return
      }

      // Truncate display name server-side for safety
      const safeName = String(displayName ?? '').slice(0, 30).trim() || 'Anonymous'

      // ─── Reconnect path 1 — participantId match (preferred) ──────────────
      // Survives any disconnect length: localStorage in the participant's
      // browser keeps the same UUID across socket drops, tab close, and even
      // browser restarts. Keyed against session.participantsById which is
      // never expired by the disconnect grace timer.
      if (incomingPid) {
        const existing = session.participantsById?.get(incomingPid)
        if (existing) {
          // Move primary key from the old socket.id (if any) to the new one.
          if (existing.socketId && existing.socketId !== socket.id && session.participants.has(existing.socketId)) {
            session.participants.delete(existing.socketId)
          }
          existing.socketId = socket.id
          delete existing.disconnectedAt
          delete existing.disconnectedSocketId
          session.participants.set(socket.id, existing)
          // Also clear any pending name-based grace entry for this participant.
          const dKey = (existing.realName || existing.name || safeName).toLowerCase()
          session.disconnectedParticipants?.delete(dKey)
          socket.join(`session:${gameCode}`)
          console.log(`[participant] ${existing.realName || existing.name} reconnected via participantId to ${gameCode}`)
          callback({
            success: true,
            status: session.status,
            quizTitle: session.quizData.title,
            archetype: existing.archetype,
            sessionMode: session.sessionMode,
            anonymousMode: session.anonymousMode,
            team: existing.team,
            showBranding: (session.hostPlan ?? 'free') !== 'pro',
            reconnected: true,
            score: existing.score,
            participantId: existing.participantId,
          })
          sendCurrentQuestionToSocket(socket, session)
          // Notify host that a known participant returned. Distinct from
          // participant_joined so the UI updates the existing entry rather
          // than creating a new one (which would inflate the count).
          io.to(`host:${gameCode}`).emit('participant_rejoined', {
            name: existing.name,
            participantId: existing.participantId,
            archetype: existing.archetype,
            team: existing.team,
            connectedCount: getConnectedCount(session),
          })
          return
        }
      }

      // Participant limit check — re-query with TTL so cancellations take effect mid-session.
      // Skipped above because reconnects (matched participantId) don't add to the headcount.
      const hostPlan = await getSessionHostPlan(session)
      const maxParticipants = hostPlan === 'pro' ? Infinity : 50
      if (session.participants.size >= maxParticipants) {
        callback({ success: false, error: 'This session is full (max 50 participants on Free plan). The host can upgrade to Pro for unlimited participants.' })
        return
      }

      // ─── Reconnect path 2 — legacy name-based grace (fallback) ───────────
      // Tries name match first; if that fails BUT we have a participantId,
      // also scan the disconnected map by participantId — handles cases where
      // the archetype/displayName drifts on rejoin (e.g. anonymous-mode
      // reassignment) but the localStorage UUID is still intact.
      const disconnectedKey = safeName.toLowerCase()
      let disconnectedEntry = session.disconnectedParticipants?.get(disconnectedKey)
      let matchedKey = disconnectedKey
      if (!disconnectedEntry && incomingPid && session.disconnectedParticipants) {
        for (const [key, entry] of session.disconnectedParticipants.entries()) {
          if (entry?.participant?.participantId === incomingPid) {
            disconnectedEntry = entry
            matchedKey = key
            break
          }
        }
      }
      if (disconnectedEntry) {
        // Restore the participant under the new socket ID
        const oldParticipant = disconnectedEntry.participant
        session.participants.delete(disconnectedEntry.socketId)
        delete oldParticipant.disconnectedAt
        delete oldParticipant.disconnectedSocketId
        oldParticipant.socketId = socket.id
        session.participants.set(socket.id, oldParticipant)
        session.disconnectedParticipants.delete(matchedKey)
        // Backfill participantId on the existing entry if the client has one now.
        if (incomingPid && !oldParticipant.participantId) {
          oldParticipant.participantId = incomingPid
          if (!session.participantsById) session.participantsById = new Map()
          session.participantsById.set(incomingPid, oldParticipant)
        }
        socket.join(`session:${gameCode}`)
        console.log(`[participant] ${safeName} reconnected (name/pid match) to ${gameCode}`)
        callback({
          success: true,
          status: session.status,
          quizTitle: session.quizData.title,
          archetype: oldParticipant.archetype,
          sessionMode: session.sessionMode,
          anonymousMode: session.anonymousMode,
          team: oldParticipant.team,
          showBranding: (session.hostPlan ?? 'free') !== 'pro',
          reconnected: true,
          score: oldParticipant.score,
          participantId: oldParticipant.participantId,
        })
        sendCurrentQuestionToSocket(socket, session)
        // Same guarantee as the participantId fast path — host UI gets a
        // rejoin event so its Map entry is updated, not duplicated.
        io.to(`host:${gameCode}`).emit('participant_rejoined', {
          name: oldParticipant.name,
          participantId: oldParticipant.participantId || null,
          archetype: oldParticipant.archetype,
          team: oldParticipant.team,
          connectedCount: getConnectedCount(session),
        })
        return
      }

      const archetype = assignArchetype()
      // Display name shown to others: archetype in anonymous mode, else user name.
      // Always store BOTH original `name` and `archetype` on the participant.
      const displayStoredName = session.anonymousMode ? archetype : safeName

      // Team assignment (round-robin)
      let team = null
      if (session.teamMode) {
        const teamIndex = session.teamJoinCounter % session.teamCount
        team = { index: teamIndex, name: session.teamNames[teamIndex], color: session.teamColors[teamIndex] }
        session.teamJoinCounter++
      }

      const newPid = incomingPid || randomUUID()
      const participant = {
        participantId: newPid,
        socketId: socket.id,
        name: displayStoredName,
        realName: safeName,
        archetype,
        score: 0,
        answers: [],
        team,
        joinedAt: new Date(),
      }
      session.participants.set(socket.id, participant)
      if (!session.participantsById) session.participantsById = new Map()
      session.participantsById.set(newPid, participant)
      socket.join(`session:${gameCode}`)

      // Persist attendee record (best-effort, don't block join on DB error).
      const safeEmail = sanitizeEmail(email)
      try {
        const dbId = await ensureGameSessionRow(session, gameCode, 'quiz')
        if (dbId) {
          const attendeeId = await insertAttendee(dbId, {
            nickname: displayStoredName,
            realName: safeName,
            email: safeEmail,
            archetype,
            socketId: socket.id,
          })
          if (attendeeId) participant.attendeeId = attendeeId
        }
      } catch (err) {
        console.error('[db] attendee persist failed:', err)
      }

      callback({
        success: true,
        status: session.status,
        quizTitle: session.quizData.title,
        archetype,
        sessionMode: session.sessionMode,
        anonymousMode: session.anonymousMode,
        team,
        showBranding: hostPlan !== 'pro',
        participantId: newPid,
        displayMode: session.displayMode,
      })

      // Late joiner during active session — send them the current question
      // so they don't land on a blank screen.
      sendCurrentQuestionToSocket(socket, session)

      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayStoredName,
        participantId: newPid,
        archetype,
        // `count` retained for back-compat with older host clients;
        // `connectedCount` is the new authoritative field.
        count: getConnectedCount(session),
        connectedCount: getConnectedCount(session),
        team,
      })

      // Make sure the periodic state broadcast is running (idempotent).
      startSessionStateBroadcast(io, gameCode, session)

      console.log(`[session] ${displayName} (${archetype}${team ? `, Team ${team.name}` : ''}) joined ${gameCode}`)
    })

    socket.on('submit_answer', (rawPayload, ackCallback) => {
      const parsed = validateSocketPayload(socket, SubmitAnswerSchema, rawPayload, undefined, 'submit_answer')
      if (!parsed) return
      const { gameCode, participantId: incomingPid, answer, timeMs: clientReportedTimeMs, confidence, serverSubmittedAt } = parsed
      const receivedAt = Date.now()
      const session = sessions.get(gameCode)
      const ack = typeof ackCallback === 'function' ? ackCallback : null

      // Unified rejection — single shape, structured log, client-actionable reason.
      // Client listens for `answer_rejected` and forces re-join on `unknown_participant`.
      const reject = (reason, extra = {}) => {
        console.warn(`[submit_answer:reject] code=${gameCode} sid=${socket.id} pid=${incomingPid || 'none'} reason=${reason}`)
        socket.emit('answer_rejected', { reason, gameCode, ...extra })
        if (ack) ack({ accepted: false, reason, ...extra })
      }

      if (!session) return reject('no_session')
      if (session.status !== 'active') return reject('not_active', { status: session.status })
      if (session.paused) return reject('paused')

      // Prefer participantId match (durable across reconnects); fall back to
      // socket.id for clients that haven't sent a participantId yet.
      let participant = (incomingPid && session.participantsById?.get(incomingPid)) || session.participants.get(socket.id)

      // Last-resort recovery: if the participantId is unknown to participantsById
      // (e.g. socket.id-keyed entry was evicted but pid never registered) but
      // the disconnected map has a matching entry, re-link it. This is the
      // "first participant idled, reconnected, sent answer before re-join
      // handshake completed" case — without this rescue, the answer is dropped.
      if (!participant && incomingPid && session.disconnectedParticipants) {
        for (const [key, entry] of session.disconnectedParticipants.entries()) {
          if (entry?.participant?.participantId === incomingPid) {
            const recovered = entry.participant
            session.participants.delete(entry.socketId)
            delete recovered.disconnectedAt
            delete recovered.disconnectedSocketId
            recovered.socketId = socket.id
            session.participants.set(socket.id, recovered)
            session.disconnectedParticipants.delete(key)
            if (!session.participantsById) session.participantsById = new Map()
            session.participantsById.set(incomingPid, recovered)
            participant = recovered
            console.warn(`[submit_answer:recover] code=${gameCode} pid=${incomingPid} re-linked from disconnected map`)
            // Tell the host this player is back so the count un-greys.
            io.to(`host:${gameCode}`).emit('participant_rejoined', {
              name: recovered.name,
              participantId: recovered.participantId,
              archetype: recovered.archetype,
              team: recovered.team,
              connectedCount: getConnectedCount(session),
            })
            break
          }
        }
      }

      if (!participant) return reject('unknown_participant')

      // Re-bind socket→participant mapping if we matched via participantId but
      // socket.id changed (mid-question reconnect — answer can still land).
      if (participant.socketId !== socket.id) {
        if (participant.socketId && session.participants.has(participant.socketId)) {
          session.participants.delete(participant.socketId)
        }
        participant.socketId = socket.id
        session.participants.set(socket.id, participant)
      }

      const qi = session.currentQuestionIndex
      const question = session.quizData.questions[qi]
      if (!question) return reject('no_question', { questionIndex: qi })

      if (participant.answers[qi] !== undefined) return reject('duplicate', { questionIndex: qi })

      // ─── SERVER-AUTHORITATIVE TIMING ────────────────────────────────────
      // Prefer the client's NTP-corrected serverSubmittedAt when it falls
      // within a believable window (between question start and now plus a
      // small slack) — that's the player's actual tap moment in server clock
      // space. Falls back to the receivedAt - rtt/2 estimate for clients
      // that haven't completed clock-sync yet.
      const timerMs = (question.timerSeconds || 20) * 1000
      const rttMs = Number(socket.data.rttMs) || 0
      const rawElapsed = session.questionStartedAt ? receivedAt - session.questionStartedAt : 0
      let networkAdjusted = Math.max(0, rawElapsed - Math.floor(rttMs / 2))
      if (typeof serverSubmittedAt === 'number'
          && session.questionStartedAt
          && serverSubmittedAt >= session.questionStartedAt
          && serverSubmittedAt <= receivedAt + 5000) {
        networkAdjusted = serverSubmittedAt - session.questionStartedAt
      }
      const serverTimeMs = Math.min(timerMs, networkAdjusted)

      // Past-the-buzzer submission: still record the answer with 0 points so the
      // host counter is honest and the audit row exists. The participant gets
      // `late: true` in answer_confirmed and the streak does not advance.
      // Previously this branch did an early `return` and silently dropped the
      // answer, leaving the host stuck at "0 answered" forever.
      const isLate = !!(session.questionStartedAt && rawElapsed > timerMs + 2000)
      if (isLate) {
        console.warn(`[submit_answer:late-but-recorded] code=${gameCode} q=${qi} sid=${socket.id} pid=${participant.participantId} rawElapsed=${rawElapsed}ms deadline=${timerMs + 2000}ms`)
      }

      // Ranking questions: accept an array of option indices, store raw, do not score.
      if (question.type === 'ranking' && Array.isArray(answer)) {
        participant.answers[qi] = { answer, timeMs: serverTimeMs, clientReportedTimeMs, confidence: confidence ?? 'unsure', isNonScored: true, ...(isLate ? { late: true } : {}) }
        persistAnswer({
          session,
          sessionDbId: session.dbId,
          attendeeId: participant.attendeeId,
          participantId: participant.participantId,
          questionIndex: qi,
          answer,
          isCorrect: null,
          basePoints: 0,
          streakBonus: 0,
          points: 0,
          timeMs: serverTimeMs,
          confidence: confidence ?? 'unsure',
        })
        socket.emit('answer_confirmed', { isCorrect: null, points: 0, totalScore: participant.score, isNonScored: true, ...(isLate ? { late: true } : {}) })
        const numOptions = question.options?.length ?? 4
        io.to(`host:${gameCode}`).emit('answer_received', {
          count: countAnswers(session, qi),
          total: getConnectedCount(session),
          connectedCount: getConnectedCount(session),
          optionCounts: countAnswersByOption(session, qi, numOptions),
        })
        // Payload field name `ranking` matches the host listener. Kept `order`
        // for any older clients still in the wild; harmless duplicate.
        io.to(`host:${gameCode}`).emit('ranking_submission', { ranking: answer, order: answer })
        emitLiveResponses(io, gameCode, session, qi)
        if (ack) ack({ accepted: true, isNonScored: true, questionIndex: qi, ...(isLate ? { late: true } : {}) })
        return
      }

      const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'].includes(question.type)
      const rawIsCorrect = isNonScored ? null : checkAnswer(question, answer)
      // Late scored answers are treated as wrong (0 points, isCorrect=false) so
      // the audit trail is honest — the player did submit, but past the buzzer.
      const isCorrect = isLate && !isNonScored ? false : rawIsCorrect
      // Scoring formula picks 'classic' (Kahoot-style speed-scaled) or
      // 'accuracy' (flat base, no speed component, no streak — calm
      // assessment mode). Defaults to classic for back-compat.
      const formula = session.scoringFormula ?? 'classic'
      const basePoints = (!isLate && isCorrect) ? calcPoints(question.points || 1000, serverTimeMs, question.timerSeconds || 20, formula) : 0
      // Late submissions never advance the streak; applyStreak still runs on
      // non-late answers so the participant.streakCount stays in sync.
      const streakBonus = isLate ? 0 : (formula === 'accuracy' ? 0 : applyStreak(participant, isCorrect, isNonScored))
      const points = basePoints + streakBonus

      participant.answers[qi] = {
        answer,
        isCorrect,
        points,
        basePoints,
        streakBonus,
        timeMs: serverTimeMs,
        clientReportedTimeMs,
        confidence: confidence ?? 'unsure',
        ...(isLate ? { late: true } : {}),
      }
      participant.score += points

      // Audit log: persist every accepted answer immediately so scores are
      // recoverable even if RAM state is lost (server restart, redeploy).
      persistAnswer({
        session,
        sessionDbId: session.dbId,
        attendeeId: participant.attendeeId,
        participantId: participant.participantId,
        questionIndex: qi,
        answer,
        isCorrect,
        basePoints,
        streakBonus,
        points,
        timeMs: serverTimeMs,
        confidence: confidence ?? 'unsure',
      })

      socket.emit('answer_confirmed', {
        isCorrect,
        points,
        basePoints,
        streakBonus,
        streakCount: participant.streakCount || 0,
        totalScore: participant.score,
        isNonScored,
        ...(isLate ? { late: true } : {}),
      })
      if (ack) ack({ accepted: true, questionIndex: qi, isCorrect, points, totalScore: participant.score, ...(isLate ? { late: true } : {}) })

      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: getConnectedCount(session),
        connectedCount: getConnectedCount(session),
        optionCounts: countAnswersByOption(session, qi, numOptions),
      })

      // Forward raw text/rating payloads to the host so it can render live
      // visualizations (word cloud, Q&A feed, open-ended wall, rating chart).
      // MCQ / truefalse / multiselect rely on optionCounts only — no forward needed.
      if (['wordcloud', 'openended', 'qa', 'rating'].includes(question.type)) {
        io.to(`host:${gameCode}`).emit('text_submission', {
          type: question.type,
          questionIndex: qi,
          name: participant.name || participant.realName || 'Anonymous',
          archetype: participant.archetype,
          answer,
          submittedAt: Date.now(),
        })
      }

      // Live aggregate for the host reveal-style live view. Emitted only for
      // non-scored types — scored questions still hide the running tally so
      // late voters aren't influenced by the visible bars.
      if (isNonScored) {
        emitLiveResponses(io, gameCode, session, qi)
      }

      console.log(`[submit_answer:accept] code=${gameCode} q=${qi} sid=${socket.id} pts=${points} correct=${isCorrect}`)

      // "Lower of two" — if every active (non-ghost) participant has now
      // answered the current question, end it immediately so the standings
      // screen fires without waiting for the full timer.
      if (!session.questionEnded && qi === session.currentQuestionIndex) {
        const answered = countAnswers(session, qi)
        const total = realParticipantCount(session.participants)
        if (total > 0 && answered >= total) {
          session.questionEnded = true
          if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
          emitQuestionEnded(io, gameCode, session, qi)
        }
      }
    })

    // ─── CLOCK SYNC HANDSHAKE ──────────────────────────────────────
    // Client pings, server echoes with receiveTime and replyTime so client can
    // compute offset + rtt. Server records the last-measured rtt on socket.data
    // for use in server-authoritative scoring (see submit_answer).
    socket.on('ping_time', (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, PingTimeSchema, rawPayload, callback, 'ping_time')
      if (!parsed) return
      const { clientTime } = parsed
      const receiveTime = Date.now()
      try {
        if (typeof clientTime === 'number' && Number.isFinite(clientTime)) {
          // rtt estimate = (now - clientTime) when clocks are roughly aligned.
          // We don't trust clientTime for scoring; just use it to seed rttMs.
          const estimatedRtt = Math.max(0, receiveTime - clientTime)
          socket.data.rttMs = Math.min(estimatedRtt, 5000) // cap at 5s sanity
        }
      } catch { /* ignore */ }
      if (typeof callback === 'function') {
        callback({ receiveTime, replyTime: Date.now() })
      }
    })

    // ─── DISCONNECT ─────────────────────────────────────────────────

    socket.on('disconnect', () => {
      for (const [code, session] of sessions.entries()) {
        if (session.hostSocketId === socket.id) {
          // Host disconnect grace: during lobby/active, give the host 5 minutes
          // to reconnect before tearing down the session. Mobile/laptop tab churn
          // and brief network blips were previously vaporising live games.
          if (session.status === 'lobby' || session.status === 'active') {
            session.hostDisconnectedAt = Date.now()
            session.hostDisconnectedSocketId = socket.id
            console.log(`[host] disconnected from ${code}, grace period 5min, status=${session.status}`)
            setTimeout(() => {
              const s = sessions.get(code)
              if (s && s.hostSocketId === socket.id) {
                if (s.endTimer) { clearTimeout(s.endTimer); s.endTimer = null }
                stopSessionStateBroadcast(s)
                io.to(`session:${code}`).emit('host_disconnected')
                sessions.delete(code)
                console.log(`[session] deleted (host never returned): ${code}`)
              }
            }, 5 * 60 * 1000)
            continue
          }
          if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
          stopSessionStateBroadcast(session)
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
          continue
        }
        if (session.participants.has(socket.id)) {
          const participant = session.participants.get(socket.id)
          const name = participant.name
          const participantId = participant.participantId || null
          // Grace period: mark as disconnected, allow 20 minutes to reconnect.
          // Covers long lobbies, multi-hour presentations where phones may lock
          // for 15+ minutes between polls, and noisy mobile networks. Cost is
          // a few KB per orphaned participant — negligible.
          participant.disconnectedAt = Date.now()
          participant.disconnectedSocketId = socket.id
          if (!session.disconnectedParticipants) session.disconnectedParticipants = new Map()
          session.disconnectedParticipants.set(name.toLowerCase(), { socketId: socket.id, participant, gameCode: code })
          console.log(`[participant] ${name} (pid=${participantId}) disconnected from ${code}, grace period 20min`)

          // IMMEDIATE notification — host UI must show the count drop right
          // away. The 20-min grace governs full removal, not visibility.
          const connectedCount = getConnectedCount(session)
          if (session.type === 'presenter') {
            io.to(`host:${code}`).emit('presenter_participant_disconnected', { name, participantId, connectedCount })
          } else {
            io.to(`host:${code}`).emit('participant_disconnected', { name, participantId, connectedCount })
          }

          setTimeout(() => {
            const entry = session.disconnectedParticipants?.get(name.toLowerCase())
            if (entry && entry.socketId === socket.id) {
              session.disconnectedParticipants.delete(name.toLowerCase())
              session.participants.delete(socket.id)
              // Note: deliberately do NOT delete from session.participantsById.
              // If the user reopens the tab any time before session end, their
              // participantId in localStorage still maps back to this entry —
              // identity (and score) survives across grace expiry.
              if (participant.attendeeId) {
                updateAttendeeOnLeave(participant.attendeeId, participant.joinedAt).catch(console.error)
              }
              const finalConnectedCount = getConnectedCount(session)
              if (session.type === 'presenter') {
                io.to(`host:${code}`).emit('presenter_participant_left', { name, participantId, count: finalConnectedCount, connectedCount: finalConnectedCount })
              } else {
                io.to(`host:${code}`).emit('participant_left', { name, participantId, count: finalConnectedCount, connectedCount: finalConnectedCount })
              }
              console.log(`[participant] ${name} removed from ${code} after grace period (participantsById retained)`)
            }
          }, 20 * 60 * 1000)
        }
      }
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Quizotic running at http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
  })
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sanitizeQuestion(q) {
  const { correctAnswer, ...safe } = q
  return safe
}

// Catch-up emit for late joiners and reconnects. If the session is active and
// there's a question in flight, send the current question directly to the
// just-joined socket. Without this, late joiners see a blank screen because
// they missed the room-level question_show broadcast.
function sendCurrentQuestionToSocket(socket, session) {
  if (!session || session.status !== 'active') return
  const { currentQuestionIndex, quizData, questionStartedAt } = session
  if (!quizData || typeof currentQuestionIndex !== 'number' || currentQuestionIndex < 0) return
  const q = quizData.questions?.[currentQuestionIndex]
  if (!q) return
  socket.emit('question_show', {
    question: sanitizeQuestion(q),
    index: currentQuestionIndex,
    total: quizData.questions.length,
    serverTimestamp: questionStartedAt,
    startAt: questionStartedAt,
  })
}

function checkAnswer(question, answer) {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    // Correct answers can come in as either `correctAnswers` (new array field)
    // or legacy `correctAnswer` (string or array). Answer from client is an
    // array of option-index strings. Match requires exact set equality.
    const correctRaw = question.correctAnswers ?? question.correctAnswer
    if (!correctRaw) return false
    const correctArr = Array.isArray(correctRaw) ? correctRaw : [correctRaw]
    const givenArr = Array.isArray(answer) ? answer : [answer]
    if (correctArr.length === 0 || givenArr.length === 0) return false
    const correctSet = [...correctArr].map(String).sort().join(',')
    const givenSet = [...givenArr].map(String).sort().join(',')
    return correctSet === givenSet
  }
  return false
}

// Kahoot-style classic scoring. A correct answer is worth between base/2 and
// base, scaled by how fast it came in. Wrong = 0. Drama range is 100% (max
// is 2× the min) instead of the previous 33%, so fast correct answers pull
// clearly ahead and the leaderboard stops feeling static. The 'accuracy'
// formula skips the speed component entirely — every correct answer = base.
function calcPoints(base, timeMs, timerSeconds, formula = 'classic') {
  if (formula === 'accuracy') return base
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs) // 1.0 fastest → 0.0 slowest
  return Math.round(base * (0.5 + 0.5 * speedRatio))
}

// Streak bonuses — Kahoot-inspired:
//   2 correct in a row → +100
//   3 correct in a row → +200
//   4+ correct in a row → +500 (capped)
// Wrong answer resets the streak. Non-scored questions do not touch the streak.
// Returns the bonus points to award for this answer, and mutates participant.streakCount.
function applyStreak(participant, isCorrect, isNonScored) {
  if (isNonScored) return 0
  if (!isCorrect) {
    participant.streakCount = 0
    return 0
  }
  participant.streakCount = (participant.streakCount || 0) + 1
  const s = participant.streakCount
  if (s >= 4) return 500
  if (s === 3) return 200
  if (s === 2) return 100
  return 0
}

// Compact leaderboard snapshot for emit between questions (top N only, with rank).
function buildLeaderboardSnapshot(participants, limit = 5) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      archetype: p.archetype,
      score: p.score,
      streakCount: p.streakCount || 0,
      team: p.team ?? null,
    }))
}

// Per-player rank lookup — returns {rank, total, score} for a given participant.
function getParticipantRank(participants, targetId) {
  const sorted = Array.from(participants.entries())
    .sort(([, a], [, b]) => b.score - a.score)
  const idx = sorted.findIndex(([sid]) => sid === targetId)
  if (idx === -1) return null
  const [, p] = sorted[idx]
  return { rank: idx + 1, total: sorted.length, score: p.score }
}

function countAnswers(session, questionIndex) {
  let count = 0
  for (const p of session.participants.values()) {
    if (p.answers[questionIndex] !== undefined) count++
  }
  return count
}

function countAnswersByOption(session, questionIndex, numOptions) {
  const counts = Array(numOptions).fill(0)
  for (const p of session.participants.values()) {
    const a = p.answers[questionIndex]
    if (a !== undefined) {
      const idx = Number(a.answer)
      if (idx >= 0 && idx < numOptions) counts[idx]++
    }
  }
  return counts
}

// Updated: takes participants Map directly; callers pass session.participants
function buildLeaderboard(participants) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .map(p => ({ name: p.name, archetype: p.archetype, score: p.score, team: p.team ?? null, isGhost: p.isGhost ?? false }))
}

// Count of real (non-ghost) participants
function realParticipantCount(participants) {
  let count = 0
  for (const [sid] of participants.entries()) {
    if (!sid.startsWith('ghost::')) count++
  }
  return count
}

// Thin wrappers around the pure helpers in src/lib/session-state.mjs so the
// rest of this file keeps reading naturally. Exported helpers are unit-tested
// directly; these wrappers stay trivial.
const getConnectedCount = _getConnectedCount
const buildSessionStateSnapshot = _buildSessionStateSnapshot

// Periodic authoritative state broadcast — keeps the host UI in sync even if
// individual events are missed (network drops between server and host, hot
// reloads, race conditions). Started at session creation, cleared at end.
function startSessionStateBroadcast(io, gameCode, session) {
  if (!session || session._stateBroadcastTimer) return
  const tick = () => {
    const s = sessions.get(gameCode)
    if (!s || s !== session || s.status === 'ended') {
      stopSessionStateBroadcast(session)
      return
    }
    const snapshot = buildSessionStateSnapshot(s)
    io.to(`host:${gameCode}`).emit('session_state', snapshot)
  }
  session._stateBroadcastTimer = setInterval(tick, 5000)
}

function stopSessionStateBroadcast(session) {
  if (session?._stateBroadcastTimer) {
    clearInterval(session._stateBroadcastTimer)
    session._stateBroadcastTimer = null
  }
}

// Sum of max points across scoreable questions in a session.
// Mirrors the non-scored filter used in emitQuestionEnded / buildQuestionStats.
function computeMaxScore(session) {
  const nonScored = new Set(['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'])
  return session.quizData.questions.reduce((sum, q) => {
    if (nonScored.has(q.type)) return sum
    return sum + (q.points || 1000)
  }, 0)
}

function buildTeamLeaderboard(session) {
  if (!session.teamMode) return null
  const teamScores = new Map()
  for (const p of session.participants.values()) {
    if (!p.team) continue
    const key = p.team.index
    if (!teamScores.has(key)) {
      teamScores.set(key, { name: p.team.name, color: p.team.color, score: 0, members: 0 })
    }
    const ts = teamScores.get(key)
    ts.score += p.score
    ts.members++
  }
  return Array.from(teamScores.values()).sort((a, b) => b.score - a.score)
}

// Schedule the automatic "question ended" trigger for the current question.
// Together with the all-answered check in submit_answer, this implements the
// "lower of two" rule so the dedicated Standings screen fires without the
// host having to click anything. Cleared on manual advance, all-answered,
// pause, end_session, and disconnect. Accepts an explicit `overrideMs` so
// resume can reschedule with the remaining time it captured at pause.
function scheduleQuestionAutoEnd(io, gameCode, session, overrideMs) {
  if (session.endTimer) {
    clearTimeout(session.endTimer)
    session.endTimer = null
  }
  session.questionEnded = false
  let totalMs
  if (typeof overrideMs === 'number' && Number.isFinite(overrideMs)) {
    totalMs = Math.max(0, overrideMs)
  } else {
    const q = session.quizData?.questions?.[session.currentQuestionIndex]
    const timerSeconds = q?.timerSeconds ?? 20
    // 3.5s intro countdown + question timer + 0.5s grace so the client gets a
    // chance to paint the final "0" before we transition.
    totalMs = 3500 + timerSeconds * 1000 + 500
  }
  session.questionEndsAt = Date.now() + totalMs
  session.endTimer = setTimeout(() => {
    if (session.questionEnded || session.paused) return
    session.questionEnded = true
    session.endTimer = null
    emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)
  }, totalMs)
}

// Compute a flat ordered ranking of participants by score (excluding ghost
// markers in the snapshot — they appear in the leaderboard but we don't
// emit personal events to them). Returns Map(participantKey → 1-based rank).
function rankByScore(participants) {
  const sorted = Array.from(participants.entries())
    .map(([key, p]) => ({ key, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score)
  const ranks = new Map()
  sorted.forEach((row, i) => ranks.set(row.key, i + 1))
  return ranks
}

// Emit question_ended to the whole room (reveal moment — correctAnswer intentionally exposed).
// Also emits:
//   - leaderboard_update — top-5 snapshot, total players, question index
//   - my_rank_update — per-participant rank info (already existed)
//   - personal_result — per-participant Result Beat data (points, delta, streak,
//                       isFastest, teamContribution)
//   - standingsRecommended flag piggybacked on leaderboard_update so the host
//     UI can highlight the View Standings button on milestone questions
//   - topMovers — biggest positive rank deltas this round
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const q = session.quizData.questions[questionIndex]
  if (!q) return
  const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'].includes(q.type)
  const correctAnswer = isNonScored
    ? null
    : (q.correctAnswers ?? q.correctAnswer ?? null)

  // Snapshot ranks BEFORE we apply ghost score updates so the deltas reflect
  // real player movement. previousRanks is whatever we saved last round.
  const previousRanks = session.previousRanks || new Map()

  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer,
    explanation: q.explanation ?? null,
    isNonScored,
  })

  // Ghost Mode — advance ghost player scores by their per-question allocation.
  if (session.ghostPlayers?.length && !isNonScored) {
    const totalQ = session.quizData.questions.length
    for (const ghost of session.ghostPlayers) {
      const isLast = questionIndex === totalQ - 1
      const increment = isLast
        ? ghost.finalScore - ghost.score
        : ghost.perQuestionScore
      ghost.score = Math.max(0, ghost.score + increment)
      session.participants.set(ghost.ghostId, {
        name: ghost.name,
        archetype: ghost.archetype,
        score: ghost.score,
        answers: {},
        team: null,
        streakCount: 0,
        isGhost: true,
      })
    }
  }

  // For non-scored questions, emit a `question_reveal` carrying the final
  // type-appropriate aggregate so the host can show a Mentimeter-style reveal
  // screen between questions. We still skip the standings/leaderboard logic
  // below — non-scored questions don't move ranks.
  if (isNonScored) {
    const allStats = buildQuestionStats(session)
    const stat = allStats[questionIndex]
    if (stat) {
      io.to(`host:${gameCode}`).emit('question_reveal', {
        questionIndex,
        stat,
        totalParticipants: realParticipantCount(session.participants),
      })
    }
    return
  }
  if (session.sessionMode === 'reflection') return

  const newRanks = rankByScore(session.participants)
  const top = buildLeaderboardSnapshot(session.participants, 5)
  const teamLeaderboard = buildTeamLeaderboard(session)
  const totalPlayers = realParticipantCount(session.participants)

  // ─── Standings cadence heuristic ─────────────────────────────────────
  // Recommend showing the full standings screen on:
  //   - every Nth scored question (default 3)
  //   - the last 2 questions of the quiz
  //   - when the top-3 has changed since the last show
  // Otherwise the host UI defaults to a Result Beat with no full board.
  const cadence = session.standingsCadence ?? 3
  const totalQ = session.quizData.questions.length
  const scoredSeen = (session.scoredQuestionsSeen ?? 0) + 1
  session.scoredQuestionsSeen = scoredSeen
  const isLastTwo = questionIndex >= totalQ - 2
  const everyNth = cadence > 0 && scoredSeen % cadence === 0
  const prevTop3Key = (session.previousTopThree ?? []).join('|')
  const newTop3Key = top.slice(0, 3).map(r => r.archetype || r.name).join('|')
  const top3Changed = prevTop3Key !== '' && prevTop3Key !== newTop3Key
  const standingsRecommended = isLastTwo || everyNth || top3Changed
  session.previousTopThree = top.slice(0, 3).map(r => r.archetype || r.name)
  if (standingsRecommended) session.lastStandingsShownAt = Date.now()

  // ─── Top movers (biggest positive rank delta this round) ────────────
  const movers = []
  for (const [key, p] of session.participants.entries()) {
    if (p.isGhost) continue
    const fromRank = previousRanks.get(key)
    const toRank = newRanks.get(key)
    if (typeof fromRank !== 'number' || typeof toRank !== 'number') continue
    const delta = fromRank - toRank // positive = moved up
    if (delta > 0) {
      movers.push({
        name: p.name,
        archetype: p.archetype,
        fromRank,
        toRank,
        delta,
      })
    }
  }
  movers.sort((a, b) => b.delta - a.delta || a.toRank - b.toRank)
  const topMovers = movers.slice(0, 3)

  io.to(`session:${gameCode}`).emit('leaderboard_update', {
    top,
    teamLeaderboard,
    totalPlayers,
    questionIndex,
    standingsRecommended,
    topMovers,
  })

  // ─── Per-participant Result Beat + rank update ──────────────────────
  // Find the fastest correct answer this round so we can flag the player(s).
  let fastestKey = null
  let fastestTime = Infinity
  for (const [key, p] of session.participants.entries()) {
    if (p.isGhost) continue
    const ans = p.answers?.[questionIndex]
    if (!ans || ans.isCorrect !== true) continue
    const t = typeof ans.timeMs === 'number' ? ans.timeMs : Infinity
    if (t < fastestTime) { fastestTime = t; fastestKey = key }
  }

  for (const [socketId, p] of session.participants.entries()) {
    if (p.isGhost) continue
    const ans = p.answers?.[questionIndex]
    const fromRank = previousRanks.get(socketId)
    const toRank = newRanks.get(socketId) ?? null
    const delta = (typeof fromRank === 'number' && typeof toRank === 'number')
      ? fromRank - toRank
      : 0
    const personal = {
      questionIndex,
      isCorrect: ans?.isCorrect ?? null,
      pointsEarned: ans?.points ?? 0,
      basePoints: ans?.basePoints ?? 0,
      streakBonus: ans?.streakBonus ?? 0,
      streakCount: p.streakCount ?? 0,
      totalScore: p.score ?? 0,
      rank: toRank,
      prevRank: fromRank ?? null,
      delta,
      isFastest: socketId === fastestKey,
      crossedTopFive: typeof toRank === 'number' && toRank <= 5
        && (typeof fromRank !== 'number' || fromRank > 5),
    }
    io.to(socketId).emit('personal_result', personal)
    // Keep the legacy my_rank_update event for back-compat with any older
    // client builds still listening to it.
    if (typeof toRank === 'number') io.to(socketId).emit('my_rank_update', { rank: toRank })
  }

  session.previousRanks = newRanks
}

// Emit a running aggregate for a single non-scored question to the host room.
// Called on every accepted answer so the host live view (poll bars, growing
// word cloud, scrolling text list) can update in real time. Cheap — only
// processes participants for one question, not the full quiz.
function emitLiveResponses(io, gameCode, session, qi) {
  const q = session.quizData?.questions?.[qi]
  if (!q) return
  const ps = Array.from(session.participants.values())
  const answered = ps.filter(p => p.answers[qi] !== undefined)
  const aggregate = computeNonScoredAggregate(q, answered, qi)
  io.to(`host:${gameCode}`).emit('live_responses', {
    questionIndex: qi,
    type: q.type,
    totalResponses: answered.length,
    totalParticipants: realParticipantCount(session.participants),
    options: q.options,
    ...aggregate,
  })
}

// Compute per-question stats from participant answers for the session report.
// Each question type yields a different aggregate shape — see QuestionStat in
// src/lib/quiz-types.ts for the full schema. All shapes are produced server-side
// so SessionReport (PDF), PresentationSummary, and the live host reveal can
// share a single QuestionResultsView dispatcher on the client.
function buildQuestionStats(session) {
  const ps = Array.from(session.participants.values())
  return session.quizData.questions.map((q, i) => {
    const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'].includes(q.type)
    const answered = ps.filter(p => p.answers[i] !== undefined)
    const total = answered.length
    if (total === 0) {
      return {
        index: i, text: q.text, type: q.type, correctPct: 0, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
        isNonScored, totalResponses: 0, optionDistribution: null,
      }
    }

    // For polls / non-scored: compute the type-appropriate aggregate.
    if (isNonScored) {
      const base = {
        index: i, text: q.text, type: q.type, correctPct: null, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
        isNonScored: true, totalResponses: total,
        options: q.options,
      }
      return { ...base, ...computeNonScoredAggregate(q, answered, i) }
    }

    let correct = 0, sureCorrect = 0, sureWrong = 0, unsureCorrect = 0, unsureWrong = 0
    for (const p of answered) {
      const ic = checkAnswer(q, p.answers[i].answer)
      const sure = p.answers[i].confidence === 'sure'
      if (ic) correct++
      if (sure && ic) sureCorrect++
      if (sure && !ic) sureWrong++
      if (!sure && ic) unsureCorrect++
      if (!sure && !ic) unsureWrong++
    }

    return {
      index: i,
      text: q.text,
      type: q.type,
      correctPct: Math.round((correct / total) * 100),
      confidenceGrid: { sureCorrect, sureWrong, unsureCorrect, unsureWrong },
      bloomsLevel: q.bloomsLevel ?? null,
      explanation: q.explanation ?? null,
      isNonScored: false, totalResponses: total, optionDistribution: null,
    }
  })
}

// Tokenize a wordcloud submission into 1+ tokens (some clients send "red blue
// green" as a single answer string when maxWords > 1). Keeps multi-word
// phrases up to 3 tokens to preserve "machine learning" intact.
function tokenizeWordcloud(raw) {
  if (raw === null || raw === undefined) return []
  const s = String(raw).trim().toLowerCase()
  if (!s) return []
  // If it looks like a multi-word phrase (≤3 tokens), keep as one bucket.
  const tokens = s.split(/\s+/)
  if (tokens.length <= 3) return [tokens.join(' ')]
  // Otherwise split — typical for paste-attacks or freeform.
  return tokens
}

// Per-type aggregate computation for non-scored questions. Always returns an
// object spread on top of the base QuestionStat — never mutates the input.
function computeNonScoredAggregate(q, answered, qi) {
  const renderer = ({
    poll: 'bars', wordcloud: 'cloud', openended: 'list', qa: 'list',
    rating: 'histogram', ranking: 'ordered', drawing: 'grid', case: 'inner',
  })[q.type] || 'bars'

  if (renderer === 'bars') {
    const numOptions = q.options?.length ?? 0
    const optionDistribution = Array(numOptions).fill(0)
    for (const p of answered) {
      const idx = Number(p.answers[qi].answer)
      if (idx >= 0 && idx < numOptions) optionDistribution[idx]++
    }
    return { optionDistribution }
  }

  if (renderer === 'cloud') {
    const wordFrequencies = {}
    const textResponses = []
    for (const p of answered) {
      const raw = p.answers[qi].answer
      const tokens = tokenizeWordcloud(raw)
      for (const t of tokens) wordFrequencies[t] = (wordFrequencies[t] || 0) + 1
      textResponses.push({
        name: p.name || p.realName || 'Anonymous',
        archetype: p.archetype,
        answer: typeof raw === 'string' ? raw : String(raw ?? ''),
        submittedAt: p.answers[qi].clientReportedTimeMs ?? Date.now(),
      })
    }
    return { wordFrequencies, textResponses, optionDistribution: null }
  }

  if (renderer === 'list') {
    const textResponses = answered.map(p => ({
      name: p.name || p.realName || 'Anonymous',
      archetype: p.archetype,
      answer: typeof p.answers[qi].answer === 'string'
        ? p.answers[qi].answer
        : String(p.answers[qi].answer ?? ''),
      submittedAt: p.answers[qi].clientReportedTimeMs ?? Date.now(),
    }))
    return { textResponses, optionDistribution: null }
  }

  if (renderer === 'histogram') {
    const ratingMax = q.options?.length || 5
    const ratingHistogram = Array(ratingMax).fill(0)
    let sum = 0
    let count = 0
    for (const p of answered) {
      // Stored answer is option-index string ("0".."N-1") → rating = idx + 1
      const idx = Number(p.answers[qi].answer)
      if (Number.isFinite(idx) && idx >= 0 && idx < ratingMax) {
        ratingHistogram[idx]++
        sum += idx + 1
        count++
      }
    }
    const ratingAverage = count > 0 ? Math.round((sum / count) * 100) / 100 : null
    return { ratingHistogram, ratingAverage, ratingMax, optionDistribution: null }
  }

  if (renderer === 'ordered') {
    const items = q.options ?? []
    const n = items.length
    const positionSums = Array(n).fill(0)
    const positionCounts = Array(n).fill(0)
    const firstPlace = Array(n).fill(0)
    for (const p of answered) {
      const order = p.answers[qi].answer
      if (!Array.isArray(order)) continue
      order.forEach((itemIdx, position) => {
        const idx = Number(itemIdx)
        if (Number.isFinite(idx) && idx >= 0 && idx < n) {
          positionSums[idx] += position + 1
          positionCounts[idx]++
          if (position === 0) firstPlace[idx]++
        }
      })
    }
    const rankingAverages = positionSums.map((sum, idx) =>
      positionCounts[idx] > 0 ? Math.round((sum / positionCounts[idx]) * 100) / 100 : null
    )
    return {
      rankingItems: items.map(o => typeof o === 'string' ? o : (o?.text ?? '')),
      rankingAverages,
      rankingFirstPlaceCounts: firstPlace,
      optionDistribution: null,
    }
  }

  if (renderer === 'grid') {
    const drawingThumbnails = answered
      .filter(p => typeof p.answers[qi].dataUrl === 'string')
      .map(p => ({
        name: p.name || p.realName || 'Anonymous',
        archetype: p.archetype,
        dataUrl: p.answers[qi].dataUrl,
      }))
    return { drawingThumbnails, optionDistribution: null }
  }

  // 'inner' (case) — fall back to bars on inner type's options if any.
  const numOptions = q.options?.length ?? 0
  const optionDistribution = Array(numOptions).fill(0)
  for (const p of answered) {
    const idx = Number(p.answers[qi].answer)
    if (idx >= 0 && idx < numOptions) optionDistribution[idx]++
  }
  return { optionDistribution }
}
