// The builder allows up to 6 options (QuestionCanvas handleAddOption), so the
// canonical palette must cover every index without falling back — a short
// palette silently renders duplicate tiles (the pre-fix bug: option 6 showed
// as a second red "A").

import { describe, it, expect } from 'vitest'
import { ANSWER_COLORS, ANSWER_LETTERS, colorForIndex } from '@/lib/answer-colors'

const BUILDER_MAX_OPTIONS = 6

describe('ANSWER_COLORS palette', () => {
  it('covers the builder max option count', () => {
    expect(ANSWER_COLORS.length).toBeGreaterThanOrEqual(BUILDER_MAX_OPTIONS)
  })

  it('has unique letters and unique hues', () => {
    expect(new Set(ANSWER_LETTERS).size).toBe(ANSWER_COLORS.length)
    expect(new Set(ANSWER_COLORS.map(c => c.hex)).size).toBe(ANSWER_COLORS.length)
  })

  it('every entry carries the full render shape', () => {
    for (const c of ANSWER_COLORS) {
      expect(c.letter).toMatch(/^[A-Z]$/)
      for (const hex of [c.hex, c.hexLight, c.hexDark, c.tint]) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
      expect(c.glow).toMatch(/^rgba\(/)
      expect(c.tw).toContain('bg-')
    }
  })

  it('colorForIndex resolves every builder index directly (no wraparound)', () => {
    for (let i = 0; i < BUILDER_MAX_OPTIONS; i++) {
      expect(colorForIndex(i)).toBe(ANSWER_COLORS[i])
    }
  })
})
