// Pure validation + normalization for post-session smiley feedback. Kept
// framework-free (no prisma / next imports) so it unit-tests cleanly and can be
// shared by the API route and any server-side roll-up.

import { z } from 'zod'

export const SESSION_FEEDBACK_FACES = [
  '', // 0 unused — rating is 1..5
  '😞 Bad',
  '🙁 Meh',
  '😐 Okay',
  '🙂 Good',
  '😄 Loved it',
] as const

export const SessionFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  role: z.enum(['host', 'participant']),
  reasons: z.array(z.string().max(40)).max(8).optional(),
  comment: z.string().max(2000).optional().nullable().or(z.literal('')),
  // Host-only optional reply address; stripped for participants (kept anonymous).
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  sessionCode: z.string().max(24).optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
})

export type SessionFeedbackInput = z.infer<typeof SessionFeedbackSchema>

export interface NormalizedSessionFeedback {
  rating: number
  role: 'host' | 'participant'
  reasons: string[]
  comment: string | null
  /** Non-null only for hosts — participants are always stored anonymously. */
  email: string | null
  sessionCode: string | null
  sessionId: string | null
}

/**
 * Trim/clean a validated payload into what we persist. Enforces the privacy
 * rule at the boundary: a participant email is dropped even if one is sent.
 */
export function normalizeSessionFeedback(input: SessionFeedbackInput): NormalizedSessionFeedback {
  const comment = input.comment && input.comment.trim().length > 0 ? input.comment.trim() : null
  const email =
    input.role === 'host' && input.email && input.email.trim().length > 0 ? input.email.trim() : null
  const reasons = (input.reasons ?? []).map(r => r.trim()).filter(r => r.length > 0)
  return {
    rating: input.rating,
    role: input.role,
    reasons,
    comment,
    email,
    sessionCode: input.sessionCode?.trim() || null,
    sessionId: input.sessionId?.trim() || null,
  }
}

/** Whether a submission warrants an ops email (actionable signal only). */
export function isActionable(n: Pick<NormalizedSessionFeedback, 'rating' | 'comment'>): boolean {
  return !!n.comment || n.rating <= 2
}
