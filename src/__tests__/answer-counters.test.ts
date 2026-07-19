// O(1) answer aggregation counters (Workstream A).
//
// submit_answer previously recomputed countAnswers + countAnswersByOption
// from scratch on every accepted answer — O(N²) work across a burst of N
// answers. These tests pin the contract of the per-question counter maps:
//   - bump once per accept, mirroring the historical countAnswers / option
//     bucket semantics (single-choice + multiselect).
//   - reset on question advance.
//   - late answers still count (host roster must match the audit trail).
//   - getAnswerCount returns -1 sentinel when no counter exists, so the
//     server-side fallback path stays correct.

import { describe, it, expect } from 'vitest'
import {
  ensureAnswerCounters,
  resetAnswerCountersForQuestion,
  bumpAnswerCounters,
  getAnswerCount,
  getAnswerOptionCounts,
} from '../lib/session-state.mjs'

type CounterSession = {
  answerCounts?: Map<number, number>
  answerOptionCounts?: Map<number, number[]>
}

function makeSession(): CounterSession {
  return {}
}

describe('ensureAnswerCounters', () => {
  it('creates the counter maps lazily', () => {
    const s = makeSession()
    ensureAnswerCounters(s)
    expect(s.answerCounts).toBeInstanceOf(Map)
    expect(s.answerOptionCounts).toBeInstanceOf(Map)
  })

  it('is idempotent — does not clobber existing counters', () => {
    const s = makeSession()
    ensureAnswerCounters(s)
    s.answerCounts!.set(0, 5)
    ensureAnswerCounters(s)
    expect(s.answerCounts!.get(0)).toBe(5)
  })

  it('no-ops on null/undefined session', () => {
    expect(() => ensureAnswerCounters(null)).not.toThrow()
    expect(() => ensureAnswerCounters(undefined)).not.toThrow()
  })
})

describe('resetAnswerCountersForQuestion', () => {
  it('zeroes the count and pre-sizes the option buckets', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 2, 4)
    expect(getAnswerCount(s, 2)).toBe(0)
    expect(getAnswerOptionCounts(s, 2)).toEqual([0, 0, 0, 0])
  })

  it('clears a previously-populated count for the same question', () => {
    const s = makeSession()
    bumpAnswerCounters(s, 1, '0', 4)
    bumpAnswerCounters(s, 1, '1', 4)
    expect(getAnswerCount(s, 1)).toBe(2)
    resetAnswerCountersForQuestion(s, 1, 4)
    expect(getAnswerCount(s, 1)).toBe(0)
    expect(getAnswerOptionCounts(s, 1)).toEqual([0, 0, 0, 0])
  })

  it('preserves other questions when resetting one', () => {
    const s = makeSession()
    bumpAnswerCounters(s, 0, '0', 4)
    bumpAnswerCounters(s, 1, '1', 4)
    resetAnswerCountersForQuestion(s, 0, 4)
    expect(getAnswerCount(s, 0)).toBe(0)
    expect(getAnswerCount(s, 1)).toBe(1)
  })
})

describe('bumpAnswerCounters', () => {
  it('increments the count once per accept and returns the new count', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    expect(bumpAnswerCounters(s, 0, '0', 4)).toBe(1)
    expect(bumpAnswerCounters(s, 0, '2', 4)).toBe(2)
    expect(bumpAnswerCounters(s, 0, '1', 4)).toBe(3)
    expect(getAnswerCount(s, 0)).toBe(3)
  })

  it('tallies single-choice answers into the right bucket', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    bumpAnswerCounters(s, 0, '0', 4)
    bumpAnswerCounters(s, 0, '0', 4)
    bumpAnswerCounters(s, 0, '2', 4)
    expect(getAnswerOptionCounts(s, 0)).toEqual([2, 0, 1, 0])
  })

  it('tallies multiselect (array) answers into every selected bucket', () => {
    // Mirrors the historical Number(['0','2']) NaN bug fix — arrays must
    // bump each index, not NaN out.
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    bumpAnswerCounters(s, 0, ['0', '2'], 4) // participant picks 0 and 2
    bumpAnswerCounters(s, 0, ['1', '2'], 4)
    expect(getAnswerOptionCounts(s, 0)).toEqual([1, 1, 2, 0])
    // Count is per-PARTICIPANT (one bump each), not per-option-tap.
    expect(getAnswerCount(s, 0)).toBe(2)
  })

  it('tallies numeric-index answers (mcq answers are sometimes numbers)', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    bumpAnswerCounters(s, 0, 3, 4)
    expect(getAnswerOptionCounts(s, 0)).toEqual([0, 0, 0, 1])
  })

  it('ignores out-of-range indices defensively', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    bumpAnswerCounters(s, 0, '99', 4) // out of range
    bumpAnswerCounters(s, 0, '-1', 4) // negative
    bumpAnswerCounters(s, 0, 'not-a-number', 4) // NaN
    // Count still increments (the participant answered); buckets stay zero.
    expect(getAnswerCount(s, 0)).toBe(3)
    expect(getAnswerOptionCounts(s, 0)).toEqual([0, 0, 0, 0])
  })

  it('grows the bucket array if numOptions exceeds the reset size', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 2)
    bumpAnswerCounters(s, 0, '1', 5) // caller now reports 5 options
    const buckets = getAnswerOptionCounts(s, 0)
    expect(buckets).toHaveLength(5)
    expect(buckets).toEqual([0, 1, 0, 0, 0])
  })

  it('late answers still bump (host roster must match the audit trail)', () => {
    // The submit_answer duplicate guard prevents double-counting for a single
    // participant; late answers are a *different* participant and must be
    // counted so the host's "X answered" matches the number of stored rows.
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    bumpAnswerCounters(s, 0, '0', 4) // in-window
    bumpAnswerCounters(s, 0, '1', 4) // late, still recorded
    expect(getAnswerCount(s, 0)).toBe(2)
  })

  it('handles drawing-style answers with no option buckets', () => {
    // numOptions=0: only the count bumps, no bucket array is touched.
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 0)
    bumpAnswerCounters(s, 0, 'drawing', 0)
    bumpAnswerCounters(s, 0, 'drawing', 0)
    expect(getAnswerCount(s, 0)).toBe(2)
    expect(getAnswerOptionCounts(s, 0)).toEqual([])
  })
})

describe('read sentinels', () => {
  it('getAnswerCount returns -1 when no counter exists for the question', () => {
    const s = makeSession()
    ensureAnswerCounters(s)
    expect(getAnswerCount(s, 99)).toBe(-1)
  })

  it('getAnswerCount returns -1 when no counter maps exist at all', () => {
    expect(getAnswerCount(makeSession(), 0)).toBe(-1)
  })

  it('getAnswerOptionCounts returns null when no counter exists', () => {
    const s = makeSession()
    ensureAnswerCounters(s)
    expect(getAnswerOptionCounts(s, 99)).toBeNull()
  })

  it('distinguishes "0 answers" from "no counter yet"', () => {
    const s = makeSession()
    resetAnswerCountersForQuestion(s, 0, 4)
    expect(getAnswerCount(s, 0)).toBe(0) // 0 answers
    expect(getAnswerCount(s, 1)).toBe(-1) // no counter
  })
})
