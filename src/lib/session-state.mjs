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

// ─── O(1) answer aggregation (Workstream A) ─────────────────────────────────
// submit_answer used to recompute countAnswers + countAnswersByOption from
// scratch on every accepted answer — O(N²) work across a burst of N answers.
// These helpers maintain per-question counters that mutate in O(1) on accept
// and read in O(1) on emit. The Map is keyed by questionIndex so a host
// flipping back via goto_question still sees correct historical tallies.
//
// Semantics intentionally mirror countAnswers / countAnswersByOption exactly:
//   - answerCounts[qi] = number of participants with an answer recorded for qi
//     (includes late + disconnected-within-grace — the host counter must stay
//     honest so the roster count matches the audit trail).
//   - answerOptionCounts[qi] = per-option bucket counts for the host bar chart.

// Lazily create the counter maps on a session. Idempotent — safe to call on
// every join / question advance.
export function ensureAnswerCounters(session) {
  if (!session) return
  if (!(session.answerCounts instanceof Map)) session.answerCounts = new Map()
  if (!(session.answerOptionCounts instanceof Map)) session.answerOptionCounts = new Map()
}

// Reset the tallies for a single question. Call from presentQuestion so a
// re-asked (goto_question) question starts from zero. `numOptions` lets us
// pre-size the per-option bucket array; we grow it on accept if the answer
// lands out of range (defensive — sanitizeQuestion normally fixes this first).
export function resetAnswerCountersForQuestion(session, questionIndex, numOptions = 0) {
  if (!session) return
  ensureAnswerCounters(session)
  session.answerCounts.set(questionIndex, 0)
  const n = Math.max(0, Number(numOptions) || 0)
  session.answerOptionCounts.set(questionIndex, Array.from({ length: n }, () => 0))
}

// Record one accepted answer against the counters. `answer` is the raw stored
// answer (string/number index for single-choice, array for multiselect /
// ranking). Mirrors the Number(v)/Array.isArray branch in countAnswersByOption
// so bucket totals match exactly. No-op if counters aren't initialized for qi
// (defensive — late answers for an already-advanced question are recorded on
// the participant but don't inflate a live counter).
export function bumpAnswerCounters(session, questionIndex, answer, numOptions = 0) {
  if (!session) return 0
  ensureAnswerCounters(session)
  const cur = session.answerCounts.get(questionIndex) ?? 0
  session.answerCounts.set(questionIndex, cur + 1)
  let buckets = session.answerOptionCounts.get(questionIndex)
  const need = Math.max(Number(numOptions) || 0, 0)
  if (!buckets || buckets.length < need) {
    const next = buckets ? [...buckets] : []
    while (next.length < need) next.push(0)
    buckets = next
    session.answerOptionCounts.set(questionIndex, buckets)
  }
  if (!buckets.length) return cur + 1
  const indices = Array.isArray(answer) ? answer : [answer]
  for (const v of indices) {
    const idx = Number(v)
    if (Number.isInteger(idx) && idx >= 0 && idx < buckets.length) buckets[idx]++
  }
  return cur + 1
}

// O(1) read of how many participants answered qi. Falls back to -1 (sentinel
// for "unknown") so callers can distinguish "0 answers" from "no counter yet".
export function getAnswerCount(session, questionIndex) {
  const n = session?.answerCounts?.get(questionIndex)
  return typeof n === 'number' ? n : -1
}

