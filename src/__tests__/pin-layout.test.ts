// De-overlap and idle drift for the pin/scatter slides (src/lib/pin-layout.ts).
//
// The displacement cap is the load-bearing property: these dots represent
// where real people said they sit on a 2x2, so spreading them for legibility
// must never move one far enough to change what it claims. The original spec
// (one pass, <=4px) was measured against a real clump and did nothing at all,
// which is why the numbers below are asserted rather than assumed.

import { describe, it, expect } from 'vitest'
import { relaxPins, closestPair, pinHash, driftFor, type Pin } from '../lib/pin-layout'

/** Fourteen taps inside a ~5% box — the "everyone agrees" case. */
function clump(): Pin[] {
  return Array.from({ length: 14 }, (_, i) => ({
    x: 50 + (i % 4) * 1.4,
    y: 50 + Math.floor(i / 4) * 1.2,
  }))
}

describe('relaxPins', () => {
  it('leaves trivial inputs untouched', () => {
    expect(relaxPins([])).toEqual([])
    expect(relaxPins([{ x: 30, y: 70 }])).toEqual([{ x: 30, y: 70 }])
  })

  it('does not move dots that are already far apart', () => {
    const spread: Pin[] = [{ x: 10, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]
    expect(relaxPins(spread)).toEqual(spread)
  })

  it('never displaces a dot beyond the cap', () => {
    // The honesty guarantee: a spread dot still means roughly what the
    // participant tapped.
    const input = clump()
    const out = relaxPins(input)
    const moves = out.map((p, i) => Math.hypot(p.x - input[i].x, p.y - input[i].y))
    expect(Math.max(...moves)).toBeLessThanOrEqual(3 + 1e-9)
  })

  it('respects a custom cap', () => {
    const input = clump()
    const out = relaxPins(input, { maxDisplacement: 1 })
    const moves = out.map((p, i) => Math.hypot(p.x - input[i].x, p.y - input[i].y))
    expect(Math.max(...moves)).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('meaningfully separates a real clump', () => {
    // Regression guard for the original one-pass/4px spec, which moved the
    // closest pair by almost nothing.
    const input = clump()
    const before = closestPair(input)
    const after = closestPair(relaxPins(input))
    expect(before).toBeCloseTo(1.2, 1)
    expect(after).toBeGreaterThan(before * 2)
  })

  it('separates exactly coincident dots', () => {
    // Six people tapping the identical pixel must not render as one dot.
    const stacked: Pin[] = Array.from({ length: 6 }, () => ({ x: 40, y: 60 }))
    const out = relaxPins(stacked)
    expect(closestPair(out)).toBeGreaterThan(0.5)
  })

  it('is deterministic — a re-render never reshuffles the dots', () => {
    const input = clump()
    expect(relaxPins(input)).toEqual(relaxPins(input))
  })

  it('does not mutate its input', () => {
    const input = clump()
    const snapshot = JSON.stringify(input)
    relaxPins(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('keeps every dot inside the plot', () => {
    const edge: Pin[] = Array.from({ length: 10 }, () => ({ x: 99.5, y: 0.5 }))
    for (const p of relaxPins(edge)) {
      expect(p.x).toBeGreaterThanOrEqual(2)
      expect(p.x).toBeLessThanOrEqual(98)
      expect(p.y).toBeGreaterThanOrEqual(2)
      expect(p.y).toBeLessThanOrEqual(98)
    }
  })

  it('stays finite on a large field', () => {
    const many: Pin[] = Array.from({ length: 200 }, (_, i) => ({
      x: 45 + (i % 10) * 0.4,
      y: 45 + Math.floor(i / 10) * 0.4,
    }))
    expect(relaxPins(many).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('pinHash', () => {
  it('depends on position, not array order', () => {
    // Colour and drift must not change as other people answer.
    const pin = { x: 33, y: 66 }
    expect(pinHash(pin, 1)).toBe(pinHash({ ...pin }, 1))
  })

  it('separates its independent uses by salt', () => {
    const pin = { x: 33, y: 66 }
    expect(pinHash(pin, 0x2545)).not.toBe(pinHash(pin, 0x51ed))
  })

  it('is always non-negative', () => {
    for (let x = 0; x <= 100; x += 7) {
      for (let y = 0; y <= 100; y += 11) {
        expect(pinHash({ x, y }, 0x9e37)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('driftFor', () => {
  it('keeps amplitude small enough that no dot appears to change its answer', () => {
    for (let x = 0; x <= 100; x += 3) {
      const { dx, dy } = driftFor({ x, y: 100 - x })
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(3.01)
    }
  })

  it('stays within the intended 2.5–4s loop', () => {
    for (let x = 0; x <= 100; x += 3) {
      const { duration } = driftFor({ x, y: x })
      expect(duration).toBeGreaterThanOrEqual(2.5)
      expect(duration).toBeLessThanOrEqual(4)
    }
  })

  it('offsets each dot into the loop so the field never pulses in unison', () => {
    const delays = new Set<number>()
    for (let x = 0; x <= 100; x += 2) delays.add(driftFor({ x, y: 50 }).delay)
    expect(delays.size).toBeGreaterThan(5)
    for (const d of delays) expect(d).toBeLessThanOrEqual(0)
  })

  it('is deterministic per position', () => {
    expect(driftFor({ x: 12, y: 88 })).toEqual(driftFor({ x: 12, y: 88 }))
  })
})
