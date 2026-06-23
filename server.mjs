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
  BrainstormUpvoteSchema,
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
import { allowRate, generateGameCode, sanitizeDisplayText, startRateBucketSweep } from './src/lib/server-guards.mjs'

// Two-screen host model: a session may have MULTIPLE host sockets at once
// (projector + phone remote). `hostSocketId` stays as the PRIMARY (projector)
// socket so legacy reads keep working; `hostSocketIds` is the full set. Any
// socket in the set is authorised to fire host control events.
function isHostSocket(session, socket) {
  return !!(session?.hostSocketIds && session.hostSocketIds.has(socket.id))
}

// ─── Startup env var validation ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const REQUIRED = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'OPENROUTER_API_KEY']
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      console.error(`[FATAL] Missing required env var: ${key}`)
      process.exit(1)
    }
  }
  // Without these, the Socket.IO CORS allowlist silently becomes [] and
  // every cross-origin connection is rejected (or worse, misconfigured).
  if (!process.env.HOST_DOMAIN && !process.env.JOIN_DOMAIN) {
    console.error('[FATAL] Set HOST_DOMAIN and/or JOIN_DOMAIN for Socket.IO CORS in production.')
    process.exit(1)
  }
}

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// ─── Database pool for session persistence ─────────────────────
// max=20: a live quiz with 50+ participants fans out into many concurrent
// auth checks, Prisma queries, and persist writes. The previous max=5 was
// the dominant cause of the "site is sometimes unreachable" reports —
// requests queued behind a tiny pool, hit Cloudflare's edge timeout, and
// surfaced as 503s. Neon's pooled endpoint comfortably supports this.
let dbPool = null
if (process.env.DATABASE_URL) {
  dbPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  dbPool.on('error', (err) => {
    // Idle connections can drop (Neon scale-to-zero, network blip) — log
    // but don't crash; the pool will reconnect on the next checkout.
    console.error('[db:pool] idle client error:', err?.message ?? err)
  })
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
    'ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "selfPaced" BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "timeLimitMinutes" INTEGER',
    'ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "allowRetries" BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "opensAt" TIMESTAMP(3)',
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

// Session state lives in RAM, so a crash/redeploy strands GameSession rows at
// status='active' forever — they then render as eternally-running sessions in
// reports. Close out rows that are clearly dead (no instance can legitimately
// still be running them) and log the younger ones for visibility. Cheap crash
// mitigation until session state moves to Redis.
const ORPHANED_SESSION_CUTOFF_HOURS = 6
async function reapOrphanedGameSessions() {
  if (!dbPool) return
  try {
    const { rowCount } = await dbPool.query(
      `UPDATE "GameSession"
       SET status = 'ended', "endedAt" = now()
       WHERE status = 'active' AND "createdAt" < now() - interval '${ORPHANED_SESSION_CUTOFF_HOURS} hours'`
    )
    if (rowCount > 0) console.warn(`[boot:reap-orphans] closed ${rowCount} stale active GameSession rows (>${ORPHANED_SESSION_CUTOFF_HOURS}h old)`)
    const { rows } = await dbPool.query(
      `SELECT count(*)::int AS n FROM "GameSession" WHERE status = 'active'`
    )
    if (rows[0]?.n > 0) console.warn(`[boot:reap-orphans] ${rows[0].n} recent active GameSession rows remain (may belong to another instance or a session interrupted by this restart)`)
  } catch (err) {
    console.warn('[boot:reap-orphans] skipped:', err.message)
  }
}

// ── Scheduled / self-paced (async) quiz sweep ────────────────────────────────
// Async sessions run with no host present, so nothing in the request path
// guarantees they ever end. This sweep is the robot invigilator. Every 60s:
//   1. finalize attendees whose personal deadlineAt passed mid-attempt —
//      their recorded answers are summed so partial work still counts;
//   2. end sessions whose closesAt passed (30s grace matches the answer
//      route's in-flight grace);
//   3. for ended async sessions missing `results`, finalize any remaining
//      stragglers, recount participantCount, and write the same results JSON
//      shape live sessions persist — so the Sessions/Reports pages and the
//      CSV/XLSX/PDF export endpoints work on scheduled quizzes unchanged.
// Every step is keyed on current DB state (WHERE guards / results IS NULL),
// so the sweep is idempotent and safe across restarts.
const ASYNC_SWEEP_INTERVAL_MS = 60_000

// Sum recorded answer points into Attendee.finalScore for in-progress
// attendees matching extraWhere. Returns affected sessionIds.
async function finalizeAsyncStragglers(extraWhere, params) {
  const { rows } = await dbPool.query(
    `UPDATE "Attendee" a
     SET "leftAt" = now(),
         "finalScore" = COALESCE((
           SELECT SUM(an.points)::int FROM "Answer" an
           WHERE an."attendeeId" = a.id AND an."sessionId" = a."sessionId"
         ), 0)
     WHERE a."leftAt" IS NULL
       AND a."sessionId" IN (SELECT id FROM "GameSession" WHERE mode = 'async')
       AND ${extraWhere}
     RETURNING a."sessionId"`,
    params,
  )
  return [...new Set(rows.map(r => r.sessionId))]
}

// participantCount = count of finished attendees. Absolute recount rather
// than increments: self-healing if the finish route and this sweep race.
async function recountAsyncParticipants(sessionIds) {
  if (sessionIds.length === 0) return
  await dbPool.query(
    `UPDATE "GameSession" g
     SET "participantCount" = (
       SELECT COUNT(*)::int FROM "Attendee" a
       WHERE a."sessionId" = g.id AND a."leftAt" IS NOT NULL
     )
     WHERE g.id = ANY($1)`,
    [sessionIds],
  )
}

// Build the live-mode `results` shape from DB rows for one async session.
async function buildAsyncResults(sessionId) {
  const { rows: sessRows } = await dbPool.query(
    `SELECT g.id, g."opensAt", g."closesAt", g."createdAt", g."endedAt",
            v.title, v.snapshot
     FROM "GameSession" g
     LEFT JOIN "QuizVersion" v ON v.id = g."quizVersionId"
     WHERE g.id = $1`,
    [sessionId],
  )
  const sess = sessRows[0]
  if (!sess) return null
  const questions = Array.isArray(sess.snapshot) ? sess.snapshot : []

  const { rows: attendees } = await dbPool.query(
    `SELECT id, nickname, "finalScore" FROM "Attendee"
     WHERE "sessionId" = $1 AND "leftAt" IS NOT NULL
     ORDER BY "finalScore" DESC`,
    [sessionId],
  )
  const { rows: answers } = await dbPool.query(
    `SELECT "attendeeId", "questionIndex", "isCorrect", confidence
     FROM "Answer" WHERE "sessionId" = $1`,
    [sessionId],
  )

  const leaderboard = attendees.map(a => ({
    name: a.nickname, archetype: null, score: a.finalScore ?? 0, team: null, isGhost: false,
  }))

  const byIndex = new Map()
  for (const an of answers) {
    if (!byIndex.has(an.questionIndex)) byIndex.set(an.questionIndex, [])
    byIndex.get(an.questionIndex).push(an)
  }
  const questionStats = questions.map((q, i) => {
    const qAnswers = byIndex.get(i) ?? []
    const total = qAnswers.length
    const isNonScored = !isScoredQuestion(q)
    if (isNonScored || total === 0) {
      return {
        index: i, text: q.text, type: q.type,
        correctPct: isNonScored ? null : 0, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
        isNonScored, totalResponses: total, optionDistribution: null,
      }
    }
    let correct = 0, sureCorrect = 0, sureWrong = 0, unsureCorrect = 0, unsureWrong = 0
    for (const an of qAnswers) {
      const ic = an.isCorrect === true
      const sure = an.confidence === 'sure'
      if (ic) correct++
      if (an.confidence) {
        if (sure && ic) sureCorrect++
        else if (sure && !ic) sureWrong++
        else if (!sure && ic) unsureCorrect++
        else unsureWrong++
      }
    }
    const hasConfidence = sureCorrect + sureWrong + unsureCorrect + unsureWrong > 0
    return {
      index: i, text: q.text, type: q.type,
      correctPct: Math.round((correct / total) * 100),
      confidenceGrid: hasConfidence ? { sureCorrect, sureWrong, unsureCorrect, unsureWrong } : null,
      bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
      isNonScored: false, totalResponses: total, optionDistribution: null,
    }
  })

  const maxScore = questions.reduce((sum, q) => (
    isScoredQuestion(q) ? sum + (q.points || 1000) : sum
  ), 0)
  const startMs = (sess.opensAt ?? sess.createdAt)?.getTime?.() ?? Date.now()
  const endMs = (sess.endedAt ?? sess.closesAt)?.getTime?.() ?? Date.now()

  return {
    leaderboard,
    teamLeaderboard: null,
    questionStats,
    quizTitle: sess.title || 'Quiz',
    questionCount: questions.length,
    maxScore,
    duration: Math.max(0, Math.round((endMs - startMs) / 1000)),
  }
}

async function sweepAsyncSessions() {
  if (!dbPool) return
  try {
    // 1. Per-participant deadlines (open sessions only — ended ones are
    //    handled in step 3 anyway).
    const deadlineSessions = await finalizeAsyncStragglers(
      `a."deadlineAt" IS NOT NULL AND a."deadlineAt" < now()
       AND a."sessionId" IN (SELECT id FROM "GameSession" WHERE mode = 'async' AND status = 'open')`,
      [],
    )
    await recountAsyncParticipants(deadlineSessions)

    // 2. Close past-due sessions.
    // Grace matches CLOSE_GRACE_MS in the answer route (30s), so answers in
    // flight at the deadline land before the session flips to 'ended'.
    const { rows: closed } = await dbPool.query(
      `UPDATE "GameSession"
       SET status = 'ended', "endedAt" = now()
       WHERE mode = 'async' AND status = 'open'
         AND "closesAt" IS NOT NULL
         AND "closesAt" < now() - interval '30 seconds'
       RETURNING id`,
    )
    if (closed.length > 0) {
      console.log(`[async-sweep] closed ${closed.length} past-due session(s)`)
    }

    // 3. Ended async sessions missing results (covers sweep-closed, host
    //    "close now", and unpublish). Finalize stragglers, recount, persist.
    const { rows: needResults } = await dbPool.query(
      `SELECT id FROM "GameSession"
       WHERE mode = 'async' AND status = 'ended' AND results IS NULL
         AND "endedAt" > now() - interval '7 days'
       LIMIT 20`,
    )
    for (const { id } of needResults) {
      await finalizeAsyncStragglers(`a."sessionId" = $1`, [id])
      await recountAsyncParticipants([id])
      const results = await buildAsyncResults(id)
      if (results) {
        // results IS NULL guard keeps this idempotent under concurrency
        await dbPool.query(
          `UPDATE "GameSession" SET results = $2::jsonb WHERE id = $1 AND results IS NULL`,
          [id, JSON.stringify(results)],
        )
        console.log(`[async-sweep] finalized results for session ${id} (${results.leaderboard.length} finisher(s))`)
      }
    }
  } catch (err) {
    console.warn('[async-sweep] pass failed:', err.message)
  }
}

async function persistGameSession(data, attempt = 1) {
  if (!dbPool) return
  const { code, type, quizId, presentationId, userId, hostName, status, participantCount, results, sessionId } = data
  try {
    if (sessionId) {
      // Row was pre-created at first-join; update with final results.
      // participantCount = total who actually joined (Attendee rows), not just
      // those still connected at end. GREATEST keeps the live count as a floor
      // in case attendee inserts were skipped (DB best-effort on join).
      await dbPool.query(
        `UPDATE "GameSession"
         SET status = $1,
             "participantCount" = GREATEST($2, (SELECT COUNT(*)::int FROM "Attendee" WHERE "sessionId" = $4)),
             results = $3::jsonb, "endedAt" = now()
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
startRateBucketSweep()
const MAX_CONCURRENT_SESSIONS = 500

function socketIp(socket) {
  // Railway/Cloudflare put the real client IP in x-forwarded-for.
  const fwd = socket.handshake.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return socket.handshake.address || 'unknown'
}


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


// Ended sessions linger briefly so late acks and refreshes resolve to a clean
// "ended" response instead of "not found" — but they used to hold the full
// quiz payload + every participant's answer arrays for 5 minutes. Strip the
// heavy fields immediately (results are already persisted to the DB by the
// time this is called) and delete after a short grace.
const ENDED_SESSION_GRACE_MS = 60_000
function scheduleEndedSessionCleanup(gameCode, session) {
  session.quizData = session.quizData
    ? { id: session.quizData.id || null, title: session.quizData.title || '', questions: [] }
    : session.quizData
  if (session.presentationData) {
    session.presentationData = {
      id: session.presentationData.id || null,
      title: session.presentationData.title || '',
      slides: [],
    }
  }
  setTimeout(() => sessions.delete(gameCode), ENDED_SESSION_GRACE_MS).unref?.()
}

// When the session cap is hit, ended sessions waiting out their grace period
// shouldn't block new games. Returns the number evicted.
function evictEndedSessions() {
  let evicted = 0
  for (const [code, s] of sessions.entries()) {
    if (s.status === 'ended') {
      if (s.endTimer) { clearTimeout(s.endTimer); s.endTimer = null }
      sessions.delete(code)
      evicted++
    }
  }
  return evicted
}

app.prepare().then(async () => {
  // Repair schema drift BEFORE the server starts handling requests. Safe on
  // every boot — ALTER TABLE IF NOT EXISTS is a no-op when columns are present.
  await ensureCriticalColumns()
  // Fire-and-forget: closing out orphaned rows must not delay boot.
  reapOrphanedGameSessions()
  // Robot invigilator for scheduled/self-paced quizzes: first pass shortly
  // after boot (catch up on anything due while we were down), then every 60s.
  setTimeout(sweepAsyncSessions, 5_000).unref?.()
  setInterval(sweepAsyncSessions, ASYNC_SWEEP_INTERVAL_MS).unref?.()

  const httpServer = createServer((req, res) => {
    // Short-circuit: session lookup API (no auth, reads in-memory sessions Map)
    if (req.method === 'GET' && req.url && req.url.startsWith('/api/session/lookup')) {
      try {
        // Rate-limit per IP: this endpoint is unauthenticated and confirms
        // whether a game code exists — the cheapest enumeration vector.
        const fwd = req.headers['x-forwarded-for']
        const ip = typeof fwd === 'string' && fwd.length
          ? fwd.split(',')[0].trim()
          : (req.socket.remoteAddress || 'unknown')
        if (!allowRate(`${ip}:lookup`, 60)) {
          res.statusCode = 429
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'rate_limited' }))
          return
        }
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
        // Include the title so the participant join page can render
        // "Joining {title}" before the user submits their name — without
        // this, the title is only known after the socket join_session
        // callback and the form sits on a generic "Join a live quiz" label.
        const title = type === 'presenter'
          ? (session.presentationData?.title || '')
          : (session.quizData?.title || '')
        res.statusCode = 200
        res.end(JSON.stringify({ ok: true, exists: true, type, status: session.status, title }))
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
      // Hosting requires a signed-in user. The host UI is already behind
      // NextAuth; this closes the gap for raw socket clients that could
      // previously create sessions (and claim host controls) anonymously.
      if (!socket.data.userId) {
        callback({ success: false, error: 'Sign in to host a session.' })
        return
      }
      if (!allowRate(`${socket.data.userId}:create_session`, 5)) {
        callback({ success: false, error: 'Too many sessions created. Wait a minute and try again.' })
        return
      }
      if (quizData.id) {
        const ownership = await verifyOwnership('Quiz', quizData.id, socket.data.userId)
        if (ownership === 'foreign') {
          console.warn(`[socket:create_session] ownership rejected for user=${socket.data.userId ?? 'anon'} quizId=${quizData.id}`)
          callback({ success: false, error: 'You do not own this quiz.' })
          return
        }
      }
      if (sessions.size >= MAX_CONCURRENT_SESSIONS && evictEndedSessions() === 0) {
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
        hostSocketIds: new Set([socket.id]), // Two-screen host model (projector + remote)
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
      // Mandatory when the session has an owner: a stolen resume token alone
      // (e.g. lifted via XSS from sessionStorage) must not be enough to take
      // over a session — the resuming socket must be the same signed-in user.
      if (session.userId && session.userId !== socket.data.userId) {
        console.warn(`[host_resume] userId mismatch code=${gameCode}`)
        callback({ success: false, error: 'User mismatch.' })
        return
      }
      session.hostSocketId = socket.id
      // Two-screen host model: projector reconnect rebinds the PRIMARY socket
      // AND re-adds it to the host set so control events keep working.
      if (!session.hostSocketIds) session.hostSocketIds = new Set()
      session.hostSocketIds.add(socket.id)
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

    // Two-screen host model — pair a phone remote to an existing session.
    // The projector (primary) host displays a 4-digit PIN; the remote enters
    // gameCode + pin. Authorised only for the session owner. On success the
    // remote socket joins the host room and receives a full session_state
    // snapshot; it does NOT become the primary (projector stays hostSocketId).
    // Account-based phone remote: list the live sessions owned by the signed-in
    // user so their phone can pick one to control. Identity (not a PIN) is the
    // gate — a participant's socket carries a different userId (or none) and so
    // sees nothing. `callback` may arrive as the first arg when the client emits
    // with an ack and no payload.
    socket.on('host_list_my_sessions', (payload, callback) => {
      const cb = typeof callback === 'function' ? callback : (typeof payload === 'function' ? payload : null)
      if (!socket.data.userId) {
        if (cb) cb({ success: false, error: 'Sign in to control a session.', sessions: [] })
        return
      }
      const mine = []
      for (const [gameCode, session] of sessions) {
        if (session.userId && session.userId === socket.data.userId && session.status !== 'ended') {
          mine.push({
            gameCode,
            title: String(session.quizData?.title || session.presentationData?.title || 'Untitled'),
            phase: session.status,
            playerCount: getConnectedCount(session),
          })
        }
      }
      if (cb) cb({ success: true, sessions: mine })
    })

    socket.on('host_join_remote', (payload = {}, callback) => {
      const gameCode = typeof payload?.gameCode === 'string' ? payload.gameCode : null
      const session = gameCode ? sessions.get(gameCode) : null
      if (!session) {
        socket.emit('host_remote_error', { message: 'Session not found.' })
        if (typeof callback === 'function') callback({ success: false, error: 'Session not found.' })
        return
      }
      // The phone must be signed into the SAME account that owns the session.
      // Identity is the only gate — no PIN. A participant cannot take control
      // because their userId won't match (or they aren't signed in at all).
      if (!socket.data.userId || session.userId !== socket.data.userId) {
        socket.emit('host_remote_error', { message: 'Sign in with the account hosting this session.' })
        if (typeof callback === 'function') callback({ success: false, error: 'Not the session owner.' })
        return
      }
      if (!session.hostSocketIds) session.hostSocketIds = new Set()
      session.hostSocketIds.add(socket.id)
      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      // Full snapshot so the remote can render the current lobby / live state.
      socket.emit('session_state', buildSessionStateSnapshot(session))
      console.log(`[host_join_remote] paired code=${gameCode} sid=${socket.id} user=${socket.data.userId}`)
      if (typeof callback === 'function') callback({ success: true })
    })

    socket.on('start_quiz', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'start_quiz')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || !isHostSocket(session, socket)) return

      session.status = 'active'
      session.currentQuestionIndex = 0
      let question = sanitizeQuestion(session.quizData.questions[0])
      const startAt = Date.now() + 3500  // 3-second countdown window
      session.questionStartedAt = startAt

      // If sequence ranking: shuffle options and build a map from display slot → original index
      if (isSequenceRanking(session.quizData.questions[0])) {
        const indexed = (question.options || []).map((opt, origIndex) => ({ opt, origIndex }))
        const shuffled = fisherYatesShuffle(indexed)
        session.currentRankingShuffleMap = shuffled.map(e => e.origIndex)
        question = { ...question, options: shuffled.map(e => e.opt) }
      } else {
        session.currentRankingShuffleMap = null
      }

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
      if (!session || !isHostSocket(session, socket)) return
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
      if (!session || !isHostSocket(session, socket)) return
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
    socket.on('end_question', (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, callback, 'end_question')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || !isHostSocket(session, socket)) {
        if (typeof callback === 'function') callback({ success: false, error: 'Session not found.' })
        return
      }
      if (session.questionEnded) {
        if (typeof callback === 'function') callback({ success: true, ended: false, questionIndex: session.currentQuestionIndex })
        return
      }
      session.questionEnded = true
      if (session.endTimer) { clearTimeout(session.endTimer); session.endTimer = null }
      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)
      if (typeof callback === 'function') callback({ success: true, ended: true, questionIndex: session.currentQuestionIndex })
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
      if (!session || !isHostSocket(session, socket)) return
      io.to(`session:${gameCode}`).emit('show_standings')
    })

    socket.on('next_question', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'next_question')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || !isHostSocket(session, socket)) return

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
        scheduleEndedSessionCleanup(gameCode, session)
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
      let question = sanitizeQuestion(quizData.questions[currentQuestionIndex])

      // If sequence ranking: shuffle options and build a map from display slot → original index
      if (isSequenceRanking(quizData.questions[currentQuestionIndex])) {
        const indexed = (question.options || []).map((opt, origIndex) => ({ opt, origIndex }))
        const shuffled = fisherYatesShuffle(indexed)
        session.currentRankingShuffleMap = shuffled.map(e => e.origIndex)
        question = { ...question, options: shuffled.map(e => e.opt) }
      } else {
        session.currentRankingShuffleMap = null
      }

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

      // Drawings are the heaviest payload we relay (up to 100KB each). A
      // legit participant submits one per drawing question; the duplicate
      // guard below blocks re-submits, and this caps a hostile client
      // rotating questions/payloads into a relay flood.
      if (!allowRate(`${socket.id}:submit_drawing`, 6)) {
        return reject('rate_limited')
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

      // Host listener at src/app/host/session/page.tsx:400 destructures
      // `count` (not `answered`); historical mismatch caused drawing
      // questions to show "undefined / N answered" on the host UI.
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: getConnectedCount(session),
        connectedCount: getConnectedCount(session),
      })
    })

    socket.on('end_session', async (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'end_session')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || !isHostSocket(session, socket)) return

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
      scheduleEndedSessionCleanup(gameCode, session)
    })

    // ─── PRESENTER MODE EVENTS ─────────────────────────────────────

    socket.on('create_presenter_session', async (rawPayload, callback) => {
      const parsed = validateSocketPayload(socket, CreatePresenterSessionSchema, rawPayload, callback, 'create_presenter_session')
      if (!parsed) return
      const { presentationData } = parsed
      // Same enforcement as create_session: hosting requires a signed-in user.
      if (!socket.data.userId) {
        callback({ success: false, error: 'Sign in to host a session.' })
        return
      }
      if (!allowRate(`${socket.data.userId}:create_session`, 5)) {
        callback({ success: false, error: 'Too many sessions created. Wait a minute and try again.' })
        return
      }
      if (presentationData.id) {
        const ownership = await verifyOwnership('Presentation', presentationData.id, socket.data.userId)
        if (ownership === 'foreign') {
          console.warn(`[socket:create_presenter_session] ownership rejected for user=${socket.data.userId ?? 'anon'} presentationId=${presentationData.id}`)
          callback({ success: false, error: 'You do not own this presentation.' })
          return
        }
      }
      if (sessions.size >= MAX_CONCURRENT_SESSIONS && evictEndedSessions() === 0) {
        callback({ success: false, error: 'Server capacity reached. Try again in a few minutes.' })
        return
      }
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      const presenterHostName = await getHostName(socket.data.userId)

      const presenterHostResumeToken = randomUUID()
      sessions.set(gameCode, {
        hostSocketId: socket.id,
        hostSocketIds: new Set([socket.id]), // Two-screen host model (projector + remote)
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
      if (!session || !isHostSocket(session, socket) || session.type !== 'presenter') return

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
      if (!session || !isHostSocket(session, socket) || session.type !== 'presenter') return

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
      if (!session || !isHostSocket(session, socket) || session.type !== 'presenter') return
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
      // Flood backstop — the votedSlides guard below is the real per-slide
      // gate; this caps hostile clients hammering the handler across slides.
      if (!allowRate(`${socket.id}:presenter_response`, 30)) {
        if (ack) ack({ accepted: false, reason: 'rate_limited' })
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

      // Initialize aggregate for this slide. Each field corresponds to one
      // visualization mode — we keep them separate so a renderer never has
      // to guess what shape the data is in.
      //   counts    — index → tally          (bar-chart types)
      //   words     — lowercased word → tally (word_cloud)
      //   responses — full text strings       (open_text — text wall)
      //   scores    — numeric values          (rating_scale, scale_100)
      //   emojis    — emoji char → tally      (emoji_pulse)
      //   pins      — {x,y} coords            (pinpoint, grid_2x2)
      //   rankings  — array of orderings      (ranking — drag-to-order)
      if (!session.aggregates[slideIndex]) {
        session.aggregates[slideIndex] = {
          total: 0,
          counts: [],
          words: {},
          responses: [],
          scores: [],
          emojis: {},
          pins: [],
          rankings: [],
          ideas: [],
        }
      }
      const agg = session.aggregates[slideIndex]
      // Defensive: legacy aggregates from before this commit may not have
      // the new fields. Fill them in so renderers can read unconditionally.
      if (!agg.responses) agg.responses = []
      if (!agg.rankings) agg.rankings = []
      if (!agg.ideas) agg.ideas = []
      agg.total++

      // Accumulate based on response type. Historical bug: ranking went
      // through the bar-chart else-branch and `Number([0,1,2])` became NaN,
      // so ranking aggregates were silently broken. open_text was bucketed
      // into `words` and rendered as a word cloud instead of a text wall.
      const slide = session.presentationData.slides[slideIndex]
      if (slide?.type === 'word_cloud') {
        const word = String(response).trim().toLowerCase().slice(0, 100)
        if (word) agg.words[word] = (agg.words[word] || 0) + 1
      } else if (slide?.type === 'open_text') {
        // Free-text wall — preserve the original casing/punctuation. Cap at
        // 500 chars per response and 200 responses per slide so a runaway
        // session can't blow memory.
        const text = String(response).trim().slice(0, 500)
        if (text && agg.responses.length < 200) agg.responses.push(text)
      } else if (slide?.type === 'brainstorm') {
        // Idea board — each submission becomes an upvotable card. Store an id
        // so participants can upvote specific ideas. Cap at 120 ideas/slide.
        const text = String(response).trim().slice(0, 200)
        if (text && agg.ideas.length < 120) {
          agg.ideas.push({ id: `${socket.id}-${slideIndex}-${agg.ideas.length}`, text, votes: 0 })
        }
      } else if (slide?.type === 'ranking') {
        // Store the full ordering. Each entry is [optionIndex, ...] meaning
        // "first choice, second choice, …". Renderer can compute Borda count
        // or per-position frequencies. Cap entries to 100 options + 500 rows.
        if (Array.isArray(response)) {
          const ordering = response
            .slice(0, 100)
            .map(v => Number(v))
            .filter(v => Number.isInteger(v) && v >= 0)
          if (ordering.length > 0 && agg.rankings.length < 500) agg.rankings.push(ordering)
        }
      } else if (slide?.type === 'rating_scale' || slide?.type === 'scale_100') {
        agg.scores.push(Number(response))
      } else if (slide?.type === 'emoji_pulse') {
        const em = String(response)
        agg.emojis[em] = (agg.emojis[em] || 0) + 1
      } else if (slide?.type === 'pinpoint' || slide?.type === 'grid_2x2') {
        const pin = typeof response === 'object' ? response : {}
        agg.pins.push({ x: Number(pin.x) || 0, y: Number(pin.y) || 0 })
      } else {
        // Bar-chart types: multiple_choice, word_duel, live_race, image_choice, quick_fire.
        const idx = Number(response)
        if (Number.isInteger(idx) && idx >= 0) {
          while (agg.counts.length <= idx) agg.counts.push(0)
          agg.counts[idx]++
        }
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

    // Brainstorm upvote — bump the vote count on a specific idea card. One
    // upvote per idea per participant; can't upvote your own idea. Re-broadcasts
    // the aggregate so every card reorders live.
    socket.on('upvote_brainstorm', (rawPayload, ackCallback) => {
      const parsed = validateSocketPayload(socket, BrainstormUpvoteSchema, rawPayload, undefined, 'upvote_brainstorm')
      if (!parsed) return
      const { gameCode, slideIndex, ideaId, participantId: incomingPid } = parsed
      const session = sessions.get(gameCode)
      const ack = typeof ackCallback === 'function' ? ackCallback : null
      if (!session || session.type !== 'presenter') { if (ack) ack({ accepted: false }); return }
      if (!allowRate(`${socket.id}:brainstorm_upvote`, 60)) { if (ack) ack({ accepted: false, reason: 'rate_limited' }); return }

      let participant = session.participants.get(socket.id)
      if (!participant && incomingPid && session.participantsById) {
        participant = session.participantsById.get(incomingPid) || null
      }
      if (!participant) { if (ack) ack({ accepted: false, reason: 'unknown_participant' }); return }

      const agg = session.aggregates[slideIndex]
      if (!agg || !Array.isArray(agg.ideas)) { if (ack) ack({ accepted: false }); return }
      const idea = agg.ideas.find(it => it.id === ideaId)
      if (!idea) { if (ack) ack({ accepted: false }); return }
      // Can't upvote your own submission (idea id is prefixed with the author's socket id).
      if (typeof idea.id === 'string' && idea.id.startsWith(`${socket.id}-`)) { if (ack) ack({ accepted: false, reason: 'own_idea' }); return }

      if (!participant.upvotedIdeas) participant.upvotedIdeas = {}
      const slideVotes = participant.upvotedIdeas[slideIndex] || (participant.upvotedIdeas[slideIndex] = {})
      if (slideVotes[ideaId]) { if (ack) ack({ accepted: false, reason: 'already_upvoted' }); return }
      slideVotes[ideaId] = true
      idea.votes = (idea.votes || 0) + 1

      if (ack) ack({ accepted: true })
      const responseMode = session.presentationData.slides[slideIndex]?.responseMode || 'instant'
      const room = responseMode === 'instant' ? `session:${gameCode}` : `host:${gameCode}`
      io.to(room).emit('presenter_aggregate_updated', agg)
    })

    // Host reveals results to participants (on_click mode)
    socket.on('presenter_reveal_results', (rawPayload) => {
      const parsed = validateSocketPayload(socket, GameCodeOnlySchema, rawPayload, undefined, 'presenter_reveal_results')
      if (!parsed) return
      const { gameCode } = parsed
      const session = sessions.get(gameCode)
      if (!session || !isHostSocket(session, socket) || session.type !== 'presenter') return

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
      if (!session || !isHostSocket(session, socket) || session.type !== 'presenter') return

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
      if (!allowRate(`${socketIp(socket)}:join`, 100) || !allowRate(`${socket.id}:join`, 10)) {
        callback({ success: false, error: 'Too many join attempts. Wait a minute and try again.' })
        return
      }
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

      const safeName = sanitizeDisplayText(displayName) || 'Anonymous'
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
      if (!session || !isHostSocket(session, socket)) {
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
      // Per-IP first (catches code-enumeration across many sockets), then
      // per-socket. Generous enough for classroom NAT where one IP fronts
      // a whole lab, since legit rejoins carry participantId and succeed
      // on the first try.
      if (!allowRate(`${socketIp(socket)}:join`, 100) || !allowRate(`${socket.id}:join`, 10)) {
        callback({ success: false, error: 'Too many join attempts. Wait a minute and try again.' })
        return
      }
      const session = sessions.get(gameCode)

      if (!session) {
        callback({ success: false, error: 'Game not found. Check the code and try again.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'This game has already ended.' })
        return
      }

      // Truncate + strip HTML/control chars server-side for safety
      const safeName = sanitizeDisplayText(displayName) || 'Anonymous'

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

      // Flood backstop. The per-question duplicate guard below is the real
      // gate; this stops a hostile client hammering the validator + DB path.
      // 60/min comfortably covers quick-fire rounds (1 answer every ~2s).
      if (!allowRate(`${socket.id}:submit_answer`, 60)) {
        if (ack) ack({ accepted: false, reason: 'rate_limited' })
        return
      }

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

      // Ranking questions: accept an array of option indices. Score if sequence ranking, else non-scored.
      if (question.type === 'ranking' && Array.isArray(answer)) {
        const isSequence = isSequenceRanking(question)
        let isCorrect = null
        let basePoints = 0
        let correctPositions = 0
        let totalPositions = 0

        // storedOrder: what we persist and emit — original-index space for sequence ranking,
        // raw display-slot indices for non-sequence (consensus only, no scoring).
        let storedOrder = answer
        if (isSequence && session.currentRankingShuffleMap) {
          // Translate display-slot indices to original-option indices, then score
          const originalOrder = answer.map(slot => String(session.currentRankingShuffleMap[slot]))
          storedOrder = originalOrder
          const formula = session.scoringFormula ?? 'classic'
          const timerMs = (question.timerSeconds || 20) * 1000
          const speedMultiplier = isLate ? 0 : (formula === 'accuracy' ? 1 : Math.max(0.5, 1 - serverTimeMs / timerMs))
          const result = scoreRanking(question, originalOrder, speedMultiplier)
          correctPositions = result.correctPositions
          totalPositions = result.totalPositions
          basePoints = result.basePoints
          isCorrect = result.isCorrect
        } else {
          // Non-scored ranking: accept and emit for consensus view
          isCorrect = null
          basePoints = 0
        }

        const streakBonus = 0  // Ranking doesn't use streak
        const points = basePoints
        participant.answers[qi] = {
          answer: storedOrder,
          isCorrect,
          points,
          basePoints,
          streakBonus,
          timeMs: serverTimeMs,
          clientReportedTimeMs,
          confidence: confidence ?? 'unsure',
          ...(isLate ? { late: true } : {}),
          ...(isSequence ? { correctPositions, totalPositions } : {}),
        }
        participant.score += points

        persistAnswer({
          session,
          sessionDbId: session.dbId,
          attendeeId: participant.attendeeId,
          participantId: participant.participantId,
          questionIndex: qi,
          answer: storedOrder,
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
          isNonScored: !isSequence,
          ...(isSequence && totalPositions > 0 ? { correctPositions, totalPositions } : {}),
          ...(isLate ? { late: true } : {}),
        })

        const numOptions = question.options?.length ?? 4
        io.to(`host:${gameCode}`).emit('answer_received', {
          count: countAnswers(session, qi),
          total: getConnectedCount(session),
          connectedCount: getConnectedCount(session),
          optionCounts: countAnswersByOption(session, qi, numOptions),
        })

        io.to(`host:${gameCode}`).emit('ranking_submission', { ranking: storedOrder, order: storedOrder })
        emitLiveResponses(io, gameCode, session, qi)
        if (ack) ack({ accepted: true, isNonScored: !isSequence, questionIndex: qi, ...(isLate ? { late: true } : {}) })
        return
      }

      const isNonScored = !isScoredQuestion(question)
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

      // Neutral receipt only — do NOT reveal correctness/points/score here.
      // Revealing on submit lets a neighbour copy the answer. The per-player
      // reveal (isCorrect, points, score, streak) is delivered later via
      // `personal_result` when the question ends (host reveal, timer, or
      // all-answered). Non-scored questions have nothing to leak.
      socket.emit('answer_confirmed', {
        received: true,
        isNonScored,
        ...(isLate ? { late: true } : {}),
      })
      if (ack) ack({ accepted: true, questionIndex: qi, ...(isLate ? { late: true } : {}) })

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

      // "Lower of two" rule: end the question as soon as EVERY connected player
      // has answered, without waiting out the rest of the timer. Now safe for
      // scored questions too — correctness is no longer leaked on submit (see
      // the neutral answer_confirmed above), so an early submitter can't tip off
      // classmates, and the reveal still fires for everyone simultaneously.
      // Counts answers among CONNECTED players only (matching getConnectedCount's
      // ghost/disconnect rules) so a disconnected player can neither block the
      // end nor trip it early by having answered before dropping.
      if (!session.questionEnded && qi === session.currentQuestionIndex) {
        let connected = 0
        let answeredConnected = 0
        for (const [sid, p] of session.participants.entries()) {
          if (typeof sid === 'string' && sid.startsWith('ghost::')) continue
          if (p?.disconnectedAt) continue
          connected++
          if (p.answers?.[qi] !== undefined) answeredConnected++
        }
        if (connected > 0 && answeredConnected >= connected) {
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
      // Generous limit: legit clients ping 6x burst on connect, 3x on each
      // question_show, then every 15s. 60/min only stops abuse.
      if (!allowRate(`${socket.id}:ping_time`, 60)) return
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
        // Two-screen host model: a disconnecting host socket may be the
        // primary (projector) or a secondary (phone remote). Remove it from
        // the host set in either case; only the PRIMARY path below runs the
        // 5-minute grace / teardown logic.
        if (session.hostSocketIds && session.hostSocketIds.has(socket.id)) {
          session.hostSocketIds.delete(socket.id)
          // Non-primary host (e.g. phone remote) dropping does NOT tear down
          // the session — the projector is still live. Just stop tracking it.
          if (session.hostSocketId !== socket.id) {
            continue
          }
          // Host disconnect grace: during lobby/active, give the host 5 minutes
          // to reconnect before tearing down the session. Mobile/laptop tab churn
          // and brief network blips were previously vaporising live games.
          if (session.status === 'lobby' || session.status === 'active') {
            session.hostDisconnectedAt = Date.now()
            session.hostDisconnectedSocketId = socket.id
            console.log(`[host] disconnected from ${code}, grace period 5min, status=${session.status}`)
            setTimeout(() => {
              const s = sessions.get(code)
              // Only tear down if this socket is STILL the primary AND no other
              // host socket (e.g. a phone remote, or a re-paired projector) is
              // keeping the session alive.
              if (s && s.hostSocketId === socket.id && (!s.hostSocketIds || s.hostSocketIds.size === 0)) {
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

  // ─── Graceful shutdown ───────────────────────────────────────────
  // Without these handlers, every Railway redeploy hard-killed in-flight
  // sockets and DB transactions. New instance took 30–60s to boot, so
  // users saw "site unreachable" during every push (we shipped 4 today
  // alone). On SIGTERM: stop accepting new connections, flush pending
  // persists, close sockets, then exit. Railway gives 30s by default.
  let shuttingDown = false
  async function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[shutdown] received ${signal} — draining...`)
    try {
      // Stop accepting new HTTP/socket connections
      io.close()
      httpServer.close()
      // Best-effort flush of any queued session-state persists
      try { await _flushPendingPersist() } catch (err) { console.warn('[shutdown] flushPendingPersist failed:', err?.message ?? err) }
      // Drain DB pool
      if (dbPool) await dbPool.end().catch(() => {})
      console.log('[shutdown] drained — exiting')
    } catch (err) {
      console.error('[shutdown] error during drain:', err)
    } finally {
      // Hard exit after 25s no matter what — beats Railway's 30s SIGKILL
      setTimeout(() => process.exit(0), 25_000).unref()
      process.exit(0)
    }
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}).catch((err) => {
  // Without this, a throw inside app.prepare() (Next.js boot failure,
  // Sentry init crash, schema-guard timeout) silently hung the process.
  console.error('[fatal] app.prepare failed:', err)
  process.exit(1)
})

// ─── Top-level safety net ──────────────────────────────────────────
// `app.prepare()` was previously a fire-and-forget — if it threw, the
// process hung without ever calling `listen()`, looking healthy to
// `ps` but invisible to traffic. Same for unhandled async rejections
// inside socket handlers. Log loudly and let Railway restart us.
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err)
  // Give logs/Sentry a moment to flush, then exit so Railway respawns.
  setTimeout(() => process.exit(1), 1_000).unref()
})
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason)
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isSequenceRanking(question) {
  return question?.type === 'ranking' && Array.isArray(question?.correctOrder) && question.correctOrder.length > 0
}

