// Guards the invariants that keep per-participant option shuffling from
// silently corrupting scores.
//
// The dangerous failure mode here is not a crash — it's a shuffle that looks
// fine on screen while mapping answers to the wrong option, turning correct
// answers into wrong ones with no error anywhere. Every test below exists to
// catch a specific way that can happen.

import { describe, it, expect } from 'vitest'
import {
  buildDisplayOrder,
  invertDisplayOrder,
  isShuffleableType,
  toOriginalIndex,
  toDisplaySlot,
} from '@/lib/option-shuffle'

const base = {
  optionCount: 4,
  enabled: true,
  questionType: 'mcq',
  participantId: 'p-abc-123',
  questionId: 'q1',
  questionIndex: 0,
}

function isPermutationOf(order: number[], n: number): boolean {
  if (order.length !== n) return false
  return [...order].sort((a, b) => a - b).every((v, i) => v === i)
}

describe('buildDisplayOrder — identity cases', () => {
  it('returns identity when the host has shuffling off', () => {
    expect(buildDisplayOrder({ ...base, enabled: false })).toEqual([0, 1, 2, 3])
  })

  it('returns identity for non-shuffleable types', () => {
    // truefalse and poll are deliberately excluded — see option-shuffle.ts.
    for (const type of ['truefalse', 'poll', 'ranking', 'matching', 'openended', 'wordcloud']) {
      expect(buildDisplayOrder({ ...base, questionType: type })).toEqual([0, 1, 2, 3])
    }
  })

  it('returns identity when there is no participant identity to seed from', () => {
    // A participant whose id hasn't been assigned yet must not get a random
    // order, because the server would score against original indices while the
    // client believed it had shuffled.
    expect(buildDisplayOrder({ ...base, participantId: null })).toEqual([0, 1, 2, 3])
    expect(buildDisplayOrder({ ...base, participantId: '' })).toEqual([0, 1, 2, 3])
  })

  it('returns identity for 0 or 1 options (nothing to permute)', () => {
    expect(buildDisplayOrder({ ...base, optionCount: 0 })).toEqual([])
    expect(buildDisplayOrder({ ...base, optionCount: 1 })).toEqual([0])
  })
})

describe('buildDisplayOrder — permutation validity', () => {
  it('always produces a true permutation, never a lossy or duplicated map', () => {
    // A map that drops or duplicates an index would make one option
    // unselectable and another score for the wrong thing.
    for (let n = 2; n <= 8; n++) {
      for (let p = 0; p < 50; p++) {
        const order = buildDisplayOrder({ ...base, optionCount: n, participantId: `p-${p}` })
        expect(isPermutationOf(order, n)).toBe(true)
      }
    }
  })

  it('supports multiselect as well as mcq', () => {
    const order = buildDisplayOrder({ ...base, questionType: 'multiselect' })
    expect(isPermutationOf(order, 4)).toBe(true)
  })
})

describe('buildDisplayOrder — determinism', () => {
  it('returns the identical order for the same inputs', () => {
    // This is what makes a mid-question refresh or reconnect safe: the
    // catch-up question_show re-derives the same layout the participant
    // started answering.
    const a = buildDisplayOrder(base)
    const b = buildDisplayOrder({ ...base })
    expect(a).toEqual(b)
  })

  it('differs across participants (the whole point of the feature)', () => {
    // With 4 options there are 24 permutations, so a handful of collisions
    // across 40 participants is expected — we assert real spread, not
    // pairwise uniqueness.
    const seen = new Set<string>()
    for (let p = 0; p < 40; p++) {
      seen.add(buildDisplayOrder({ ...base, participantId: `participant-${p}` }).join(','))
    }
    expect(seen.size).toBeGreaterThan(5)
  })

  it('differs across questions for the same participant', () => {
    const seen = new Set<string>()
    for (let q = 0; q < 20; q++) {
      seen.add(buildDisplayOrder({ ...base, questionId: `q-${q}`, questionIndex: q }).join(','))
    }
    expect(seen.size).toBeGreaterThan(3)
  })

  it('still discriminates between questions when ids are missing or duplicated', () => {
    // Legacy rows can share (or lack) a question id; questionIndex is the
    // fallback that stops every question rendering the same permutation.
    const q0 = buildDisplayOrder({ ...base, questionId: null, questionIndex: 0 })
    const q1 = buildDisplayOrder({ ...base, questionId: null, questionIndex: 1 })
    expect(q0).not.toEqual(q1)
  })
})

