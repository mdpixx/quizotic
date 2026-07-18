// The ONLY socket schema module — used by server.mjs (runtime) and the
// vitest suite. (A hand-synced .ts mirror existed until 2026-07; it drifted
// and was removed — do not recreate it.)
// Pure ESM JS — imported by server.mjs (cannot import TypeScript).
import { z } from 'zod'

// ─── Participant payloads ───────────────────────────────────────────────────

export const JoinSessionSchema = z.object({
  gameCode: z.string().min(4).max(10),
  displayName: z.string().min(1).max(24).trim(),
  email: z.string().email().max(120).optional().or(z.literal('')),
  // participantId — client-generated UUID stored in localStorage. Optional for
  // back-compat; when present, server matches it before falling back to
  // name-based reconnect lookup. Survives socket drops, tab close, even
  // browser restarts (as long as localStorage is intact).
  participantId: z.string().uuid().optional(),
})

export const SubmitAnswerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantId: z.string().uuid().optional(),
  answer: z.union([
    z.string().max(2048),
    z.number(),
    z.array(z.string()).max(10),
    z.array(z.number()).max(10),
  ]),
  // Client-reported tap-to-submit duration. The server clamps this to [0, timerMs]
  // anyway via serverTimeMs, so a brief negative value (e.g. tap during the 3-2-1
  // countdown when answerTimeRef is anchored to a future startAt) must not silently
  // fail validation. Bounded loosely against bogus values.
  timeMs: z.number().int().min(-10000).max(600000),
  confidence: z.enum(['sure', 'unsure']).nullable().optional(),
  // Optional NTP-corrected client tap moment, in server clock space.
  // When provided, the server uses this as the authoritative submit time
  // instead of receivedAt - rtt/2. Bounded loosely against bogus values.
  // NOT `.int()` — `getServerNow()` returns `Date.now() + offsetMs` where
  // offsetMs is a fractional average from clock-sync, so the value is
  // naturally a float. Requiring int silently rejected every submission.
  serverSubmittedAt: z.number().positive().optional(),
  // Which question the participant answered. Optional for back-compat with
  // clients that predate the field; when present, the server rejects a
  // mismatch (stale_question) instead of booking the answer against the
  // current question.
  questionIndex: z.number().int().min(0).max(999).optional(),
})

export const SubmitDrawingSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantId: z.string().uuid().optional(),
  dataUrl: z.string().max(102400), // 100 KB max
})

// ─── Host payloads ──────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  quizData: z.object({
    id: z.string().optional(),
    title: z.string().max(200),
    questions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      text: z.string().max(2000),
      options: z.array(z.union([z.string(), z.object({ text: z.string(), imageUrl: z.string().optional() }).passthrough()])).optional(),
      timerSeconds: z.number().int().min(5).max(120).optional(),
      points: z.number().int().min(0).max(5000).optional(),
      correctAnswer: z.union([z.string(), z.number()]).optional(),
      correctAnswers: z.array(z.string()).optional(),
      explanation: z.string().max(4000).optional(),
    }).passthrough()).min(1).max(100),
  }).passthrough(),
  sessionMode: z.enum(['competitive', 'reflection', 'selfpaced', 'assessment', 'accuracy']).optional(),
  anonymousMode: z.boolean().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().int().min(2).max(6).optional(),
  ghostSessionId: z.string().optional(),
  // 'shared-screen' = Kahoot-style classroom mode. Phones show only the four
  // colour tap zones; the host display shows question + options. Falls back
  // to 'full-device' for non-MCQ types automatically.
  displayMode: z.enum(['full-device', 'shared-screen']).optional(),
})

export const GameCodeOnlySchema = z.object({
  gameCode: z.string().min(4).max(10),
})

export const PresenterSlideSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
})

export const PresenterResponseSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
  response: z.any(),
  // Optional — when present, server can rebind the participant on a fresh
  // socket so a presenter response submitted right after a network blip
  // isn't dropped as `unknown_participant`.
  participantId: z.string().uuid().optional(),
})

export const BrainstormUpvoteSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
  ideaId: z.string().min(1).max(120),
  participantId: z.string().uuid().optional(),
})

// Host spins the Wheel of Names. The server is authoritative for the winner
// (never the client) so every participant phone reveals the same result.
// `durationMs` is honored so the spin duration is consistent across screens.
export const PresenterSpinWheelSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
  durationMs: z.number().int().min(800).max(12000).optional(),
})

export const CreatePresenterSessionSchema = z.object({
  presentationData: z.object({
    id: z.string().optional(),
    title: z.string().max(200),
    slides: z.array(z.any()).min(1).max(500),
  }).passthrough(),
})

export const JoinFollowupSchema = z.object({
  code: z.string().min(4).max(12),
})

export const PingTimeSchema = z.object({
  clientTime: z.number(),
})

// Host re-attach: when a host's tab reconnects after a network blip or
// browser refresh, this lets them reclaim the host slot of an existing
// session without losing the live game. Token is server-issued at
// create_session time and stored in sessionStorage on the host client.
export const HostResumeSchema = z.object({
  gameCode: z.string().min(4).max(10),
  token: z.string().min(8).max(128),
})

// Timer control mid-question: extend adds `seconds` (default 15) to the
// running countdown; restart resets it to the question's full duration.
export const AdjustTimerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  action: z.enum(['extend', 'restart']),
  seconds: z.number().int().min(5).max(60).optional(),
})

// Jump to an arbitrary not-yet-played question (question navigator).
export const GotoQuestionSchema = z.object({
  gameCode: z.string().min(4).max(10),
  index: z.number().int().min(0).max(99),
})

// Remove a disruptive participant and block their participantId from rejoining.
export const KickParticipantSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantId: z.string().uuid(),
})

// Flip anonymous (archetype-only) display names on or off mid-session.
export const SetAnonymousModeSchema = z.object({
  gameCode: z.string().min(4).max(10),
  anonymous: z.boolean(),
})

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Pure-result helper (for unit tests): validate a payload and return either
 * { success: true, data } or { success: false, error }. No socket side-effects.
 *
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} payload
 * @returns {{ success: true, data: T } | { success: false, error: string }}
 */
export function safeParseSocket(schema, payload) {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

/**
 * Runtime helper: validate a socket payload against a schema.
 * Invokes callback (if provided) with an error envelope on failure, or emits
 * a generic 'invalid_payload' event back to the socket. Returns parsed data
 * on success, or null on failure (caller should early-return).
 *
 * @template T
 * @param {import('socket.io').Socket} socket
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} payload
 * @param {((res: { success: false; error: string }) => void) | undefined} callback
 * @param {string} eventName — for logging
 * @returns {T | null}
 */
export function validateSocketPayload(socket, schema, payload, callback, eventName) {
  const parsed = safeParseSocket(schema, payload)
  if (parsed.success) return parsed.data
  console.warn(`[socket:${eventName}] rejected payload from ${socket.id}: ${parsed.error}`)
  if (typeof callback === 'function') {
    try { callback({ success: false, error: 'Invalid payload' }) } catch {}
  } else {
    socket.emit('invalid_payload', { event: eventName, error: 'Invalid payload' })
  }
  return null
}