function isScoredQuestion(question) {
  if (!question?.type) return false
  if (['mcq', 'multiselect', 'truefalse', 'fillblank', 'matching'].includes(question.type)) return true
  return isSequenceRanking(question)
}

// Canonical free-text normalizer. Mirrors normalizeText in src/lib/quiz-types.ts.
function normalizeText(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function fisherYatesShuffle(array) {
  // Shuffle array in place using Fisher-Yates algorithm. Returns the shuffled array.
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function sanitizeQuestion(q) {
  // Strip answer-revealing fields before broadcasting to the participant
  // room. Historical bug: only `correctAnswer` was stripped, so the
  // multiselect `correctAnswers` array leaked in the question_show payload
  // — anyone with dev-tools could win every multiselect.
  // Note: explanation/debrief are intentionally left in place — the client
  // already gates their display behind the post-answer reveal phase, and
  // including them keeps the late-joiner catch-up path working without an
  // extra round-trip.
  const { correctAnswer: _ca, correctAnswers: _cas, correctOrder: _co, blankAnswers: _ba, matchPairs: _mp, ...safe } = q
  void _ca; void _cas; void _co; void _ba
  // Matching: send the left prompts in order plus a shuffled right-option pool,
  // never the aligned pairs — otherwise the answer key leaks to participants.
  if (q.type === 'matching' && Array.isArray(_mp)) {
    safe.matchLefts = _mp.map(p => p.left)
    safe.matchRights = fisherYatesShuffle(_mp.map(p => p.right))
  }
  safe.isScored = isScoredQuestion(q)
  // Clamp timerSeconds to [5, 120] so a corrupted DB row can't ship a
  // sub-second timer to clients (host reported red-zone starts in live sessions).
  safe.timerSeconds = clampTimerSeconds(safe.timerSeconds, safe.id ?? '(no-id)')
  return safe
}

// Hard floor/ceiling on timerSeconds. Returns the clamped value and warns once
// per offending question so we can clean the row later.
const _clampWarned = new Set()
function clampTimerSeconds(raw, qid) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 5 || n > 120) {
    if (!_clampWarned.has(qid)) {
      _clampWarned.add(qid)
      console.warn(`[timer-clamp] question ${qid} has timerSeconds=${raw} — clamping to [5,120]`)
    }
    if (!Number.isFinite(n)) return 20
    return Math.max(5, Math.min(120, n))
  }
  return n
}

