// Ingest health for the post-session smiley.
//
// WHY THIS EXISTS: /api/session-feedback deliberately never fails the request
// when the database write throws — a rating is not worth showing the user an
// error over. But the original code swallowed that failure into a console.warn
// and returned {ok:true}, so a broken write looked identical to "nobody rated
// anything": PostHog logged the submit, the participant saw "Thanks!", and the
// admin panel stayed empty with no way to tell the difference.
//
// This records accepted-vs-persisted counts in memory so the admin panel can
// show "N accepted, M failed to save" instead of a silent zero. server.mjs is a
// persistent Node process (Socket.io requires it), so module state survives
// between requests — the same assumption the route's rate limiter already makes.
// It resets on deploy, which is fine: it answers "is the pipe broken right
// now", while the database answers "what have we collected".

export interface SessionFeedbackHealth {
  /** Submissions that passed validation since this process started. */
  accepted: number
  /** Of those, how many failed to persist. Any non-zero value is a bug. */
  persistFailed: number
  /** Message from the most recent persist failure, for triage. */
  lastError: string | null
  /** When that failure happened. */
  lastErrorAt: string | null
}

const health: SessionFeedbackHealth = {
  accepted: 0,
  persistFailed: 0,
  lastError: null,
  lastErrorAt: null,
}

export function recordAccepted(): void {
  health.accepted += 1
}

export function recordPersistFailure(err: unknown): void {
  health.persistFailed += 1
  health.lastError = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300)
  health.lastErrorAt = new Date().toISOString()
}

export function readSessionFeedbackHealth(): SessionFeedbackHealth {
  return { ...health }
}