// O(1) read of per-option bucket counts for qi. Returns null if no counter is
// initialized (caller may fall back to the O(n) recompute or just emit zeros).
export function getAnswerOptionCounts(session, questionIndex) {
  const buckets = session?.answerOptionCounts?.get(questionIndex)
  return Array.isArray(buckets) ? buckets : null
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

// ─── Disconnect-map keying ───────────────────────────────────────────────────
// The disconnected map used to be keyed by `name.toLowerCase()`. In a classroom
// that is not a key — it is a collision waiting to happen. Two students named
// "Rahul" produced two distinct failures:
//
//   1. Overwrite. When both dropped, the second `.set('rahul', …)` silently
//      evicted the first, so student A could never be recovered.
//   2. Score transplant. When A dropped and a *different* Rahul joined fresh,
//      the name lookup matched A's entry and B was restored AS A — inheriting
//      A's score, answers and attendee row. Silent, and invisible in the report.
//
// Participants have carried a durable `participantId` since the localStorage
// identity work, so key on that and keep the name key only for legacy entries
// that predate it (or were restored from an older serialized session).
export function disconnectKeyFor(participant) {
  const pid = participant?.participantId
  if (pid) return `pid:${pid}`
  const name = String(participant?.realName || participant?.name || '').toLowerCase()
  return name ? `name:${name}` : ''
}

// Every key form this session may hold for a participant, newest first. Used on
// reconnect/kick to clear stale entries written before a participantId existed.
function candidateKeys(participant) {
  const keys = []
  const pid = participant?.participantId
  if (pid) keys.push(`pid:${pid}`)
  const name = String(participant?.realName || participant?.name || '').toLowerCase()
  if (name) {
    keys.push(`name:${name}`)
    keys.push(name) // pre-namespace legacy key
  }
  return keys
}

// Park a participant in the disconnect grace map under a collision-free key.
export function rememberDisconnected(session, { participant, socketId, gameCode }) {
  if (!session) return null
  if (!(session.disconnectedParticipants instanceof Map)) {
    session.disconnectedParticipants = new Map()
  }
  const key = disconnectKeyFor(participant)
  if (!key) return null
  session.disconnectedParticipants.set(key, { socketId, participant, gameCode })
  return key
}

// Drop every disconnect-map entry belonging to this participant, across all key
// forms. Safe to call when the participant was never in the map.
export function forgetDisconnected(session, participant) {
  const map = session?.disconnectedParticipants
  if (!(map instanceof Map)) return
  for (const key of candidateKeys(participant)) {
    const entry = map.get(key)
    if (!entry) continue
    // A legacy name key may belong to a *different* participant who happens to
    // share the name — only delete when the identity actually matches.
    const pid = participant?.participantId
    const entryPid = entry.participant?.participantId
    if (pid && entryPid && pid !== entryPid) continue
    map.delete(key)
  }
}

// Returns the matching disconnected entry (and key) from the session's
// disconnected map, preferring participantId match over name match. Used by
// both the rejoin path and the answer-rescue path to recover identity even
// when the display name has drifted.
//
// The name fallback is deliberately conservative: it matches ONLY when the name
// identifies exactly one disconnected participant. If two people joined as
// "Rahul", a name is not evidence of identity, so we return null and let the
// caller treat this as a fresh join. Losing a reconnect (participant keeps
// their score from zero) is recoverable; transplanting one student's score onto
// another is not.
export function findDisconnectedEntry(session, { participantId, displayName }) {
  if (!session?.disconnectedParticipants) return null
  if (participantId) {
    for (const [key, entry] of session.disconnectedParticipants.entries()) {
      if (entry?.participant?.participantId === participantId) {
        return { key, entry }
      }
    }
    // The caller presented a durable id and it did not match anything here.
    // Falling through to a name match would re-open the transplant bug for the
    // exact population most likely to hit it (same name, different device).
    return null
  }
  if (displayName) {
    const wanted = String(displayName).trim().toLowerCase()
    if (!wanted) return null
    const matches = []
    for (const [key, entry] of session.disconnectedParticipants.entries()) {
      const entryName = String(
        entry?.participant?.realName || entry?.participant?.name || '',
      ).trim().toLowerCase()
      if (entryName && entryName === wanted) matches.push({ key, entry })
    }
    if (matches.length === 1) return matches[0]
  }
  return null
}

// Two students genuinely named "Rahul" must both be able to play, so a name
// collision is never a hard block. Instead the second one is stored as
// "Rahul (2)" — enough for the host to tell two rows apart in the report and in
// the live roster, without adding friction to the 60-second window when a whole
// classroom is trying to get in.
//
// Compares against realName (the typed name) rather than name, because in
// anonymous mode `name` holds the archetype and every comparison would miss.
// Returns the original string when there is no collision.
export function disambiguateName(session, name, { excludeParticipantId } = {}) {
  const base = String(name ?? '').trim()
  if (!base) return base
  const taken = new Set()
  const collect = participant => {
    if (!participant) return
    if (excludeParticipantId && participant.participantId === excludeParticipantId) return
    const value = String(participant.realName || participant.name || '').trim().toLowerCase()
    if (value) taken.add(value)
  }
  // participantsById is the durable roster (survives disconnect grace expiry),
  // so it is the right set to check — session.participants misses anyone who
  // dropped and has not yet returned.
  if (session?.participantsById instanceof Map) {
    for (const participant of session.participantsById.values()) collect(participant)
  }
  if (session?.participants instanceof Map) {
    for (const participant of session.participants.values()) collect(participant)
  }

  if (!taken.has(base.toLowerCase())) return base
  // Cap at 99 so a scripted flood can't spin here; past that we fall back to
  // the plain name and accept the duplicate.
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return base
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
  // O(1) answer aggregation counters (Workstream A) and the coalesced
  // answer_received flush state (Workstream C). Both are rebuilt lazily on
  // the next mutation after rehydrate — persisting them would ship stale
  // counts for a question that may have advanced during the redeploy. The
  // server-side countAnswers/countAnswersByOption wrappers fall back to the
  // O(n) scan (getAnswerCount returns -1) until the next resetAnswerCounters
  // call, so correctness is preserved across reboots.
  'answerCounts',
  'answerOptionCounts',
  '_answerReceivedPending',
  '_answerReceivedTimer',
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
