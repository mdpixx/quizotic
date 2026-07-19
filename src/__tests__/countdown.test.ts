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

  describe('3-2-1 get-ready overlay (round:ceil, max:3)', () => {
    // The 3-2-1 intro overlay uses ceil + max:3 so each digit owns a full second
    // and the final "1"→0 transition lands exactly on startAt. These tests lock
    // in the host↔participant alignment contract: both screens share the server
    // startAt as endAt, so they must emit identical values at identical instants.
    const START = 3500

    it('emits 3 → 2 → 1 → 0 at whole-second boundaries, clamped to 3', () => {
      const values: number[] = []
      vi.setSystemTime(0)
      const handle = startBoundaryCountdown(START, v => values.push(v), {
        round: 'ceil',
        max: 3,
      })
      // Advance well past startAt so the engine runs to completion.
      vi.advanceTimersByTime(START + 500)
      // Initial paint at t=0 is ceil(3.5)=4, clamped to 3. Because scheduling
      // keys off the CLAMPED displayed value, the next wake is at the visible
      // 3→2 boundary (1000ms), NOT the raw 4→3 boundary (500ms) — so there's no
      // redundant duplicate-3 tick. Sequence: 3, 2, 1, then 0 at startAt=3500.
      expect(values).toEqual([3, 2, 1, 0])
      handle.stop()
    })

    it('host and participant (two clients, same startAt) flip at identical instants', () => {
      // Mirrors the existing "two clients with the same endAt" test, but for the
      // 3-2-1 overlay config. This is the core sync guarantee the fix delivers:
      // both screens derive the same boundaries from the shared server startAt,
      // so the digit flips are byte-identical in time and value — no drift.
      const host: Array<{ t: number; v: number }> = []
      const participant: Array<{ t: number; v: number }> = []
      vi.setSystemTime(0)
      startBoundaryCountdown(START, v => host.push({ t: Date.now(), v }), {
        round: 'ceil',
        max: 3,
      })
      startBoundaryCountdown(START, v => participant.push({ t: Date.now(), v }), {
        round: 'ceil',
        max: 3,
      })
      vi.advanceTimersByTime(START + 500)
      // Identical value AND identical fire time for every step — no inter-screen
      // drift, which is the whole point of routing the overlay through the engine.
      expect(host).toEqual(participant)
      // Sanity: both saw the full 3,2,1 cadence then a final 0.
      expect(host.map(s => s.v)).toEqual([3, 2, 1, 0])
    })
  })
})
