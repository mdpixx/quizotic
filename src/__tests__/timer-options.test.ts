import { describe, it, expect } from 'vitest'
import {
  TIMER_NONE,
  TIMER_MIN_ACTIVE,
  TIMER_MAX,
  clampTimer,
  formatTimer,
} from '@/lib/timer'
import {
  TIMER_OPTIONS,
  defaultTimerForType,
  convertQuestionType,
  makeQuestion,
  hydrateGeneratedQuestions,
} from '@/lib/quiz-builder-logic'
import type { Question } from '@/lib/quiz-types'

describe('clampTimer', () => {
  it('passes legal values through untouched', () => {
    expect(clampTimer(20)).toBe(20)
    expect(clampTimer(45)).toBe(45)
    expect(clampTimer(300)).toBe(300)
  })

  it('treats 0 and negatives as the no-timer sentinel, not as the fallback', () => {
    // Regression guard: callers used to write `Number(x) || 20`, which silently
    // converted a deliberate "no timer" into a 20-second countdown.
    expect(clampTimer(0)).toBe(TIMER_NONE)
    expect(clampTimer(-5)).toBe(TIMER_NONE)
    expect(clampTimer('0')).toBe(TIMER_NONE)
  })

  it('pins active timers into [TIMER_MIN_ACTIVE, TIMER_MAX]', () => {
    expect(clampTimer(1)).toBe(TIMER_MIN_ACTIVE)
    expect(clampTimer(4)).toBe(TIMER_MIN_ACTIVE)
    expect(clampTimer(9999)).toBe(TIMER_MAX)
  })

  it('falls back for non-numeric input', () => {
    expect(clampTimer(undefined)).toBe(20)
    expect(clampTimer('abc', 30)).toBe(30)
    expect(clampTimer(NaN, 60)).toBe(60)
  })

  it('falls back for empty-ish values rather than reading them as no-timer', () => {
    // Number(null) and Number('') are both 0. Without an explicit guard a
    // legacy DB row with NULL timerSeconds would become an untimed question.
    expect(clampTimer(null, 45)).toBe(45)
    expect(clampTimer('', 45)).toBe(45)
    expect(clampTimer('   ', 45)).toBe(45)
    expect(clampTimer(false, 45)).toBe(45)
  })

  it('rounds fractional input', () => {
    expect(clampTimer(20.4)).toBe(20)
    expect(clampTimer(20.6)).toBe(21)
  })

  it('accepts numeric strings from the custom input field', () => {
    expect(clampTimer('150')).toBe(150)
    expect(clampTimer(' 90 ')).toBe(90)
  })
})

describe('formatTimer', () => {
  it('renders sub-minute values in seconds', () => {
    expect(formatTimer(5)).toBe('5s')
    expect(formatTimer(45)).toBe('45s')
  })

  it('renders whole minutes without a trailing 0s', () => {
    expect(formatTimer(60)).toBe('1m')
    expect(formatTimer(300)).toBe('5m')
  })

  it('renders mixed minutes and seconds', () => {
    expect(formatTimer(90)).toBe('1m 30s')
    expect(formatTimer(185)).toBe('3m 5s')
  })

  it('names the no-timer state instead of showing 0s', () => {
    expect(formatTimer(0)).toBe('No timer')
  })
})

describe('TIMER_OPTIONS', () => {
  it('every preset survives its own clamp', () => {
    for (const opt of TIMER_OPTIONS) expect(clampTimer(opt)).toBe(opt)
  })

  it('is sorted ascending and free of duplicates', () => {
    const arr = [...TIMER_OPTIONS]
    expect(arr).toEqual([...arr].sort((a, b) => a - b))
    expect(new Set(arr).size).toBe(arr.length)
  })

  it('offers headroom past the old 60s ceiling', () => {
    // The 60s cap was the tightest in the category and made our own `case`
    // scenario type unanswerable in the time allowed.
    expect(Math.max(...TIMER_OPTIONS)).toBeGreaterThanOrEqual(300)
  })
})

describe('defaultTimerForType', () => {
  it('gives reading-heavy types room to breathe', () => {
    expect(defaultTimerForType('case')).toBeGreaterThanOrEqual(120)
    expect(defaultTimerForType('openended')).toBeGreaterThan(defaultTimerForType('mcq'))
  })

  it('leaves discussion slides untimed', () => {
    expect(defaultTimerForType('qa')).toBe(TIMER_NONE)
    expect(defaultTimerForType('wordcloud')).toBe(TIMER_NONE)
    expect(defaultTimerForType('leaderboard')).toBe(TIMER_NONE)
  })

  it('produces values that survive clamping', () => {
    for (const t of ['mcq', 'case', 'qa', 'truefalse', 'ranking'] as const) {
      expect(clampTimer(defaultTimerForType(t))).toBe(defaultTimerForType(t))
    }
  })
})

describe('makeQuestion', () => {
  it('seeds the per-type default timer', () => {
    expect(makeQuestion({ type: 'case' }).timerSeconds).toBe(defaultTimerForType('case'))
    expect(makeQuestion({ type: 'qa' }).timerSeconds).toBe(TIMER_NONE)
    expect(makeQuestion().timerSeconds).toBe(defaultTimerForType('mcq'))
  })

  it('lets an explicit override win over the type default', () => {
    expect(makeQuestion({ type: 'case', timerSeconds: 30 }).timerSeconds).toBe(30)
  })
})

describe('convertQuestionType', () => {
  it('re-defaults the timer when the host never moved it', () => {
    const q = makeQuestion({ type: 'mcq' })
    expect(convertQuestionType(q, 'case').timerSeconds).toBe(defaultTimerForType('case'))
  })

  it('preserves a hand-tuned timer across a type switch', () => {
    const q = makeQuestion({ type: 'mcq', timerSeconds: 150 })
    expect(convertQuestionType(q, 'case').timerSeconds).toBe(150)
  })

  it('preserves a deliberate no-timer choice', () => {
    const q = makeQuestion({ type: 'mcq', timerSeconds: 0 })
    expect(convertQuestionType(q, 'poll').timerSeconds).toBe(TIMER_NONE)
  })
})

describe('hydrateGeneratedQuestions', () => {
  it('clamps rather than snaps AI timers, so a considered 150s survives', () => {
    const [q] = hydrateGeneratedQuestions([
      { type: 'case', text: 'Scenario', timerSeconds: 150, points: 1000 } as Partial<Question>,
    ])
    expect(q!.timerSeconds).toBe(150)
  })

  it('pins out-of-range AI output into the legal band', () => {
    const [lo, hi] = hydrateGeneratedQuestions([
      { type: 'mcq', text: 'a', timerSeconds: 2 } as Partial<Question>,
      { type: 'mcq', text: 'b', timerSeconds: 5000 } as Partial<Question>,
    ])
    expect(lo!.timerSeconds).toBe(TIMER_MIN_ACTIVE)
    expect(hi!.timerSeconds).toBe(TIMER_MAX)
  })

  it('falls back to the type default when the timer is missing', () => {
    const [q] = hydrateGeneratedQuestions([{ type: 'case', text: 'x' } as Partial<Question>])
    expect(q!.timerSeconds).toBe(defaultTimerForType('case'))
  })
})