describe('round-trip translation', () => {
  it('display slot → original → display slot is lossless', () => {
    // The submit path uses toOriginalIndex and the reveal path uses
    // toDisplaySlot. If these ever disagree, participants are told the wrong
    // letter was correct.
    for (let p = 0; p < 30; p++) {
      const order = buildDisplayOrder({ ...base, optionCount: 5, participantId: `p-${p}` })
      const inverse = invertDisplayOrder(order)
      for (let slot = 0; slot < 5; slot++) {
        expect(toDisplaySlot(inverse, toOriginalIndex(order, slot))).toBe(slot)
      }
    }
  })

  it('reordering options by the display order then translating back recovers the original', () => {
    // Mirrors exactly what the participant page does: render
    // displayOrder.map(i => options[i]), then submit the original index.
    const options = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai']
    const order = buildDisplayOrder({ ...base, participantId: 'p-round-trip' })
    const shown = order.map(oi => options[oi])

    shown.forEach((text, displaySlot) => {
      expect(options[toOriginalIndex(order, displaySlot)]).toBe(text)
    })
  })

  it('translation is the identity when shuffling is off', () => {
    const order = buildDisplayOrder({ ...base, enabled: false })
    const inverse = invertDisplayOrder(order)
    for (let i = 0; i < 4; i++) {
      expect(toOriginalIndex(order, i)).toBe(i)
      expect(toDisplaySlot(inverse, i)).toBe(i)
    }
  })

  it('falls back to identity for out-of-range indices instead of returning undefined', () => {
    // A stale reveal arriving after the order state has been reset must not
    // produce NaN option lookups.
    expect(toOriginalIndex([2, 0, 1], 9)).toBe(9)
    expect(toDisplaySlot([2, 0, 1], 9)).toBe(9)
    expect(toOriginalIndex([], 0)).toBe(0)
  })
})

describe('scoring integrity simulation', () => {
  it('two participants with different orders both score correctly on the same answer', () => {
    // End-to-end proof of the core promise: the tiles differ, the score does
    // not. `correctAnswer` is '2' in original space for both.
    const options = ['Alpha', 'Bravo', 'Charlie', 'Delta']
    const correctOriginal = 2

    const pick = (participantId: string) => {
      const order = buildDisplayOrder({ ...base, participantId })
      const shown = order.map(oi => options[oi])
      // Each participant taps the tile showing 'Charlie' — whichever slot that is.
      const tappedSlot = shown.indexOf('Charlie')
      return { order, tappedSlot, submitted: toOriginalIndex(order, tappedSlot) }
    }

    const a = pick('student-a')
    const b = pick('student-b')

    // Both submit the same original index, so checkAnswer marks both correct...
    expect(a.submitted).toBe(correctOriginal)
    expect(b.submitted).toBe(correctOriginal)
    // ...even though at least one of them saw it in a different position than
    // the authored one (guards against a no-op "shuffle" that never permutes).
    expect(
      a.tappedSlot !== correctOriginal || b.tappedSlot !== correctOriginal,
    ).toBe(true)
  })

  it('multiselect answers translate as a set, order-independently', () => {
    const options = ['A', 'B', 'C', 'D']
    const order = buildDisplayOrder({ ...base, questionType: 'multiselect', participantId: 'multi-1' })
    const shown = order.map(oi => options[oi])

    const chosenSlots = [shown.indexOf('B'), shown.indexOf('D')]
    const submitted = chosenSlots
      .map(slot => toOriginalIndex(order, slot))
      .sort((x, y) => x - y)
      .map(String)

    // 'B' and 'D' are original indices 1 and 3 regardless of where they landed.
    expect(submitted).toEqual(['1', '3'])
  })
})

describe('isShuffleableType', () => {
  it('allows only mcq and multiselect', () => {
    expect(isShuffleableType('mcq')).toBe(true)
    expect(isShuffleableType('multiselect')).toBe(true)
    expect(isShuffleableType('truefalse')).toBe(false)
    expect(isShuffleableType('poll')).toBe(false)
    expect(isShuffleableType(undefined)).toBe(false)
    expect(isShuffleableType(null)).toBe(false)
  })
})
