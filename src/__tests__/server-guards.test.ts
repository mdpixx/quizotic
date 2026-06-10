import { describe, it, expect, beforeEach } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module without type declarations
import { allowRate, generateGameCode, sanitizeDisplayText, _clearRateBuckets } from '../lib/server-guards.mjs'

describe('generateGameCode', () => {
  it('always returns a 6-digit numeric string', () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateGameCode()
      expect(code).toMatch(/^\d{6}$/)
      const n = Number(code)
      expect(n).toBeGreaterThanOrEqual(100000)
      expect(n).toBeLessThanOrEqual(999999)
    }
  })

  it('produces varied codes (sanity check on randomness)', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateGameCode()))
    // 500 draws from 900k values should be almost entirely unique.
    expect(seen.size).toBeGreaterThan(450)
  })
})

describe('allowRate', () => {
  beforeEach(() => _clearRateBuckets())

  it('allows calls up to the limit and blocks beyond', () => {
    const t0 = 1_000_000
    expect(allowRate('k1', 3, 60_000, t0)).toBe(true)
    expect(allowRate('k1', 3, 60_000, t0 + 1)).toBe(true)
    expect(allowRate('k1', 3, 60_000, t0 + 2)).toBe(true)
    expect(allowRate('k1', 3, 60_000, t0 + 3)).toBe(false)
    expect(allowRate('k1', 3, 60_000, t0 + 4)).toBe(false)
  })

  it('resets after the window elapses', () => {
    const t0 = 1_000_000
    expect(allowRate('k2', 1, 60_000, t0)).toBe(true)
    expect(allowRate('k2', 1, 60_000, t0 + 100)).toBe(false)
    expect(allowRate('k2', 1, 60_000, t0 + 60_000)).toBe(true)
  })

  it('tracks buckets independently per key', () => {
    const t0 = 1_000_000
    expect(allowRate('a', 1, 60_000, t0)).toBe(true)
    expect(allowRate('b', 1, 60_000, t0)).toBe(true)
    expect(allowRate('a', 1, 60_000, t0 + 1)).toBe(false)
    expect(allowRate('b', 1, 60_000, t0 + 1)).toBe(false)
  })
})

describe('sanitizeDisplayText', () => {
  it('strips angle brackets (HTML injection vector)', () => {
    expect(sanitizeDisplayText('<img src=x onerror=alert(1)>')).toBe('img src=x onerror=alert(1)')
    expect(sanitizeDisplayText('a<b>c')).toBe('abc')
  })

  it('strips control characters and DEL', () => {
    expect(sanitizeDisplayText('ab\u0000\u0007cd\u007f')).toBe('abcd')
    expect(sanitizeDisplayText('line\nbreak\ttab')).toBe('linebreaktab')
  })

  it('keeps normal names, emoji, and Indic scripts intact', () => {
    expect(sanitizeDisplayText('Mahesh Dhiman')).toBe('Mahesh Dhiman')
    expect(sanitizeDisplayText('Priya 🎉')).toBe('Priya 🎉')
    expect(sanitizeDisplayText('महेश')).toBe('महेश')
  })

  it('caps length and trims whitespace', () => {
    expect(sanitizeDisplayText('x'.repeat(50))).toHaveLength(30)
    expect(sanitizeDisplayText('  spaced out  ')).toBe('spaced out')
    expect(sanitizeDisplayText(null)).toBe('')
    expect(sanitizeDisplayText(undefined)).toBe('')
  })
})
