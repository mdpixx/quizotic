// Motion vocabulary for the presentation stage (src/lib/motion.ts).
//
// These tokens exist so the stage stops reading as several UIs sharing a
// screen. The tests below pin the two things that actually cause regressions:
// the reduced-motion collapse (an accessibility guarantee, easy to bypass by
// passing a raw spec straight to Framer Motion), and the stagger cap (without
// it a 200-pin grid is still placing dots eight seconds after the slide opens).

import { describe, it, expect } from 'vitest'
import {
  DUR,
  EASE,
  STAGGER,
  sec,
  cssTransition,
  motionSafe,
  toTransition,
  staggerDelay,
} from '../lib/motion'

describe('duration + easing tokens', () => {
  it('orders durations from shortest to longest', () => {
    const ordered = [DUR.instant, DUR.quick, DUR.base, DUR.slow, DUR.entrance]
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b))
  })

  it('gives every easing four control points', () => {
    for (const [name, curve] of Object.entries(EASE)) {
      expect(curve, name).toHaveLength(4)
    }
  })

  it('is the only easing that overshoots: spring', () => {
    // Control points are (x1, y1, x2, y2); a y outside [0,1] is what carries
    // the curve past its endpoint. Entrances must NOT overshoot — a question
    // sliding in and bouncing back is the opposite of calm.
    const overshoots = Object.entries(EASE)
      .filter(([, [, y1, , y2]]) => y1 > 1 || y2 > 1)
      .map(([name]) => name)
    expect(overshoots).toEqual(['spring'])
  })

  it('converts milliseconds to seconds for Framer Motion', () => {
    expect(sec(DUR.base)).toBeCloseTo(0.32)
  })
})

describe('cssTransition', () => {
  it('emits a usable shorthand with the named curve', () => {
    expect(cssTransition('width', 'slow', 'spring')).toBe(
      'width 520ms cubic-bezier(0.34,1.56,0.64,1)',
    )
  })

  it('defaults to base duration and the entrance easing', () => {
    expect(cssTransition('opacity')).toBe('opacity 320ms cubic-bezier(0.22,1,0.36,1)')
  })
})

describe('motionSafe', () => {
  const spec = { duration: DUR.entrance, ease: EASE.spring, stagger: STAGGER.loose }

  it('passes the spec through untouched when motion is allowed', () => {
    expect(motionSafe(false, spec)).toBe(spec)
  })

  it('caps duration at 150ms under reduced motion', () => {
    expect(motionSafe(true, spec).duration).toBe(150)
  })

  it('never lengthens an already-short animation', () => {
    expect(motionSafe(true, { duration: DUR.instant, ease: EASE.out }).duration).toBe(DUR.instant)
  })

  it('drops the stagger — many elements moving at once is the actual problem', () => {
    expect(motionSafe(true, spec).stagger).toBeUndefined()
  })

  it('never collapses to zero — results appearing with no transition reads as broken', () => {
    expect(motionSafe(true, spec).duration).toBeGreaterThan(0)
  })

  it('swaps the overshooting curve for a neutral one', () => {
    expect(motionSafe(true, spec).ease).toBe(EASE.calm)
  })
})

describe('staggerDelay', () => {
  it('spaces early items by the step', () => {
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(3, STAGGER.base)).toBe(210)
  })

  it('caps the tail so a large result set still lands promptly', () => {
    // 200 pins × 40ms would be 8s without the cap.
    expect(staggerDelay(200)).toBe(400)
  })

  it('is monotonic up to the cap', () => {
    const delays = Array.from({ length: 40 }, (_, i) => staggerDelay(i))
    expect(delays).toEqual([...delays].sort((a, b) => a - b))
  })
})

describe('toTransition', () => {
  it('produces a Framer Motion transition in seconds', () => {
    expect(toTransition({ duration: DUR.slow, ease: EASE.out })).toEqual({
      duration: 0.52,
      ease: EASE.out,
    })
  })
})
