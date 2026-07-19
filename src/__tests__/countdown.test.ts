// Shared boundary-scheduled countdown engine (src/lib/countdown.ts).
//
// This is the core "absolute sync" fix: instead of a free-running 100ms poll on
// each screen (which flips digits up to ~100ms apart at different sub-second
// phases), the engine schedules each update to the EXACT server-time second
// boundary. Two clients that share the same endAt and the same server-clock
// mapping therefore fire the same boundary at the same instant.
//
// clock-sync's offset starts at 0 (reset in beforeEach), so getServerNow()
// === Date.now(). Vitest's fake timers fake Date too, so advancing the fake
// clock moves getServerNow() forward and fires the scheduled setTimeouts in
// lockstep — exactly the invariant the engine relies on.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startBoundaryCountdown, currentSecondsLeft, nextBoundaryAt } from '../lib/countdown'
import { __test } from '../lib/clock-sync'

const END = 20_000 // 20s question, absolute server-clock deadline

beforeEach(() => {
  __test.resetForTest() // offset = 0 → getServerNow() === Date.now()
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('nextBoundaryAt (server-time instant of the next digit flip)', () => {
  it('is the half-second offset from the deadline', () => {
    // At now=0 the value is 20; it flips to 19 at endAt - (20 - 0.5)*1000.
    expect(nextBoundaryAt(END, 0)).toBe(500)
    // At now=510 the value is 19; it flips to 18 at endAt - (19 - 0.5)*1000.
    expect(nextBoundaryAt(END, 510)).toBe(1500)
  })
})

describe('currentSecondsLeft (server-time remaining, rounded, clamped)', () => {
  it('rounds to the nearest whole second', () => {
    vi.setSystemTime(0)
    expect(currentSecondsLeft(END)).toBe(20)
  })
  it('is 0 at the deadline and clamps past it', () => {
    vi.setSystemTime(END)
    expect(currentSecondsLeft(END)).toBe(0)
    vi.setSystemTime(END + 5000)
    expect(currentSecondsLeft(END)).toBe(0)
  })
})

describe('startBoundaryCountdown', () => {
  it('emits once per second, 20 → 0, and stops (not 10×/sec)', () => {
    const values: number[] = []
    startBoundaryCountdown(END, v => values.push(v))
    // Initial synchronous paint.
    expect(values).toEqual([20])
    vi.advanceTimersByTime(END + 200)
    // Exactly one emit per second boundary: 20 (initial) then 19..0.
    expect(values).toEqual(Array.from({ length: 21 }, (_, i) => 20 - i))
    expect(values[values.length - 1]).toBe(0)
  })

  it('two clients with the same endAt flip at the same instant', () => {
    const a: Array<{ t: number; v: number }> = []
    const b: Array<{ t: number; v: number }> = []
    startBoundaryCountdown(END, v => a.push({ t: Date.now(), v }))
    startBoundaryCountdown(END, v => b.push({ t: Date.now(), v }))
    vi.advanceTimersByTime(END + 200)
    // Identical value AND identical fire time for every step — no inter-screen
    // drift, which is the whole point of the engine.
    expect(a).toEqual(b)
  })

  it('stop() halts further emits', () => {
    const values: number[] = []
    const handle = startBoundaryCountdown(END, v => values.push(v))
    handle.stop()
    vi.advanceTimersByTime(END + 200)
    expect(values).toEqual([20]) // only the initial synchronous paint
  })

  it('never emits a negative value', () => {
    const values: number[] = []
    startBoundaryCountdown(END, v => values.push(v))
    vi.advanceTimersByTime(END + 10_000)
    expect(Math.min(...values)).toBe(0)
  })

  describe('get-ready gate (startAt)', () => {
    const START = 3500 // server starts the visible countdown 3.5s after show

    it('does not emit or fire onStart until server-time crosses startAt', () => {
      const values: number[] = []
      let started = false
      startBoundaryCountdown(END, v => values.push(v), {
        startAt: START,
        onStart: () => { started = true },
      })
      // Gated — nothing yet.
      expect(values).toEqual([])
      expect(started).toBe(false)
      vi.advanceTimersByTime(START + 200)
      expect(started).toBe(true)
      // First live value at ~startAt: round((20000 - 3510)/1000) = 16.
      expect(values[0]).toBe(16)
    })
  })
})
