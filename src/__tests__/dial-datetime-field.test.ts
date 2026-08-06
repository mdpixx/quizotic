import { describe, expect, it } from 'vitest'
import { buildDateItems, buildMinuteItems, compose, daysInMonth, parseValue } from '@/components/host/DialDateTimeField'

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

// The six day/month/year drums collapsed into one date drum, and minutes moved
// to 5-minute steps, to make the Schedule tab fit on a laptop. Both changes can
// silently move a host's schedule if they get the edges wrong.

describe('buildDateItems (single date drum)', () => {
  const today = new Date(2026, 5, 27) // Sat 27 Jun 2026

  it('starts at today and labels the first two rows in plain language', () => {
    const items = buildDateItems(today, today)
    expect(items[0].label).toBe('Today')
    expect(items[1].label).toBe('Tomorrow')
    expect(items[0].date.getDate()).toBe(27)
  })

  it('labels later rows with weekday, day and month', () => {
    const items = buildDateItems(today, today)
    expect(items[2].label).toMatch(/Jun/)
    expect(items[2].date.getDate()).toBe(29)
  })

  it('spells out the year only once the drum crosses into a new one', () => {
    const items = buildDateItems(today, today)
    const sameYear = items.find(i => i.date.getFullYear() === 2026 && i.label !== 'Today' && i.label !== 'Tomorrow')
    const nextYear = items.find(i => i.date.getFullYear() === 2027)
    expect(sameYear?.label).not.toMatch(/2026/)
    expect(nextYear?.label).toMatch(/2027/)
  })

  // A saved schedule must stay reachable even after its open date has passed —
  // otherwise reopening the modal would snap the value to today.
  it('extends backwards to include an already-past selection', () => {
    const past = new Date(2026, 5, 20)
    const items = buildDateItems(today, past)
    expect(items[0].date.getTime()).toBe(past.getTime())
    expect(items.some(i => i.label === 'Today')).toBe(true)
  })

  it('extends forwards to include a selection beyond the default range', () => {
    const far = new Date(2028, 0, 15)
    const items = buildDateItems(today, far)
    expect(items[items.length - 1].date.getTime()).toBe(far.getTime())
  })

  it('produces one row per day with no gaps or repeats', () => {
    const items = buildDateItems(today, today)
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].date.getTime() - items[i - 1].date.getTime()
      expect(gap).toBe(86400000)
    }
  })
})

describe('buildMinuteItems (5-minute steps)', () => {
  it('offers twelve rows for an on-step value', () => {
    expect(buildMinuteItems(30)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  })

  it('splices an off-step value in rather than rounding it away', () => {
    const items = buildMinuteItems(37)
    expect(items).toContain(37)
    expect(items.indexOf(37)).toBe(items.indexOf(35) + 1)
    expect(items).toHaveLength(13)
  })

  it('keeps the list sorted so the drum reads in order', () => {
    const items = buildMinuteItems(1)
    expect([...items].sort((a, b) => a - b)).toEqual(items)
  })
})
