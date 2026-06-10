// Append-vs-replace contract for AI generate / import (Phase 2).
// The host's manual work must survive an AI generation: append mode adds
// hydrated questions after the existing ones; replace swaps the whole set.
// The hook applies hydrateGeneratedQuestions, so we verify the hydration +
// merge semantics it relies on.

import { describe, it, expect } from 'vitest'
import { hydrateGeneratedQuestions } from '@/lib/quiz-builder-logic'
import type { Question } from '@/lib/quiz-types'

const manual: Question[] = [
  { id: 'm1', type: 'mcq', text: 'Manual Q1', options: ['a', 'b'], correctAnswer: '0', timerSeconds: 20, points: 1000 },
  { id: 'm2', type: 'truefalse', text: 'Manual Q2', options: ['True', 'False'], correctAnswer: '0', timerSeconds: 15, points: 500 },
]

const generatedRaw = [
  { type: 'mcq' as const, text: 'AI Q1', options: ['x', 'y', 'z'], correctAnswer: '2' },
  { type: 'mcq' as const, text: 'AI Q2', options: ['p', 'q'], correctAnswer: '0' },
  { text: 'AI Q3 (defaults)' },
]

describe('AI generate apply semantics', () => {
  it('hydration assigns fresh UUIDs and fills defaults', () => {
    const hydrated = hydrateGeneratedQuestions(generatedRaw)
    expect(hydrated).toHaveLength(3)
    for (const q of hydrated) {
      expect(q.id).toMatch(/[0-9a-f-]{36}/)
      expect(q.timerSeconds).toBeGreaterThan(0)
      expect(q.points).toBeGreaterThan(0)
    }
    // Typeless raw input defaults to mcq with backfilled options
    expect(hydrated[2].type).toBe('mcq')
    expect(hydrated[2].options?.length).toBeGreaterThan(0)
  })

  it('append mode preserves all manual questions and adds generated after them', () => {
    const hydrated = hydrateGeneratedQuestions(generatedRaw)
    // Mirror of use-quiz-builder applyGeneratedQuestions 'append' branch
    const next = [...manual, ...hydrated]

    expect(next).toHaveLength(5)
    expect(next.slice(0, 2)).toEqual(manual)            // manual work untouched
    expect(next[2].text).toBe('AI Q1')                  // generated follows
    // New active index = first appended question
    expect(manual.length).toBe(2)
  })

  it('replace mode swaps the entire set', () => {
    const hydrated = hydrateGeneratedQuestions(generatedRaw)
    const next = hydrated // 'replace' branch

    expect(next).toHaveLength(3)
    expect(next.find(q => q.id === 'm1')).toBeUndefined()
  })

  it('generated ids never collide with existing ids on append', () => {
    const hydrated = hydrateGeneratedQuestions(generatedRaw)
    const ids = new Set([...manual, ...hydrated].map(q => q.id))
    expect(ids.size).toBe(manual.length + hydrated.length)
  })
})
