// Clock-sync offset selection (Workstream D).
//
// The old best-of-N policy kept the single smallest-RTT sample's offset for
// the whole session — a lucky-but-noisy low-RTT ping at connect could lock
// in a biased offset forever. The new policy takes the MEDIAN offset across
// the lowest-RTT half of a rolling 8-sample window: rejects outliers, tracks
// real drift, never permanently locks in.
//
// Tests cover: outlier rejection, window eviction (FIFO), half-RTT tracking
// (for the display correction), and that getServerNow() stays sane.

import { describe, it, expect, beforeEach } from 'vitest'
import { __test, getServerNow, getServerTimeOffsetMs, getMeasuredRttMs } from '../lib/clock-sync'

describe('clock-sync offset selection (median-of-low-rtt-half)', () => {
  beforeEach(() => {
    __test.resetForTest()
  })

  it('returns 0 offset before any samples land', () => {
    expect(getServerTimeOffsetMs()).toBe(0)
    expect(getMeasuredRttMs()).toBe(0)
  })

  it('converges to the true offset when samples are clean', () => {
    // True offset +100ms, RTT ~50ms. All 8 samples consistent.
    for (let i = 0; i < 8; i++) {
      __test.ingestSample(100 + (i % 3 === 0 ? 1 : 0), 50 + i)
    }
    // Median of the low-RTT half lands on ~100.
    expect(getServerTimeOffsetMs()).toBeGreaterThanOrEqual(99)
    expect(getServerTimeOffsetMs()).toBeLessThanOrEqual(101)
  })

  it('rejects a single outlier offset (the best-of-N failure mode)', () => {
    // Seven clean samples at +100ms; one early lucky low-RTT sample at +400ms.
    // Old best-of-N would lock in +400 forever (it had the lowest RTT).
    __test.ingestSample(400, 20) // lucky ping, noisy offset
    for (let i = 0; i < 7; i++) {
      __test.ingestSample(100, 60 + i)
    }
    // Median-of-low-half ignores the single outlier — stays near +100.
    expect(getServerTimeOffsetMs()).toBeLessThan(200)
    expect(getServerTimeOffsetMs()).toBeGreaterThanOrEqual(95)
  })

  it('rejects a single huge-RTT noise sample', () => {
    for (let i = 0; i < 7; i++) __test.ingestSample(100, 50)
    // A packet stalled in a bufferbloat spike — high RTT, offset distorted.
    __test.ingestSample(900, 2000)
    expect(getServerTimeOffsetMs()).toBeLessThan(200)
  })

  it('tracks real clock drift as new samples arrive', () => {
    // Clock drifts +50ms over the session.
    for (let i = 0; i < 8; i++) __test.ingestSample(100, 50)
    expect(getServerTimeOffsetMs()).toBeCloseTo(100, 0)
    // Drift to +150ms over the next window.
    for (let i = 0; i < 8; i++) __test.ingestSample(150, 50)
    expect(getServerTimeOffsetMs()).toBeCloseTo(150, 0)
  })

  it('evicts the oldest sample when the window fills (FIFO)', () => {
    expect(__test.windowLength()).toBe(0)
    for (let i = 0; i < __test.WINDOW_SIZE; i++) __test.ingestSample(100, 50)
    expect(__test.windowLength()).toBe(__test.WINDOW_SIZE)
    // One more — oldest must evict, length stays capped.
    __test.ingestSample(200, 50)
    expect(__test.windowLength()).toBe(__test.WINDOW_SIZE)
  })

  it('tracks the smallest-RTT seen for the display half-RTT correction', () => {
    __test.ingestSample(100, 80)
    __test.ingestSample(101, 40) // new low
    __test.ingestSample(99, 60)
    __test.ingestSample(100, 120) // high RTT, must not replace the low
    expect(getMeasuredRttMs()).toBe(40)
  })

  it('getServerNow = Date.now() + offset (sanity)', () => {
    __test.ingestSample(1000, 50)
    const before = Date.now()
    const snapped = getServerNow()
    const after = Date.now()
    // Snapped server time must be within [before+1000, after+1000].
    expect(snapped).toBeGreaterThanOrEqual(before + 1000)
    expect(snapped).toBeLessThanOrEqual(after + 1000)
  })

  it('with <4 samples, takes the plain median (no low-half weighting yet)', () => {
    __test.ingestSample(100, 50)
    __test.ingestSample(300, 50) // outlier in a tiny window
    __test.ingestSample(102, 50)
    // Plain median of [100, 300, 102] sorted = [100, 102, 300] → 102.
    expect(getServerTimeOffsetMs()).toBe(102)
  })
})
