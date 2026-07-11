// Pure session-state helpers — extracted from server.mjs so they can be
// exercised in unit tests without booting Next.js / Socket.io.
//
// A session is the in-memory record on the server.mjs `sessions` Map. Only
// the fields these helpers touch need to be present on the input object:
//   - participants:           Map<socketId, participantRecord>
//   - participantsById:       Map<participantId, participantRecord> (optional)
//   - disconnectedParticipants: Map<key, { socketId, participant, gameCode }> (optional)
//   - _pendingPersist:        Array of buffered answer payloads (optional)
//   - _dbInsertPromise:       Promise<dbId> in flight (optional)
//   - dbId:                   string once the DB row is created (optional)

// Count of currently CONNECTED participants. Excludes ghosts (synthetic
// leaderboard entries from past sessions, keyed by `ghost::*`) and any
// participant whose socket dropped (within disconnect grace).
export function getConnectedCount(session) {
  if (!session?.participants) return 0
  let n = 0
  for (const [sid, p] of session.participants.entries()) {
    if (typeof sid === 'string' && sid.startsWith('ghost::')) continue
    if (p?.disconnectedAt) continue
    n++
  }
  return n
}

// Compact snapshot for the periodic `session_state` broadcast. Includes
// disconnected participants (still inside grace) so the host UI can render
// them as "offline" without losing identity.
export function buildSessionStateSnapshot(session) {
  const active = []
  const disconnected = []
  if (!session?.participants) {
    return { active, disconnected, connectedCount: 0, totalCount: 0, questionIndex: null }
  }
  const qi = session.currentQuestionIndex ?? null
  for (const [sid, p] of session.participants.entries()) {
    if (typeof sid === 'string' && sid.startsWith('ghost::')) continue
    if (!p) continue
    const entry = {
      participantId: p.participantId || null,
      name: p.name || p.realName || 'Anonymous',
      archetype: p.archetype || null,
      team: p.team || null,
      score: p.score || 0,
      // Whether this participant has answered the CURRENT question — lets a
      // reloading host rebuild the live roster panel's submitted ticks.
      answeredCurrent: qi != null && p.answers?.[qi] !== undefined,
    }
    if (p.disconnectedAt) {
      disconnected.push({ ...entry, disconnectedAt: p.disconnectedAt })
    } else {
      active.push(entry)
    }
  }
  return {
    active,
    disconnected,
    connectedCount: active.length,
    totalCount: active.length + disconnected.length,
    // Which question the answeredCurrent flags refer to — lets the host
    // ignore a snapshot that was built just before a question transition.
    questionIndex: qi,
  }
}

// Returns the matching disconnected entry (and key) from the session's
// disconnected map, preferring participantId match over name match. Used by
// both the rejoin path and the answer-rescue path to recover identity even
// when the display name has drifted.
export function findDisconnectedEntry(session, { participantId, displayName }) {
  if (!session?.disconnectedParticipants) return null
  if (participantId) {
    for (const [key, entry] of session.disconnectedParticipants.entries()) {
      if (entry?.participant?.participantId === participantId) {
        return { key, entry }
      }
    }
  }
  if (displayName) {
    const key = String(displayName).toLowerCase()
    const entry = session.disconnectedParticipants.get(key)
    if (entry) return { key, entry }
  }
  return null
}

// Restore a participant from the disconnected map onto the new socket id.
// Mutates session in place and returns the recovered participant. Pure of
// any DB / network side effects so tests can assert state transitions.
export function reconnectFromDisconnected(session, { key, entry, newSocketId, participantId }) {
  const recovered = entry.participant
  session.participants.delete(entry.socketId)
  delete recovered.disconnectedAt
  delete recovered.disconnectedSocketId
  recovered.socketId = newSocketId
  session.participants.set(newSocketId, recovered)
  session.disconnectedParticipants.delete(key)
  if (participantId && !recovered.participantId) {
    recovered.participantId = participantId
  }
  if (recovered.participantId) {
    if (!session.participantsById) session.participantsById = new Map()
    session.participantsById.set(recovered.participantId, recovered)
  }
  return recovered
}

// Display-true remaining time for pause/resume broadcasts. The server's
// internal remaining (questionEndsAt - now) includes the +500ms paint-grace
// from scheduleQuestionAutoEnd and, when paused during the 3-2-1 get-ready
// window, leftover intro time. Clients never display either — sending the
// raw value inflated every timer by up to a digit per pause/resume cycle.
// Strips the grace and clamps to the question timer (+ any host-granted
// extension, which can legitimately push remaining past the base timer).
// Returns null when no snapshot is available.
export function displayRemainingMs(rawMs, timerSeconds, extensionMs = 0) {
  if (typeof rawMs !== 'number' || !Number.isFinite(rawMs)) return null
  const capMs = Math.max(0, (Number(timerSeconds) || 0) * 1000) + Math.max(0, Number(extensionMs) || 0)
  return Math.min(capMs, Math.max(0, rawMs - 500))
}

