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
    return { active, disconnected, connectedCount: 0, totalCount: 0 }
  }
  for (const [sid, p] of session.participants.entries()) {
    if (typeof sid === 'string' && sid.startsWith('ghost::')) continue
    if (!p) continue
    const entry = {
      participantId: p.participantId || null,
      name: p.name || p.realName || 'Anonymous',
      archetype: p.archetype || null,
      team: p.team || null,
      score: p.score || 0,
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

// Flush any answers that arrived before the session DB row landed. Caller
// passes the insertFn so this stays decoupled from pg / network code.
export function flushPendingPersist(session, sessionDbId, insertFn) {
  if (!session?._pendingPersist?.length || !sessionDbId || typeof insertFn !== 'function') return 0
  const pending = session._pendingPersist
  session._pendingPersist = []
  for (const p of pending) insertFn(sessionDbId, p)
  return pending.length
}
