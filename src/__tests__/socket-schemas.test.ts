import { describe, it, expect } from 'vitest'
import { SubmitAnswerSchema, JoinSessionSchema, CreateSessionSchema, safeParseSocket } from '../lib/socket-schemas'

describe('JoinSessionSchema', () => {
  it('accepts valid join payload', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', name: 'Alice' })
    expect(r.success).toBe(true)
  })

  it('rejects name over 24 chars', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', name: 'A'.repeat(25) })
    expect(r.success).toBe(false)
  })

  it('rejects empty name', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', name: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid email', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', name: 'Bob', email: 'bob@example.com' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = JoinSessionSchema.safeParse({ gameCode: 'ABCD12', name: 'Bob', email: 'not-an-email' })
    expect(r.success).toBe(false)
  })
})

describe('SubmitAnswerSchema', () => {
  it('accepts single-answer MCQ', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '2', timeMs: 5000, confidence: null })
    expect(r.success).toBe(true)
  })

  it('accepts multiselect array', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: ['0', '2'], timeMs: 5000 })
    expect(r.success).toBe(true)
  })

  it('rejects negative timeMs', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: '0', timeMs: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects excessively long answer string', () => {
    const r = SubmitAnswerSchema.safeParse({ gameCode: 'ABCD12', answer: 'x'.repeat(3000), timeMs: 0 })
    expect(r.success).toBe(false)
  })
})

describe('safeParseSocket helper', () => {
  it('returns success for valid payload', () => {
    const result = safeParseSocket(JoinSessionSchema, { gameCode: 'ABC123', name: 'Tester' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Tester')
  })

  it('returns error string for invalid payload', () => {
    const result = safeParseSocket(JoinSessionSchema, { gameCode: 'AB', name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(typeof result.error).toBe('string')
  })
})
