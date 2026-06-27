import { describe, expect, it } from 'vitest'
import { compose, daysInMonth, parseValue } from '@/components/host/DialDateTimeField'

// The scheduler dial must honour the same value contract as the old native
// datetime-local input: a local `YYYY-MM-DDTHH:mm` string. The host pipeline
// feeds that straight into `new Date(x).toISOString()` (UTC) and the server
// stores it, so a malformed or impossible date here would silently shift a
// whole scheduled quiz. These tests lock the round-trip + clamping behaviour.

describe('DialDateTimeField value contract', () => {
  it('round-trips a normal local datetime through parse/compose', () => {
    const v = '2026-06-27T21:30'
    expect(compose(parseValue(v))).toBe(v)
  })

  it('clamps an impossible day to the last valid day of the month (Apr 31 → 30)', () => {
    expect(compose(parseValue('2026-04-31T09:00'))).toBe('2026-04-30T09:00')
  })

  it('clamps Feb 30 in a non-leap year to Feb 28', () => {
    expect(compose(parseValue('2025-02-30T08:00'))).toBe('2025-02-28T08:00')
  })

  it('preserves Feb 29 in a leap year', () => {
    expect(compose(parseValue('2024-02-29T08:00'))).toBe('2024-02-29T08:00')
  })

  it('zero-pads single-digit day/hour/minute', () => {
    expect(compose({ year: 2026, month: 0, day: 5, hour: 9, minute: 7 })).toBe('2026-01-05T09:07')
  })

  it('keeps 24-hour time verbatim (hour 0 and hour 23)', () => {
    expect(compose(parseValue('2026-06-27T00:00'))).toBe('2026-06-27T00:00')
    expect(compose(parseValue('2026-06-27T23:59'))).toBe('2026-06-27T23:59')
  })

  it('daysInMonth knows leap vs non-leap February', () => {
    expect(daysInMonth(2024, 1)).toBe(29)
    expect(daysInMonth(2025, 1)).toBe(28)
    expect(daysInMonth(2026, 3)).toBe(30) // April
    expect(daysInMonth(2026, 4)).toBe(31) // May
  })

  it('falls back to "now" (a valid Parts shape) on an empty/garbage value', () => {
    const parts = parseValue('')
    expect(parts.year).toBeGreaterThanOrEqual(2026)
    expect(parts.month).toBeGreaterThanOrEqual(0)
    expect(parts.month).toBeLessThanOrEqual(11)
    expect(parts.day).toBeGreaterThanOrEqual(1)
    expect(parts.day).toBeLessThanOrEqual(daysInMonth(parts.year, parts.month))
    // Still composes cleanly — never throws.
    expect(compose(parts)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
