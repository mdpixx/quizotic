// SYNC: keep in sync with socket-schemas.ts
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
  timeMs: z.number().int().min(0).max(600000),
  confidence: z.enum(['sure', 'unsure']).nullable().optional(),
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
  sessionMode: z.enum(['competitive', 'reflection', 'selfpaced', 'assessment']).optional(),
  anonymousMode: z.boolean().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().int().min(2).max(6).optional(),
  ghostSessionId: z.string().optional(),
})

export const GameCodeOnlySchema = z.object({
  gameCode: z.string().min(4).max(10),
})

export const OverrideAnswerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantName: z.string().min(1).max(24),
  questionIndex: z.number().int().min(0).max(99),
  isCorrect: z.boolean(),
})

export const PresenterSlideSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
})

export const PresenterResponseSchema = z.object({
  gameCode: z.string().min(4).max(10),
  slideIndex: z.number().int().min(0).max(500),
  response: z.any(),
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
