import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
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

// Lazily insert a GameSession row the first time a participant joins so
// per-attendee inserts can reference it. Returns the row id (or null on failure).
async function ensureGameSessionRow(session, code, type) {
  if (!dbPool) return null
  if (session.dbId) return session.dbId
  if (session._dbInsertPromise) return session._dbInsertPromise
  const id = randomUUID()
  session._dbInsertPromise = (async () => {
    try {
      await dbPool.query(
        `INSERT INTO "GameSession" (id, code, type, "quizId", "presentationId", "userId", "hostName", status, "participantCount", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 0, now())`,
        [
          id,
          code,
          type,
          type === 'quiz' ? (session.quizData?.id || null) : null,
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
function persistAnswer({ sessionDbId, attendeeId, participantId, questionIndex, answer, isCorrect, basePoints, streakBonus, points, timeMs, confidence }) {
  if (!dbPool || !sessionDbId || !participantId) return
  dbPool.query(
    `INSERT INTO "Answer" (id, "sessionId", "attendeeId", "participantId", "questionIndex", answer, "isCorrect", "basePoints", "streakBonus", points, "timeMs", confidence, "submittedAt")
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, now())
     ON CONFLICT ("sessionId", "participantId", "questionIndex") DO NOTHING`,
    [
      randomUUID(),
      sessionDbId,
      attendeeId || null,
      participantId,
      Number(questionIndex) || 0,
      JSON.stringify(answer ?? null),
      isCorrect == null ? null : Boolean(isCorrect),
      Number(basePoints) || 0,
      Number(streakBonus) || 0,
      Number(points) || 0,
      Number(timeMs) || 0,
      confidence == null ? null : String(confidence),
    ]
  ).catch(err => console.error('[db] answer insert failed:', err.message))
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
      const { quizData, sessionMode, anonymousMode, teamMode, teamCount, ghostSessionId } = parsed
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
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
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

      console.log(`[session] started: ${gameCode}`)
    })

    socket.on('pause_quiz', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'pause_quiz')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      session.paused = true
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
      const elapsed = session.questionStartedAt ? Date.now() - session.questionStartedAt : 0
      const timer = session.quizData?.questions[session.currentQuestionIndex]?.timerSeconds || 20
      const remainingMs = Math.max(0, timer * 1000 - elapsed)
      io.to(`session:${gameCode}`).emit('quiz_resumed', { remainingMs })
      console.log(`[session] resumed: ${gameCode}`)
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

      emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)

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
    })

    // P3.4 — Drawing question type: participant submits a drawing (base64 JPEG).
    // The drawing is stored in their answer record and relayed to the host for gallery display.
    // Payload limited server-side: dataUrl is truncated at 100 KB to prevent abuse.
    socket.on('submit_drawing', (rawPayload) => {
      const parsed = validateSocketPayload(socket, SubmitDrawingSchema, rawPayload, undefined, 'submit_drawing')
      if (!parsed) return
      const { gameCode, participantId: incomingPid, dataUrl } = parsed
      const session = sessions.get(gameCode)

      const reject = (reason, extra = {}) => {
        console.warn(`[submit_drawing:reject] code=${gameCode} sid=${socket.id} reason=${reason}`)
        socket.emit('answer_rejected', { reason, gameCode, ...extra })
      }

      if (!session) return reject('no_session')
      let participant = (incomingPid && session.participantsById?.get(incomingPid)) || session.participants.get(socket.id)
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

      io.to(`host:${gameCode}`).emit('answer_received', {
        total: session.participants.size,
        answered: countAnswers(session, qi),
      })
    })

    socket.on('end_session', async (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'end_session')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

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

    socket.on('submit_presenter_response', (rawPayload) => {
      const parsed = validateSocketPayload(socket, PresenterResponseSchema, rawPayload, undefined, 'submit_presenter_response')
      if (!parsed) return
      const { gameCode, slideIndex, response } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.type !== 'presenter') return

      const participant = session.participants.get(socket.id)
      if (!participant) return

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
      const { gameCode, displayName, email } = parsed
      const session = sessions.get(gameCode)
      if (!session || session.type !== 'presenter') {
        callback({ success: false, error: 'Presenter session not found.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'Session has ended.' })
        return
      }

      // Participant limit check for presenter sessions
      const presenterPlan = await getSessionHostPlan(session)
      const presenterMaxP = presenterPlan === 'pro' ? Infinity : 50
      if (session.participants.size >= presenterMaxP) {
        callback({ success: false, error: 'This session is full (max 50 participants on Free plan). The host can upgrade to Pro for unlimited participants.' })
        return
      }

      const safeName = String(displayName ?? '').slice(0, 30).trim() || 'Anonymous'
      const safeEmail = sanitizeEmail(email)
      const archetype = assignArchetype()
      const participant = {
        name: safeName,
        archetype,
        votedSlides: {},
        joinedAt: new Date(),
      }
      session.participants.set(socket.id, participant)
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
      })

      io.to(`host:${gameCode}`).emit('presenter_participant_joined', {
        name: safeName,
        archetype,
        count: session.participants.size,
      })
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
      const disconnectedKey = safeName.toLowerCase()
      const disconnectedEntry = session.disconnectedParticipants?.get(disconnectedKey)
      if (disconnectedEntry) {
        // Restore the participant under the new socket ID
        const oldParticipant = disconnectedEntry.participant
        session.participants.delete(disconnectedEntry.socketId)
        delete oldParticipant.disconnectedAt
        delete oldParticipant.disconnectedSocketId
        oldParticipant.socketId = socket.id
        session.participants.set(socket.id, oldParticipant)
        session.disconnectedParticipants.delete(disconnectedKey)
        // Backfill participantId on the existing entry if the client has one now.
        if (incomingPid && !oldParticipant.participantId) {
          oldParticipant.participantId = incomingPid
          if (!session.participantsById) session.participantsById = new Map()
          session.participantsById.set(incomingPid, oldParticipant)
        }
        socket.join(`session:${gameCode}`)
        console.log(`[participant] ${safeName} reconnected (name match) to ${gameCode}`)
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
      })

      // Late joiner during active session — send them the current question
      // so they don't land on a blank screen.
      sendCurrentQuestionToSocket(socket, session)

      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayStoredName,
        archetype,
        count: session.participants.size,
        team,
      })

      console.log(`[session] ${displayName} (${archetype}${team ? `, Team ${team.name}` : ''}) joined ${gameCode}`)
    })

    socket.on('submit_answer', (rawPayload) => {
      const parsed = validateSocketPayload(socket, SubmitAnswerSchema, rawPayload, undefined, 'submit_answer')
      if (!parsed) return
      const { gameCode, participantId: incomingPid, answer, timeMs: clientReportedTimeMs, confidence } = parsed
      const receivedAt = Date.now()
      const session = sessions.get(gameCode)

      // Unified rejection — single shape, structured log, client-actionable reason.
      // Client listens for `answer_rejected` and forces re-join on `unknown_participant`.
      const reject = (reason, extra = {}) => {
        console.warn(`[submit_answer:reject] code=${gameCode} sid=${socket.id} reason=${reason}`)
        socket.emit('answer_rejected', { reason, gameCode, ...extra })
      }

      if (!session) return reject('no_session')
      if (session.status !== 'active') return reject('not_active', { status: session.status })

      // Prefer participantId match (durable across reconnects); fall back to
      // socket.id for clients that haven't sent a participantId yet.
      let participant = (incomingPid && session.participantsById?.get(incomingPid)) || session.participants.get(socket.id)
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
      // Compute timeMs from the server's own question-start timestamp, not from
      // client-reported values. Client-reported timeMs is retained only for audit.
      // Subtract half of the measured socket round-trip as a network-lag correction
      // so high-latency players aren't penalized for transport time.
      const timerMs = (question.timerSeconds || 20) * 1000
      const rttMs = Number(socket.data.rttMs) || 0
      const rawElapsed = session.questionStartedAt ? receivedAt - session.questionStartedAt : 0
      const networkAdjusted = Math.max(0, rawElapsed - Math.floor(rttMs / 2))
      const serverTimeMs = Math.min(timerMs, networkAdjusted)

      // Enforce deadline using server-authoritative timing (2s grace window).
      if (session.questionStartedAt) {
        const deadline = timerMs + 2000
        if (rawElapsed > deadline) {
          socket.emit('answer_confirmed', { isCorrect: false, points: 0, totalScore: participant.score, late: true })
          return
        }
      }

      // Ranking questions: accept an array of option indices, store raw, do not score.
      if (question.type === 'ranking' && Array.isArray(answer)) {
        participant.answers[qi] = { answer, timeMs: serverTimeMs, clientReportedTimeMs, confidence: confidence ?? 'unsure', isNonScored: true }
        persistAnswer({
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
        socket.emit('answer_confirmed', { isCorrect: null, points: 0, totalScore: participant.score, isNonScored: true })
        const numOptions = question.options?.length ?? 4
        io.to(`host:${gameCode}`).emit('answer_received', {
          count: countAnswers(session, qi),
          total: session.participants.size,
          optionCounts: countAnswersByOption(session, qi, numOptions),
        })
        // Payload field name `ranking` matches the host listener. Kept `order`
        // for any older clients still in the wild; harmless duplicate.
        io.to(`host:${gameCode}`).emit('ranking_submission', { ranking: answer, order: answer })
        return
      }

      const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'].includes(question.type)
      const isCorrect = isNonScored ? null : checkAnswer(question, answer)
      // Base points + speed bonus, then streak bonus layered on top (see applyStreak).
      const basePoints = isCorrect ? calcPoints(question.points || 1000, serverTimeMs, question.timerSeconds || 20) : 0
      const streakBonus = applyStreak(participant, isCorrect, isNonScored)
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
      }
      participant.score += points

      // Audit log: persist every accepted answer immediately so scores are
      // recoverable even if RAM state is lost (server restart, redeploy).
      persistAnswer({
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
      })

      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: session.participants.size,
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

      console.log(`[submit_answer:accept] code=${gameCode} q=${qi} sid=${socket.id} pts=${points} correct=${isCorrect}`)
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
                io.to(`session:${code}`).emit('host_disconnected')
                sessions.delete(code)
                console.log(`[session] deleted (host never returned): ${code}`)
              }
            }, 5 * 60 * 1000)
            continue
          }
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
          continue
        }
        if (session.participants.has(socket.id)) {
          const participant = session.participants.get(socket.id)
          const name = participant.name
          // Grace period: mark as disconnected, allow 20 minutes to reconnect.
          // Covers long lobbies, multi-hour presentations where phones may lock
          // for 15+ minutes between polls, and noisy mobile networks. Cost is
          // a few KB per orphaned participant — negligible.
          participant.disconnectedAt = Date.now()
          participant.disconnectedSocketId = socket.id
          if (!session.disconnectedParticipants) session.disconnectedParticipants = new Map()
          session.disconnectedParticipants.set(name.toLowerCase(), { socketId: socket.id, participant, gameCode: code })
          console.log(`[participant] ${name} disconnected from ${code}, grace period 20min`)
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
              if (session.type === 'presenter') {
                io.to(`host:${code}`).emit('presenter_participant_left', { count: session.participants.size })
              } else {
                io.to(`host:${code}`).emit('participant_left', { name, count: session.participants.size })
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

function calcPoints(base, timeMs, timerSeconds) {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  const speedBonus = Math.round(500 * speedRatio)
  return base + speedBonus
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

// Emit question_ended to the whole room (reveal moment — correctAnswer intentionally exposed).
// Also emits a top-5 leaderboard snapshot to the room for the "between questions" moment,
// and a personalized rank to each individual participant.
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const q = session.quizData.questions[questionIndex]
  if (!q) return
  const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking', 'drawing'].includes(q.type)
  const correctAnswer = isNonScored
    ? null
    : (q.correctAnswers ?? q.correctAnswer ?? null)

  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer,
    explanation: q.explanation ?? null,
    isNonScored,
  })

  // Ghost Mode — advance ghost player scores by their per-question allocation.
  if (session.ghostPlayers?.length && !isNonScored) {
    const totalQ = session.quizData.questions.length
    for (const ghost of session.ghostPlayers) {
      // Distribute final score evenly, but give last question the remainder.
      const isLast = questionIndex === totalQ - 1
      const increment = isLast
        ? ghost.finalScore - ghost.score
        : ghost.perQuestionScore
      ghost.score = Math.max(0, ghost.score + increment)
      // Keep participant map in sync so buildLeaderboardSnapshot picks them up.
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

  // Intermediate leaderboard — skip on non-scored questions so we don't spam
  // uninteresting snapshots during polls / word clouds.
  if (session.sessionMode !== 'reflection' && !isNonScored) {
    const top = buildLeaderboardSnapshot(session.participants, 5)
    const teamLeaderboard = buildTeamLeaderboard(session)
    io.to(`session:${gameCode}`).emit('leaderboard_update', {
      top,
      teamLeaderboard,
      totalPlayers: realParticipantCount(session.participants),
      questionIndex,
    })

    // Personalized rank delta to each participant (their own rank, not in top-5).
    for (const [socketId] of session.participants.entries()) {
      if (socketId.startsWith('ghost::')) continue // skip ghost entries
      const rankInfo = getParticipantRank(session.participants, socketId)
      if (rankInfo) {
        io.to(socketId).emit('my_rank_update', rankInfo)
      }
    }
  }
}

// Compute per-question stats from participant answers for the session report
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
        isNonScored, optionDistribution: null,
      }
    }

    // For polls / non-scored: compute option distribution instead of correctness
    if (isNonScored) {
      const numOptions = q.options?.length ?? 0
      const optionDistribution = Array(numOptions).fill(0)
      for (const p of answered) {
        const idx = Number(p.answers[i].answer)
        if (idx >= 0 && idx < numOptions) optionDistribution[idx]++
      }
      return {
        index: i, text: q.text, type: q.type, correctPct: null, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
        isNonScored, optionDistribution,
        options: q.options,
      }
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
      isNonScored: false, optionDistribution: null,
    }
  })
}
