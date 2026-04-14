import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { assignArchetype } from './src/lib/archetypes.mjs'
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

app.prepare().then(() => {
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
  })

  // Verify auth on socket connection — attach userId to socket.data
  io.use(async (socket, next) => {
    socket.data.userId = await getSocketUserId(socket)
    next()
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (user: ${socket.data.userId ?? 'anonymous'})`)

    // ─── HOST EVENTS ───────────────────────────────────────────────

    socket.on('create_session', async ({ quizData, sessionMode, anonymousMode, teamMode, teamCount }, callback) => {
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

      sessions.set(gameCode, {
        hostSocketId: socket.id,
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
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[session] created: ${gameCode}${teamMode ? ` (teams: ${numTeams})` : ''}`)
      callback({ success: true, gameCode })
    })

    socket.on('start_quiz', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.status = 'active'
      session.currentQuestionIndex = 0
      const question = sanitizeQuestion(session.quizData.questions[0])
      const startAt = Date.now() + 500
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

    socket.on('pause_quiz', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      session.paused = true
      io.to(`session:${gameCode}`).emit('quiz_paused')
      console.log(`[session] paused: ${gameCode}`)
    })

    socket.on('resume_quiz', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return
      session.paused = false
      const elapsed = session.questionStartedAt ? Date.now() - session.questionStartedAt : 0
      const timer = session.quizData?.questions[session.currentQuestionIndex]?.timerSeconds || 20
      const remainingMs = Math.max(0, timer * 1000 - elapsed)
      io.to(`session:${gameCode}`).emit('quiz_resumed', { remainingMs })
      console.log(`[session] resumed: ${gameCode}`)
    })

    socket.on('next_question', ({ gameCode }) => {
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
          participantCount: session.participants.size,
          sessionId: session.dbId || null,
          results: {
            leaderboard,
            teamLeaderboard,
            questionStats,
            quizTitle: session.quizData.title,
            questionCount: session.quizData.questions.length,
            duration: Math.round((Date.now() - (session.startedAt || Date.now())) / 1000),
          },
        })
        setTimeout(() => sessions.delete(gameCode), 5 * 60 * 1000)
        return
      }

      emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)

      const startAt = Date.now() + 500
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

    socket.on('end_session', async ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)

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
        participantCount: session.participants.size,
        sessionId: session.dbId || null,
        results: {
          leaderboard,
          teamLeaderboard,
          questionStats,
          quizTitle: session.quizData.title,
          questionCount: session.quizData.questions.length,
          duration: Math.round((Date.now() - (session.startedAt || Date.now())) / 1000),
        },
      })

      // Clean up session after grace period
      setTimeout(() => sessions.delete(gameCode), 5 * 60 * 1000)
    })

    // ─── PRESENTER MODE EVENTS ─────────────────────────────────────

    socket.on('create_presenter_session', async ({ presentationData }, callback) => {
      if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
        callback({ success: false, error: 'Server capacity reached. Try again in a few minutes.' })
        return
      }
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      const presenterHostName = await getHostName(socket.data.userId)

      sessions.set(gameCode, {
        hostSocketId: socket.id,
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
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[presenter] created: ${gameCode}`)
      callback({ success: true, gameCode })
    })

    socket.on('presenter_next_slide', ({ gameCode, slideIndex }) => {
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
      })
      console.log(`[presenter] ${gameCode} → slide ${slideIndex}`)
    })

    socket.on('presenter_prev_slide', ({ gameCode, slideIndex }) => {
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
      })
    })

    socket.on('submit_presenter_response', ({ gameCode, slideIndex, response }) => {
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
    socket.on('presenter_reveal_results', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      const slideIndex = session.currentSlideIndex
      const agg = session.aggregates[slideIndex]
      if (!agg) return

      agg.revealed = true
      io.to(`session:${gameCode}`).emit('presenter_results_revealed', agg)
    })

    socket.on('end_presenter_session', async ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id || session.type !== 'presenter') return

      session.status = 'ended'

      // Send aggregates to host before cleanup so client can persist analytics
      socket.emit('presenter_session_summary', {
        aggregates: session.aggregates,
        participantCount: session.participants.size,
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
        participantCount: session.participants.size,
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

    socket.on('join_presenter_session', async ({ gameCode, displayName, email }, callback) => {
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
      if (session.hostPlan === null) {
        session.hostPlan = await getHostPlan(session.userId)
      }
      const presenterMaxP = session.hostPlan === 'pro' ? Infinity : 50
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

    socket.on('generate_followup', async ({ gameCode }, callback) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) {
        callback({ success: false, error: 'Session not found.' })
        return
      }

      // Pro-only feature — use cached plan
      if (session.hostPlan === null) {
        session.hostPlan = await getHostPlan(session.userId)
      }
      if (session.hostPlan !== 'pro') {
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

    socket.on('join_followup', ({ code }, callback) => {
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

    socket.on('join_session', async ({ gameCode: rawCode, displayName, email }, callback) => {
      const gameCode = String(rawCode ?? '').trim()
      const session = sessions.get(gameCode)

      if (!session) {
        callback({ success: false, error: 'Game not found. Check the code and try again.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'This game has already ended.' })
        return
      }

      // Participant limit check — cache plan on first join
      if (session.hostPlan === null) {
        session.hostPlan = await getHostPlan(session.userId)
      }
      const hostPlan = session.hostPlan
      const maxParticipants = hostPlan === 'pro' ? Infinity : 50
      if (session.participants.size >= maxParticipants) {
        callback({ success: false, error: 'This session is full (max 50 participants on Free plan). The host can upgrade to Pro for unlimited participants.' })
        return
      }

      // Truncate display name server-side for safety
      const safeName = String(displayName ?? '').slice(0, 30).trim() || 'Anonymous'

      // Check if this is a reconnecting participant (grace period recovery)
      const disconnectedKey = safeName.toLowerCase()
      const disconnectedEntry = session.disconnectedParticipants?.get(disconnectedKey)
      if (disconnectedEntry) {
        // Restore the participant under the new socket ID
        const oldParticipant = disconnectedEntry.participant
        session.participants.delete(disconnectedEntry.socketId)
        delete oldParticipant.disconnectedAt
        delete oldParticipant.disconnectedSocketId
        session.participants.set(socket.id, oldParticipant)
        session.disconnectedParticipants.delete(disconnectedKey)
        socket.join(`session:${gameCode}`)
        console.log(`[participant] ${safeName} reconnected to ${gameCode}`)
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

      const participant = { name: displayStoredName, realName: safeName, archetype, score: 0, answers: [], team, joinedAt: new Date() }
      session.participants.set(socket.id, participant)
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
      })

      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayStoredName,
        archetype,
        count: session.participants.size,
        team,
      })

      console.log(`[session] ${displayName} (${archetype}${team ? `, Team ${team.name}` : ''}) joined ${gameCode}`)
    })

    socket.on('submit_answer', ({ gameCode, answer, timeMs, confidence }) => {
      const session = sessions.get(gameCode)
      if (!session || session.status !== 'active') return

      const participant = session.participants.get(socket.id)
      if (!participant) return

      const qi = session.currentQuestionIndex
      const question = session.quizData.questions[qi]

      if (participant.answers[qi] !== undefined) return

      // Enforce timer: reject only when Date.now() > questionStartedAt + timer*1000 + 2000ms grace.
      // The 500ms warm-up in questionStartedAt is absorbed by this grace window.
      if (session.questionStartedAt) {
        const elapsed = Date.now() - session.questionStartedAt
        const deadline = (question.timerSeconds || 20) * 1000 + 2000
        if (elapsed > deadline) {
          socket.emit('answer_confirmed', { isCorrect: false, points: 0, totalScore: participant.score, late: true })
          return
        }
      }

      // Ranking questions: accept an array of option indices, store raw, do not score.
      if (question.type === 'ranking' && Array.isArray(answer)) {
        participant.answers[qi] = answer
        socket.emit('answer_confirmed', { isCorrect: null, points: 0, totalScore: participant.score, isNonScored: true })
        const numOptions = question.options?.length ?? 4
        io.to(`host:${gameCode}`).emit('answer_received', {
          count: countAnswers(session, qi),
          total: session.participants.size,
          optionCounts: countAnswersByOption(session, qi, numOptions),
        })
        io.to(`host:${gameCode}`).emit('ranking_submission', { order: answer })
        return
      }

      const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking'].includes(question.type)
      const isCorrect = isNonScored ? null : checkAnswer(question, answer)
      const points = isCorrect ? calcPoints(question.points || 1000, timeMs, question.timerSeconds || 20) : 0

      participant.answers[qi] = { answer, isCorrect, points, timeMs, confidence: confidence ?? 'unsure' }
      participant.score += points

      socket.emit('answer_confirmed', { isCorrect, points, totalScore: participant.score, isNonScored })

      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: session.participants.size,
        optionCounts: countAnswersByOption(session, qi, numOptions),
      })
    })

    // ─── DISCONNECT ─────────────────────────────────────────────────

    socket.on('disconnect', () => {
      for (const [code, session] of sessions.entries()) {
        if (session.hostSocketId === socket.id) {
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
          continue
        }
        if (session.participants.has(socket.id)) {
          const participant = session.participants.get(socket.id)
          const name = participant.name
          // Grace period: mark as disconnected, allow 30s to reconnect
          participant.disconnectedAt = Date.now()
          participant.disconnectedSocketId = socket.id
          if (!session.disconnectedParticipants) session.disconnectedParticipants = new Map()
          session.disconnectedParticipants.set(name.toLowerCase(), { socketId: socket.id, participant, gameCode: code })
          console.log(`[participant] ${name} disconnected from ${code}, grace period 30s`)
          // Remove after 30s if they haven't reconnected
          setTimeout(() => {
            const entry = session.disconnectedParticipants?.get(name.toLowerCase())
            if (entry && entry.socketId === socket.id) {
              session.disconnectedParticipants.delete(name.toLowerCase())
              session.participants.delete(socket.id)
              if (participant.attendeeId) {
                updateAttendeeOnLeave(participant.attendeeId, participant.joinedAt).catch(console.error)
              }
              if (session.type === 'presenter') {
                io.to(`host:${code}`).emit('presenter_participant_left', { count: session.participants.size })
              } else {
                io.to(`host:${code}`).emit('participant_left', { name, count: session.participants.size })
              }
              console.log(`[participant] ${name} removed from ${code} after grace period`)
            }
          }, 30000)
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

function checkAnswer(question, answer) {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    const correct = [...question.correctAnswer].sort().join(',')
    const given = [...answer].sort().join(',')
    return correct === given
  }
  return false
}

function calcPoints(base, timeMs, timerSeconds) {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  const speedBonus = Math.round(500 * speedRatio)
  return base + speedBonus
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
    .map(p => ({ name: p.name, archetype: p.archetype, score: p.score, team: p.team ?? null }))
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

// Emit question_ended to the whole room (reveal moment — correctAnswer intentionally exposed)
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const q = session.quizData.questions[questionIndex]
  if (!q) return
  const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking'].includes(q.type)
  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer: isNonScored ? null : q.correctAnswer,
    explanation: q.explanation ?? null,
    isNonScored,
  })
}

// Compute per-question stats from participant answers for the session report
function buildQuestionStats(session) {
  const ps = Array.from(session.participants.values())
  return session.quizData.questions.map((q, i) => {
    const isNonScored = ['poll', 'case', 'wordcloud', 'openended', 'qa', 'rating', 'ranking'].includes(q.type)
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
