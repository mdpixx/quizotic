// Builder option add/remove remapping — guards against two silent-corruption
// bugs found in review:
//   1. Removing an option did not remap correctAnswer/correctAnswers, so the
//      correct answer silently shifted to a neighbouring option.
//   2. Adding an item to a scored-sequence ranking did not extend correctOrder,
//      so options.length ≠ correctOrder.length made the question unwinnable
//      (scoreRanking's all-positions check failed for every submission).

import { describe, it, expect } from 'vitest'
import { addOptionPatch, removeOptionPatch } from '../lib/quiz-builder-logic'
import type { Question } from '../lib/quiz-types'

function makeQ(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    type: 'mcq',
    text: 'Test?',
    options: ['A', 'B', 'C', 'D'],
    timerSeconds: 20,
    points: 1000,
    ...overrides,
  }
}

describe('removeOptionPatch — mcq correctAnswer remap', () => {
  it('shifts correctAnswer down when an option BEFORE it is removed', () => {
    const q = makeQ({ correctAnswer: '2' })
    const patch = removeOptionPatch(q, 0)!
    expect(patch.options).toEqual(['B', 'C', 'D'])
    expect(patch.correctAnswer).toBe('1')
  })

  it('clears correctAnswer when the correct option itself is removed', () => {
    const q = makeQ({ correctAnswer: '1' })
    const patch = removeOptionPatch(q, 1)!
    expect(patch.options).toEqual(['A', 'C', 'D'])
    expect('correctAnswer' in patch).toBe(true)
    expect(patch.correctAnswer).toBeUndefined()
  })

  it('leaves correctAnswer alone when an option AFTER it is removed', () => {
    const q = makeQ({ correctAnswer: '1' })
    const patch = removeOptionPatch(q, 3)!
    expect(patch.options).toEqual(['A', 'B', 'C'])
    expect('correctAnswer' in patch).toBe(false)
  })

  it('returns null at the 2-option floor', () => {
    const q = makeQ({ options: ['A', 'B'], correctAnswer: '0' })
    expect(removeOptionPatch(q, 1)).toBeNull()
  })
})

describe('removeOptionPatch — multiselect correctAnswers remap', () => {
  it('drops the removed index and shifts the ones above it', () => {
    const q = makeQ({ type: 'multiselect', correctAnswers: ['0', '2', '3'] })
    const patch = removeOptionPatch(q, 2)!
    expect(patch.options).toEqual(['A', 'B', 'D'])
    expect(patch.correctAnswers).toEqual(['0', '2'])
  })

  it('keeps lower indices untouched when a higher option is removed', () => {
    const q = makeQ({ type: 'multiselect', correctAnswers: ['0', '1'] })
    const patch = removeOptionPatch(q, 3)!
    expect(patch.correctAnswers).toEqual(['0', '1'])
  })
})

describe('scored-sequence ranking — correctOrder stays length-matched', () => {
  it('addOptionPatch extends correctOrder with the new slot', () => {
    const q = makeQ({ type: 'ranking', options: ['X', 'Y', 'Z'], correctOrder: ['0', '1', '2'] })
    const patch = addOptionPatch(q)!
    expect(patch.options).toHaveLength(4)
    expect(patch.correctOrder).toEqual(['0', '1', '2', '3'])
  })

  it('addOptionPatch leaves consensus (non-scored) ranking without correctOrder', () => {
    const q = makeQ({ type: 'ranking', options: ['X', 'Y', 'Z'] })
    const patch = addOptionPatch(q)!
    expect(patch.options).toHaveLength(4)
    expect('correctOrder' in patch).toBe(false)
  })

  it('removeOptionPatch rebuilds correctOrder to the new length', () => {
    const q = makeQ({ type: 'ranking', options: ['X', 'Y', 'Z', 'W'], correctOrder: ['0', '1', '2', '3'] })
    const patch = removeOptionPatch(q, 1)!
    expect(patch.options).toEqual(['X', 'Z', 'W'])
    expect(patch.correctOrder).toEqual(['0', '1', '2'])
  })

  it('addOptionPatch returns null at the 6-option cap', () => {
    const q = makeQ({ options: ['1', '2', '3', '4', '5', '6'] })
    expect(addOptionPatch(q)).toBeNull()
  })
})
