// KDE for the rating / 100-point scale ridge (src/lib/density.ts).
//
// The distribution is the whole reason this exists: a room that answers all
// 3s and a room that splits 1/5 both average 3.0, and only the second is
// worth stopping to discuss. These tests pin the properties that make the
// curve readable at the sample sizes a live room actually produces — which is
// often one or two responses, not two hundred.

import { describe, it, expect } from 'vitest'
import { kde, densityPath, stdDev, bandwidth, mean, meanFraction } from '../lib/density'

const RATING: [number, number] = [1, 5]

describe('stdDev', () => {
  it('is zero for degenerate samples', () => {
    expect(stdDev([])).toBe(0)
    expect(stdDev([4])).toBe(0)
    expect(stdDev([3, 3, 3, 3])).toBe(0)
  })

  it('matches the sample standard deviation', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2)
  })
})

describe('bandwidth', () => {
  it('never returns zero width, even for identical responses', () => {
    // Twenty people all answering 3 would otherwise give a spike of infinite
    // height and no width — the curve would vanish exactly when consensus is
    // the most interesting result on screen.
    expect(bandwidth([3, 3, 3, 3, 3], RATING, 1 / 14)).toBeGreaterThan(0)
  })

  it('floors at the given fraction of the domain', () => {
    expect(bandwidth([3], RATING, 1 / 4)).toBeCloseTo(1, 5)
  })

  it('widens with spread once Silverman exceeds the floor', () => {
    const tight = bandwidth([2.9, 3, 3.1], RATING, 1 / 100)
    const wide = bandwidth([1, 3, 5], RATING, 1 / 100)
    expect(wide).toBeGreaterThan(tight)
  })
})

describe('kde', () => {
  it('returns a fixed point count regardless of sample size', () => {
    // This is what lets the path interpolate between renders instead of being
    // redrawn — the morph depends on both curves having the same arity.
    expect(kde([], { domain: RATING })).toHaveLength(64)
    expect(kde([3], { domain: RATING })).toHaveLength(64)
    expect(kde(Array(500).fill(3), { domain: RATING })).toHaveLength(64)
    expect(kde([1, 5], { domain: RATING, points: 32 })).toHaveLength(32)
  })

  it('is all zeros with no responses', () => {
    expect(kde([], { domain: RATING }).every(v => v === 0)).toBe(true)
  })

  it('peaks at a single response rather than spiking or vanishing', () => {
    const curve = kde([3], { domain: RATING })
    const peakIndex = curve.indexOf(Math.max(...curve))
    // 3 is the midpoint of 1..5, so the peak belongs at the middle sample.
    expect(peakIndex).toBeGreaterThan(28)
    expect(peakIndex).toBeLessThan(36)
    expect(Math.max(...curve)).toBeGreaterThan(0)
    expect(Number.isFinite(Math.max(...curve))).toBe(true)
  })

  it('puts the peak near the mode of a unimodal sample', () => {
    const curve = kde([4, 4, 4, 4, 3, 5], { domain: RATING })
    const peakIndex = curve.indexOf(Math.max(...curve))
    const peakValue = 1 + (peakIndex / 63) * 4
    expect(peakValue).toBeCloseTo(4, 0)
  })

  it('shows two humps for a split room', () => {
    // The case the old single-average display could not represent at all.
    const curve = kde([1, 1, 1, 1, 1, 5, 5, 5, 5, 5], { domain: RATING, minBandwidthFraction: 1 / 30 })
    const mid = curve[Math.floor(curve.length / 2)]
    expect(curve[0]).toBeGreaterThan(mid)
    expect(curve[curve.length - 1]).toBeGreaterThan(mid)
  })

  it('never produces negative or non-finite density', () => {
    const curve = kde([1, 2, 3, 4, 5, 5, 5], { domain: RATING })
    expect(curve.every(v => v >= 0 && Number.isFinite(v))).toBe(true)
  })

  it('handles a 0–100 domain', () => {
    const curve = kde([10, 50, 90], { domain: [0, 100] })
    expect(curve).toHaveLength(64)
    expect(curve.every(v => Number.isFinite(v))).toBe(true)
  })
})

describe('densityPath', () => {
  it('closes the path so it can be filled', () => {
    const d = densityPath(kde([3], { domain: RATING }), 400, 120)
    expect(d.startsWith('M 0 120')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('sits flat on the baseline when nothing has been submitted', () => {
    const d = densityPath(kde([], { domain: RATING }), 400, 120)
    // Every y must be the baseline — no phantom curve before the first vote.
    const ys = [...d.matchAll(/[ML Q]\s*[\d.]+\s+([\d.]+)/g)].map(m => Number(m[1]))
    expect(ys.every(y => y === 120)).toBe(true)
  })

  it('normalises to its own peak, leaving headroom above it', () => {
    // Absolute density is meaningless to an audience — the shape is the
    // message — so the curve always fills the frame. It stops short of the
    // ceiling so it reads as a curve rather than a filled block.
    const d = densityPath(kde([3, 3, 3], { domain: RATING }), 400, 120)
    const ys = [...d.matchAll(/[ML Q]\s*[\d.]+\s+([\d.]+)/g)].map(m => Number(m[1]))
    expect(Math.min(...ys)).toBeCloseTo(120 * 0.08, 0)
  })

  it('honours a custom headroom', () => {
    const flush = densityPath(kde([3, 3, 3], { domain: RATING }), 400, 120, 0)
    const ys = [...flush.matchAll(/[ML Q]\s*[\d.]+\s+([\d.]+)/g)].map(m => Number(m[1]))
    expect(Math.min(...ys)).toBeCloseTo(0, 0)
  })

  it('degrades to a flat line rather than throwing on a tiny sample array', () => {
    expect(densityPath([], 400, 120)).toContain('Z')
    expect(densityPath([0.5], 400, 120)).toContain('Z')
  })
})

describe('mean helpers', () => {
  it('returns null for an empty sample rather than NaN', () => {
    expect(mean([])).toBeNull()
    expect(meanFraction([], RATING)).toBeNull()
  })

  it('places the mean as a 0–1 fraction of the domain', () => {
    expect(meanFraction([1], RATING)).toBeCloseTo(0)
    expect(meanFraction([5], RATING)).toBeCloseTo(1)
    expect(meanFraction([3], RATING)).toBeCloseTo(0.5)
  })

  it('clamps out-of-domain responses instead of overflowing the track', () => {
    expect(meanFraction([9], RATING)).toBe(1)
    expect(meanFraction([-4], RATING)).toBe(0)
  })
})
