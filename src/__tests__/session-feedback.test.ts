import { describe, it, expect } from 'vitest'
import {
  SessionFeedbackSchema,
  normalizeSessionFeedback,
  isActionable,
  SESSION_FEEDBACK_FACES,
} from '../lib/session-feedback'

describe('SessionFeedbackSchema', () => {
  it('accepts a minimal one-tap participant rating', () => {
    const r = SessionFeedbackSchema.safeParse({ rating: 5, role: 'participant' })
    expect(r.success).toBe(true)
  })

  it('rejects out-of-range ratings', () => {
    expect(SessionFeedbackSchema.safeParse({ rating: 0, role: 'host' }).success).toBe(false)
    expect(SessionFeedbackSchema.safeParse({ rating: 6, role: 'host' }).success).toBe(false)
    expect(SessionFeedbackSchema.safeParse({ rating: 3.5, role: 'host' }).success).toBe(false)
  })

  it('rejects an unknown role', () => {
    expect(SessionFeedbackSchema.safeParse({ rating: 3, role: 'admin' }).success).toBe(false)
  })

  it('caps the number of reason chips', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `r${i}`)
    expect(SessionFeedbackSchema.safeParse({ rating: 2, role: 'participant', reasons: nine }).success).toBe(false)
  })
})

describe('normalizeSessionFeedback — privacy + cleaning', () => {
  it('drops a participant email even if one is sent (DPDP: anonymous)', () => {
    const n = normalizeSessionFeedback({
      rating: 4,
      role: 'participant',
      email: 'kid@example.com',
    })
    expect(n.email).toBeNull()
  })

  it('keeps a host email', () => {
    const n = normalizeSessionFeedback({ rating: 4, role: 'host', email: 'teacher@example.com' })
    expect(n.email).toBe('teacher@example.com')
  })

  it('trims a comment and nulls a blank one', () => {
    expect(normalizeSessionFeedback({ rating: 1, role: 'host', comment: '  too fast  ' }).comment).toBe('too fast')
    expect(normalizeSessionFeedback({ rating: 1, role: 'host', comment: '   ' }).comment).toBeNull()
  })

  it('filters empty reason chips', () => {
    const n = normalizeSessionFeedback({ rating: 2, role: 'participant', reasons: ['Too fast', '  ', 'Lag'] })
    expect(n.reasons).toEqual(['Too fast', 'Lag'])
  })
})

describe('isActionable', () => {
  it('is true for low scores or any comment', () => {
    expect(isActionable({ rating: 2, comment: null })).toBe(true)
    expect(isActionable({ rating: 5, comment: 'loved it' })).toBe(true)
  })
  it('is false for a silent high score', () => {
    expect(isActionable({ rating: 5, comment: null })).toBe(false)
  })
})

describe('SESSION_FEEDBACK_FACES', () => {
  it('indexes 1..5 to labels (0 unused)', () => {
    expect(SESSION_FEEDBACK_FACES[1]).toContain('Bad')
    expect(SESSION_FEEDBACK_FACES[5]).toContain('Loved')
    expect(SESSION_FEEDBACK_FACES).toHaveLength(6)
  })
})
