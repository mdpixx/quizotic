// Display-true pause remaining — guards the 2026-07 pause/resume desync fix.
// The server's internal remaining (questionEndsAt - now) includes the +500ms
// paint-grace and, when paused during the 3-2-1 get-ready window, leftover
// intro time. Sending that raw value inflated every client's timer by up to
// a digit per pause/resume cycle. displayRemainingMs strips the grace and
// clamps to what clients actually display.

import { describe, it, expect } from 'vitest'
import { displayRemainingMs } from '../lib/session-state.mjs'

describe('displayRemainingMs', () => {
  it('strips the 500ms paint-grace from the raw remaining', () => {
    // 12.5s raw on a 30s question → 12s display-true.
    expect(displayRemainingMs(12_500, 30)).toBe(12_000)
  })

  it('clamps to the question timer when paused during the intro', () => {
    // Raw includes 2s leftover intro + 30s timer + 0.5s grace.
    expect(displayRemainingMs(32_500, 30)).toBe(30_000)
  })

  it('lets a host-granted extension exceed the base timer', () => {
    // 30s timer + 15s extension, paused with 40s raw remaining.
    expect(displayRemainingMs(40_500, 30, 15_000)).toBe(40_000)
    // …but still clamps intro leftovers above timer + extension.
    expect(displayRemainingMs(50_000, 30, 15_000)).toBe(45_000)
  })

  it('never goes negative', () => {
    expect(displayRemainingMs(300, 30)).toBe(0)
    expect(displayRemainingMs(0, 30)).toBe(0)
  })

  it('returns null for a null/undefined raw value (no snapshot available)', () => {
    expect(displayRemainingMs(null, 30)).toBeNull()
    expect(displayRemainingMs(undefined, 30)).toBeNull()
  })
})
