/**
 * Zod schemas for Socket.IO event payloads.
 * Used for server-side validation of untrusted client input.
 */
import { z } from 'zod'

// ─── Participant payloads ───────────────────────────────────────────────────

export const JoinSessionSchema = z.object({
  gameCode: z.string().min(4).max(10),
  name: z.string().min(1).max(24).trim(),
  email: z.string().email().max(120).optional().or(z.literal('')),
})

export const SubmitAnswerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  answer: z.union([
    z.string().max(2048),
    z.array(z.string()).max(10),  // multiselect
  ]),
  timeMs: z.number().int().min(0).max(600000),
  confidence: z.enum(['sure', 'unsure']).nullable().optional(),
})

export const SubmitDrawingSchema = z.object({
  gameCode: z.string().min(4).max(10),
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
      text: z.string().max(1000),
      options: z.array(z.union([z.string(), z.object({ text: z.string(), imageUrl: z.string().optional() })])).optional(),
      timerSeconds: z.number().int().min(5).max(120),
      points: z.number().int().min(0).max(5000),
      correctAnswer: z.string().optional(),
      correctAnswers: z.array(z.string()).optional(),
      explanation: z.string().max(2000).optional(),
    })).min(1).max(100),
  }),
  sessionMode: z.enum(['competitive', 'reflection', 'selfpaced', 'assessment']).optional(),
  anonymousMode: z.boolean().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().int().min(2).max(6).optional(),
  ghostSessionId: z.string().uuid().optional(),
})

export const OverrideAnswerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantName: z.string().min(1).max(24),
  questionIndex: z.number().int().min(0).max(99),
  isCorrect: z.boolean(),
})

// ─── Helper ────────────────────────────────────────────────────────────────

/**
 * Safely parse a socket payload with a Zod schema.
 * Returns { success, data } or { success: false, error }.
 * Used in server.mjs for input validation.
 */
export function safeParseSocket<T>(schema: z.ZodType<T>, payload: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error.issues.map(i => i.message).join(', ') }
}
