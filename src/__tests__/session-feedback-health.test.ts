import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordAccepted,
  recordPersistFailure,
  readSessionFeedbackHealth,
} from '@/lib/session-feedback-health'

// Regression guard for the failure mode that made an empty admin panel
// unreadable: /api/session-feedback swallowed database errors and still
// returned {ok:true}, so lost ratings looked exactly like no ratings.
// These counters are what let the panel tell the two apart.

function drain() {
  // The module holds process-wide state by design (server.mjs is persistent).
  // Read the baseline rather than resetting, so assertions are relative.
  return readSessionFeedbackHealth()
}

describe('session feedback ingest health', () => {
  let base: ReturnType<typeof readSessionFeedbackHealth>

  beforeEach(() => {
    base = drain()
  })

  it('counts accepted submissions', () => {
    recordAccepted()
    recordAccepted()
    expect(readSessionFeedbackHealth().accepted).toBe(base.accepted + 2)
  })

  it('counts persist failures separately from acceptances', () => {
    recordAccepted()
    recordPersistFailure(new Error('relation "SessionFeedback" does not exist'))
    const h = readSessionFeedbackHealth()
    expect(h.accepted).toBe(base.accepted + 1)
    expect(h.persistFailed).toBe(base.persistFailed + 1)
  })

  it('surfaces the most recent error message for triage', () => {
    recordPersistFailure(new Error('connection refused'))
    const h = readSessionFeedbackHealth()
    expect(h.lastError).toBe('connection refused')
    expect(h.lastErrorAt).toBeTruthy()
    expect(Number.isNaN(Date.parse(h.lastErrorAt as string))).toBe(false)
  })

  it('handles non-Error throwables without losing the signal', () => {
    recordPersistFailure('socket hang up')
    const h = readSessionFeedbackHealth()
    expect(h.persistFailed).toBe(base.persistFailed + 1)
    expect(h.lastError).toBe('socket hang up')
  })

  it('truncates oversized errors so the admin payload stays small', () => {
    recordPersistFailure(new Error('x'.repeat(1000)))
    expect(readSessionFeedbackHealth().lastError).toHaveLength(300)
  })

  it('returns a copy so callers cannot mutate module state', () => {
    const snapshot = readSessionFeedbackHealth()
    snapshot.persistFailed = 9999
    expect(readSessionFeedbackHealth().persistFailed).not.toBe(9999)
  })
})