// Catch-up emit for late joiners and reconnects. If the session is active and
// there's a question in flight, send the current question directly to the
// just-joined socket. Without this, late joiners see a blank screen because
// they missed the room-level question_show broadcast.
function sendCurrentQuestionToSocket(socket, session) {
  if (!session || session.status !== 'active') return
  // Don't replay a stale question payload to a reconnecting client when the
  // current question has already ended (between-question gap). Without this
  // guard the client would compute remaining = endAt - now from a past
  // startAt and render the timer in the red zone for ~1-2 seconds.
  if (session.questionEnded) return
  const { currentQuestionIndex, quizData, questionStartedAt } = session
  if (!quizData || typeof currentQuestionIndex !== 'number' || currentQuestionIndex < 0) return
  const q = quizData.questions?.[currentQuestionIndex]
  if (!q) return
  // Additional safety: if the question is mid-flight but the remaining time
  // is less than 1.5s, skip the replay — the next question_show is imminent
  // and a sub-second timer paint looks like a bug to the user.
  const safeTimer = clampTimerSeconds(q.timerSeconds, q.id ?? '(no-id)')
  const endsAt = (questionStartedAt || 0) + safeTimer * 1000
  if (Date.now() > endsAt - 1500) return
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
  if (question.type === 'fillblank') {
    const accepted = Array.isArray(question.blankAnswers) ? question.blankAnswers : []
    if (accepted.length === 0) return false
    const given = normalizeText(answer)
    if (!given) return false
    return accepted.some(a => normalizeText(a) === given)
  }
  if (question.type === 'matching') {
    const pairs = Array.isArray(question.matchPairs) ? question.matchPairs : []
    if (pairs.length === 0 || !Array.isArray(answer) || answer.length !== pairs.length) return false
    return pairs.every((p, i) => normalizeText(answer[i]) === normalizeText(p.right))
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

// All-or-nothing ranking scorer. answer must be an array of original option
// indices (in original-index space). correctOrder holds stringified positional
// indices ["0","1","2",...]. Mirrors src/lib/scoring.ts scoreRanking.
function scoreRanking(question, answer, speedMultiplier) {
  const correctOrder = Array.isArray(question.correctOrder) ? question.correctOrder : []
  const totalPositions = correctOrder.length
  const zero = { isCorrect: false, correctPositions: 0, totalPositions, basePoints: 0 }
  if (totalPositions === 0 || !Array.isArray(answer)) return zero
  const submitted = answer.map(String)
  const correct = correctOrder.map(String)
  let correctPositions = 0
  for (let i = 0; i < totalPositions; i++) {
    if (submitted[i] !== undefined && submitted[i] === correct[i]) correctPositions++
  }
  const isCorrect = correctPositions === totalPositions && submitted.length === totalPositions
  const basePoints = isCorrect ? Math.round((question.points || 1000) * speedMultiplier) : 0
  return { isCorrect, correctPositions, totalPositions, basePoints }
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
function buildLeaderboardSnapshot(participants, limit = 5, opts = {}) {
  // previousRanks/newRanks are keyed by participant map key (socketId or
  // ghostId). When provided along with questionIndex, each entry carries
  // movement data so leaderboard UIs can render ▲/▼ and "+points" badges.
  const { previousRanks, newRanks, questionIndex } = opts
  return Array.from(participants.entries())
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, limit)
    .map(([key, p], i) => {
      const fromRank = previousRanks?.get(key)
      const toRank = newRanks?.get(key) ?? i + 1
      const ans = typeof questionIndex === 'number' ? p.answers?.[questionIndex] : undefined
      return {
        rank: i + 1,
        name: p.name,
        archetype: p.archetype,
        score: p.score,
        streakCount: p.streakCount || 0,
        team: p.team ?? null,
        previousRank: typeof fromRank === 'number' ? fromRank : null,
        rankDelta: (typeof fromRank === 'number' && typeof toRank === 'number') ? fromRank - toRank : 0,
        scoreDelta: ans?.points ?? 0,
      }
    })
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
  // Counts each participant's tap PER option, supporting both single-choice
  // (mcq/truefalse — answer is a string/number index) and multiselect
  // (answer is an array of indices). Historical bug: `Number(['0','2'])`
  // returns NaN, so multiselect submissions never moved the host's bar
  // chart — the host saw [0,0,0,0] forever even when participants picked
  // multiple options correctly.
  const counts = Array(numOptions).fill(0)
  for (const p of session.participants.values()) {
    const a = p.answers[questionIndex]
    if (a === undefined) continue
    const raw = a.answer
    const indices = Array.isArray(raw) ? raw : [raw]
    for (const v of indices) {
      const idx = Number(v)
      if (Number.isInteger(idx) && idx >= 0 && idx < numOptions) counts[idx]++
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
  return session.quizData.questions.reduce((sum, q) => {
    if (!isScoredQuestion(q)) return sum
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
    const timerSeconds = clampTimerSeconds(q?.timerSeconds, q?.id ?? '(no-id)')
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
  const isSequenceRankingQ = isSequenceRanking(q)
  const isNonScored = !isScoredQuestion(q)
  const correctAnswer = isNonScored
    ? null
    : (q.correctAnswers ?? q.correctAnswer ?? null)

  // Snapshot ranks BEFORE we apply ghost score updates so the deltas reflect
  // real player movement. previousRanks is whatever we saved last round.
  const previousRanks = session.previousRanks || new Map()

  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer,
    correctOrder: isSequenceRankingQ ? q.correctOrder ?? null : null,
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
  const top = buildLeaderboardSnapshot(session.participants, 5, { previousRanks, newRanks, questionIndex })
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

  // ─ % correct + ordinal speed rank (AhaSlides-style post-question context) ─
  // pctCorrect: share of players who answered this question correctly.
  // speedRank: 1-based position by answer speed among correct answers (fastest = 1).
  const correctTimes = []
  let answeredCount = 0
  for (const [key, p] of session.participants.entries()) {
    if (p.isGhost) continue
    const a = p.answers?.[questionIndex]
    if (!a) continue
    answeredCount++
    if (a.isCorrect === true && typeof a.timeMs === 'number' && a.timeMs >= 0) {
      correctTimes.push({ key, timeMs: a.timeMs })
    }
  }
  const correctCount = correctTimes.length
  const pctCorrect = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
  correctTimes.sort((a, b) => a.timeMs - b.timeMs)
  const speedRankMap = new Map()
  correctTimes.forEach((row, idx) => speedRankMap.set(row.key, idx + 1))

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
      pctCorrect,
      speedRank: (ans?.isCorrect === true && speedRankMap.has(socketId)) ? speedRankMap.get(socketId) : null,
      crossedTopFive: typeof toRank === 'number' && toRank <= 5
        && (typeof fromRank !== 'number' || fromRank > 5),
      ...(ans?.correctPositions !== undefined ? { correctPositions: ans.correctPositions } : {}),
      ...(ans?.totalPositions !== undefined ? { totalPositions: ans.totalPositions } : {}),
    }
    // Single emit per participant: rank rides inside personal_result (the
    // client reads data.rank). The separate my_rank_update emit doubled the
    // post-question event count — 200 emits for a 100-player room.
    io.to(socketId).emit('personal_result', personal)
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
    const isNonScored = !isScoredQuestion(q)
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
      const ic = q.type === 'ranking'
        ? p.answers[i].isCorrect === true
        : checkAnswer(q, p.answers[i].answer)
      const sure = p.answers[i].confidence === 'sure'
      if (ic) correct++
      if (sure && ic) sureCorrect++
      if (sure && !ic) sureWrong++
      if (!sure && ic) unsureCorrect++
      if (!sure && !ic) unsureWrong++
    }

    // Fill-in-the-blank: surface the typed answers (with correctness) + the
    // accepted-answer key. Matching: surface the left↔right answer key. Both
    // render in QuestionResultsView via the 'answerkey' / 'pairs' renderers.
    let extra = {}
    if (q.type === 'fillblank') {
      extra = {
        correctAnswerText: Array.isArray(q.blankAnswers) ? q.blankAnswers.join(' / ') : null,
        textResponses: answered.map(p => ({
          name: p.name || p.realName || 'Anonymous',
          archetype: p.archetype,
          answer: typeof p.answers[i].answer === 'string' ? p.answers[i].answer : String(p.answers[i].answer ?? ''),
          isCorrect: checkAnswer(q, p.answers[i].answer),
          submittedAt: p.answers[i].clientReportedTimeMs ?? Date.now(),
        })),
      }
    } else if (q.type === 'matching') {
      extra = { matchPairs: Array.isArray(q.matchPairs) ? q.matchPairs : [] }
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
      ...extra,
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
    let fullCorrectCount = 0

    // Check if this is a sequence ranking question
    const isSequenceRanking = q.correctOrder && Array.isArray(q.correctOrder) && q.correctOrder.length > 0
    const correctOrder = isSequenceRanking ? q.correctOrder : null

    for (const p of answered) {
      const order = p.answers[qi].answer
      if (!Array.isArray(order)) continue

      // For sequence ranking, check if all positions match the correct order
      if (isSequenceRanking && correctOrder) {
        if (order.length === correctOrder.length) {
          let allCorrect = true
          for (let pos = 0; pos < order.length; pos++) {
            if (String(order[pos]) !== String(correctOrder[pos])) {
              allCorrect = false
              break
            }
          }
          if (allCorrect) fullCorrectCount++
        }
      }

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

    const result = {
      rankingItems: items.map(o => typeof o === 'string' ? o : (o?.text ?? '')),
      rankingAverages,
      rankingFirstPlaceCounts: firstPlace,
      optionDistribution: null,
    }

    if (isSequenceRanking) {
      result.correctOrder = correctOrder.map(optIdx => {
        const item = items[Number(optIdx)]
        return typeof item === 'string' ? item : (item?.text ?? '')
      })
      result.fullCorrectCount = fullCorrectCount
    }

    return result
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
