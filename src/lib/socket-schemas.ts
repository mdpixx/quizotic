// SYNC: keep in sync with socket-schemas.mjs (the runtime copy used by server.mjs).
// This .ts file exists for type-checking and tests only.
import { z } from 'zod'
import type { Socket } from 'socket.io'

// ─── Participant payloads ───────────────────────────────────────────────────

export const JoinSessionSchema = z.object({
  gameCode: z.string().min(4).max(10),
  displayName: z.string().min(1).max(24).trim(),
  email: z.string().email().max(120).optional().or(z.literal('')),
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
  // NTP-corrected client tap moment, in server clock space (Date.now() + offset).
  // When present, used as the authoritative submit time instead of the
  // receivedAt - rtt/2 estimate.
  serverSubmittedAt: z.number().int().positive().optional(),
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
  participantId: z.string().uuid().optional(),
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

export const HostResumeSchema = z.object({
  gameCode: z.string().min(4).max(10),
  token: z.string().min(8).max(128),
})

// ─── Helper ────────────────────────────────────────────────────────────────

/**
 * Pure-result helper (for unit tests): validate a payload and return either
 * { success: true, data } or { success: false, error }. No socket side-effects.
 */
export function safeParseSocket<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

/**
 * Runtime helper (for server.mjs): validate, reply with an error envelope on
 * failure via callback or 'invalid_payload' event, and return parsed data or null.
 */
export function validateSocketPayload<T>(
  socket: Socket,
  schema: z.ZodType<T>,
  payload: unknown,
  callback: ((res: { success: false; error: string }) => void) | undefined,
  eventName: string,
): T | null {
  const parsed = safeParseSocket(schema, payload)
  if (parsed.success) return parsed.data
  console.warn(`[socket:${eventName}] rejected payload from ${socket.id}: ${parsed.error}`)
  if (typeof callback === 'function') {
    try { callback({ success: false, error: 'Invalid payload' }) } catch { /* noop */ }
  } else {
    socket.emit('invalid_payload', { event: eventName, error: 'Invalid payload' })
  }
  return null
}
