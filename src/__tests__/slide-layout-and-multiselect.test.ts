// Slide layout resolution and multi-select limits.
//
// Both fields are optional additions to shapes that already exist in every
// saved presentation, so the load-bearing property is what happens when they
// are ABSENT: a deck authored before either existed must render and behave
// exactly as it did. These tests pin that, then the clamping that stops a
// malformed or tampered value from producing a nonsense slide.

import { describe, it, expect } from 'vitest'
import { getMaxSelections, isMultiSelect, makeSlide, SLIDE_TYPE_META } from '../lib/presentation-types'
import type { SlideType } from '../lib/presentation-types'
import {
  getSlideLayout,
  layoutHasMediaColumn,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_META,
} from '../components/presentation/SlideFrame'

describe('getSlideLayout', () => {
  it('defaults to centre when the field is absent', () => {
    // Every presentation saved before the layout field existed.
    expect(getSlideLayout(undefined)).toBe('centre')
    expect(getSlideLayout({})).toBe('centre')
  })

  it('every slide type a factory produces defaults to centre', () => {
    const types = Object.keys(SLIDE_TYPE_META) as SlideType[]
    for (const type of types) {
      expect(getSlideLayout(makeSlide(type))).toBe('centre')
    }
  })

  it('returns the stored layout when valid', () => {
    for (const layout of SLIDE_LAYOUTS) {
      expect(getSlideLayout({ layout })).toBe(layout)
    }
  })

  it('falls back to centre on an unrecognised value', () => {
    // A hand-edited or future-version deck must not render blank.
    expect(getSlideLayout({ layout: 'diagonal' as never })).toBe('centre')
    expect(getSlideLayout({ layout: '' as never })).toBe('centre')
  })

  it('labels every layout it offers', () => {
    for (const layout of SLIDE_LAYOUTS) {
      expect(SLIDE_LAYOUT_META[layout].label).toBeTruthy()
      expect(SLIDE_LAYOUT_META[layout].hint).toBeTruthy()
    }
  })

  it('marks only the non-centre layouts as having a media column', () => {
    expect(layoutHasMediaColumn('centre')).toBe(false)
    expect(layoutHasMediaColumn('content-left')).toBe(true)
    expect(layoutHasMediaColumn('content-right')).toBe(true)
    expect(layoutHasMediaColumn('image-split')).toBe(true)
  })
})

describe('getMaxSelections', () => {
  const options = ['A', 'B', 'C', 'D']

  it('is single-select when the field is absent', () => {
    expect(getMaxSelections({ options })).toBe(1)
    expect(isMultiSelect({ options })).toBe(false)
  })

  it('treats 0, 1 and negatives as single-select', () => {
    // Nothing should ever produce a slide nobody can answer.
    expect(getMaxSelections({ options, maxSelections: 1 })).toBe(1)
    expect(getMaxSelections({ options, maxSelections: 0 })).toBe(1)
    expect(getMaxSelections({ options, maxSelections: -3 })).toBe(1)
  })

  it('ignores non-finite values rather than propagating NaN', () => {
    expect(getMaxSelections({ options, maxSelections: NaN })).toBe(1)
    expect(getMaxSelections({ options, maxSelections: Infinity })).toBe(1)
    expect(getMaxSelections({ options, maxSelections: undefined })).toBe(1)
  })

  it('never exceeds the number of options', () => {
    // Deleting options after setting a limit must not leave "choose up to 6"
    // on a three-option slide.
    expect(getMaxSelections({ options, maxSelections: 9 })).toBe(4)
    expect(getMaxSelections({ options: ['A', 'B'], maxSelections: 5 })).toBe(2)
  })

  it('floors fractional values', () => {
    expect(getMaxSelections({ options, maxSelections: 2.9 })).toBe(2)
  })

  it('survives a missing options array', () => {
    expect(getMaxSelections({ maxSelections: 3 })).toBe(1)
    expect(getMaxSelections({})).toBe(1)
  })

  it('reports multi-select only above one', () => {
    expect(isMultiSelect({ options, maxSelections: 2 })).toBe(true)
    expect(isMultiSelect({ options, maxSelections: 1 })).toBe(false)
    expect(isMultiSelect({ options: ['A'], maxSelections: 3 })).toBe(false)
  })
})

describe('multi-select aggregate arithmetic', () => {
  // Mirrors the server's invariant: `total` counts respondents, `counts`
  // counts picks. The response-progress denominator and the percentage both
  // depend on that, so it is asserted here rather than left as a comment.
  it('lets counts sum above the respondent total', () => {
    const total = 5
    const counts = [4, 3, 5, 3] // 15 picks from 5 people, up to 3 each
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(total)

    const percentages = counts.map(c => Math.round((c / total) * 100))
    expect(percentages).toEqual([80, 60, 100, 60])
    expect(percentages.reduce((a, b) => a + b, 0)).toBeGreaterThan(100)
    // Each option's share is still a sane 0–100 figure.
    for (const p of percentages) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })
})