// Answer-window precondition for submit_answer. Returns a reason string, or
// null when the submission window is fully open:
//   - 'stale_question'  REJECT: the client stamped a different questionIndex
//                       than the one currently live — a delayed/outbox-flushed
//                       packet must not be booked (and scored) against the
//                       wrong question. Old clients omit the field → no check.
//   - 'not_started'     REJECT: the packet arrived before the 3-2-1 countdown
//                       finished — the client disables input until startAt,
//                       so an earlier packet is a crafted client that would
//                       otherwise score at serverTimeMs=0 (max speed bonus).
//   - 'question_ended'  FORCE-LATE, not reject: the reveal already fired
//                       (timer, all-answered, or manual end), so the answer
//                       must not move the standings — the caller records it
//                       through the late path (0 points, no streak,
//                       isCorrect=false). Rejecting outright would silently
//                       drop honest low-connectivity stragglers and desync
//                       the host's answered counter (the 2026-05 bug class).
export function answerWindowRejection(session, { clientQuestionIndex, receivedAt }) {
  if (typeof clientQuestionIndex === 'number' && clientQuestionIndex !== session.currentQuestionIndex) {
    return 'stale_question'
  }
  if (session.questionEnded) return 'question_ended'
  if (session.questionStartedAt && receivedAt < session.questionStartedAt) return 'not_started'
  return null
}

// Flush any answers that arrived before the session DB row landed. Caller
// passes the insertFn so this stays decoupled from pg / network code.
export function flushPendingPersist(session, sessionDbId, insertFn) {
  if (!session?._pendingPersist?.length || !sessionDbId || typeof insertFn !== 'function') return 0
  const pending = session._pendingPersist
  session._pendingPersist = []
  for (const p of pending) insertFn(sessionDbId, p)
  return pending.length
}

// ─── Session persistence (serialize ⇆ deserialize) ─────────────────────────
// Live sessions live in the in-memory `sessions` Map, so a process restart
// (every Railway redeploy, or a crash) wipes them and participants hit
// "Game not found". These helpers turn a session into a JSON-safe object for
// a durable store (Redis) and back, so a restarted instance can rehydrate the
// Map and let hosts/participants auto-reconnect. Pure — no I/O — so the store
// module and unit tests can exercise the round-trip without booting the server.

// Runtime handles and ephemeral socket bindings that must never be persisted.
// Timers are re-armed on boot; socket bindings are re-established when the host
// (host_resume) and participants (participantId) reconnect. participants are
// serialized separately (below); participantsById / disconnectedParticipants
// are rebuilt from participants on load so shared object references stay intact.
const NON_PERSISTED_SESSION_FIELDS = new Set([
  'endTimer',
  '_stateBroadcastTimer',
  '_dbInsertPromise',
  'hostSocketId',
  'hostSocketIds',
  'participants',
  'participantsById',
  'disconnectedParticipants',
])

function encodeValue(v) {
  if (v instanceof Map) return { __t: 'Map', v: [...v.entries()] }
  if (v instanceof Set) return { __t: 'Set', v: [...v] }
  return v
}

function decodeValue(v) {
  if (v && typeof v === 'object' && v.__t === 'Map') return new Map(v.v)
  if (v && typeof v === 'object' && v.__t === 'Set') return new Set(v.v)
  return v
}

export function serializeParticipant(p) {
  const out = { ...p }
  if (out.joinedAt instanceof Date) out.joinedAt = out.joinedAt.toISOString()
  return out
}

export function deserializeParticipant(raw) {
  const p = { ...raw }
  if (typeof p.joinedAt === 'string') {
    const d = new Date(p.joinedAt)
    if (!Number.isNaN(d.getTime())) p.joinedAt = d
  }
  return p
}

// Turn a live session into a JSON-safe plain object. Maps/Sets are tagged so
// they round-trip; participants are stored as [key, record] entries to preserve
// their map key (the old socket id for real players, `ghost::*` for ghosts).
export function serializeSession(session) {
  if (!session) return null
  const out = {}
  for (const [k, v] of Object.entries(session)) {
    if (NON_PERSISTED_SESSION_FIELDS.has(k)) continue
    if (typeof v === 'function') continue
    out[k] = encodeValue(v)
  }
  out.participants = session.participants
    ? [...session.participants.entries()].map(([key, p]) => [key, serializeParticipant(p)])
    : []
  return out
}

// Rebuild a live session object from its serialized form. The old process's
// sockets are gone, so real participants are marked offline (disconnectedAt)
// until they reconnect via participantId — getConnectedCount honours this so
// the host's roster is accurate on rehydration. Ephemeral bindings and timers
// are reset; the boot rehydrator restarts the state-broadcast loop.
export function deserializeSession(obj) {
  if (!obj) return null
  const session = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'participants') continue
    session[k] = decodeValue(v)
  }
  const participants = new Map()
  const participantsById = new Map()
  for (const [key, raw] of obj.participants || []) {
    const p = deserializeParticipant(raw)
    const isGhost = String(key).startsWith('ghost::')
    if (!isGhost && !p.disconnectedAt) p.disconnectedAt = Date.now()
    participants.set(key, p)
    if (p.participantId && !isGhost) participantsById.set(p.participantId, p)
  }
  session.participants = participants
  session.participantsById = participantsById
  session.hostSocketId = null
  session.hostSocketIds = new Set()
  session.endTimer = null
  session._stateBroadcastTimer = null
  if (!(session.disconnectedParticipants instanceof Map)) {
    session.disconnectedParticipants = new Map()
  }
  return session
}
