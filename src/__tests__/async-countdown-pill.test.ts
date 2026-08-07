// Self-paced time-limit countdown (src/components/async/CountdownPill.tsx).
//
// Two participant-visible defects are pinned here, both reported from live use:
//
// 1. The top bar shifted sideways on every tick. The pill sits in a flex row
//    beside a `flex-1` progress track, and its text used to change character
//    count as it counted down — "14:59" → "9:59" → "59s". Each change resized
//    the pill, the track absorbed the difference, and the whole row moved. The
//    fix is a constant-width MM:SS, so the assertions below are about the
//    LENGTH of the rendered string, not its value.
//
// 2. Seconds ticked unevenly. The pill polled with setInterval(500) and the
//    poll phase drifted against the true second boundary, so some seconds
//    flashed by in ~500ms and others lingered ~1500ms. It now runs on the
//    shared boundary-scheduled engine (src/lib/countdown.ts), which wakes at
//    the exact instant the digit changes. That cadence is covered by
//    countdown.test.ts; what is asserted here is that the pill actually routes
//    through the engine rather than reintroducing a poll.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CountdownPill, formatClock } from '@/components/async/CountdownPill'

/** The digits the pill renders, stripped of markup and the ⏱ glyph. */
function clockText(markup: string): string {
  const text = markup.replace(/<[^>]*>/g, '')
  const match = text.match(/\d[\d:]*\d/)
  return match ? match[0] : text
}

function renderAt(secondsLeft: number): string {
  return renderToStaticMarkup(
    createElement(CountdownPill, { deadlineAt: Date.now() + secondsLeft * 1000, onExpire: () => {} }),
  )
}

describe('formatClock', () => {
  it('is always MM:SS — the same character count at every value', () => {
    const samples = [899, 599, 60, 47, 5, 0].map(formatClock)
    expect(samples).toEqual(['14:59', '09:59', '01:00', '00:47', '00:05', '00:00'])
    expect(new Set(samples.map(s => s.length))).toEqual(new Set([5]))
  })

  it('lets minutes run past 99 rather than truncating a long limit', () => {
    expect(formatClock(120 * 60 + 7)).toBe('120:07')
  })

  it('floors to zero for expired, negative and non-finite input', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-30)).toBe('00:00')
    expect(formatClock(NaN)).toBe('00:00')
  })
})

describe('CountdownPill rendering', () => {
  it('renders the same number of characters at every remaining time', () => {
    // The exact defect: "14:59" (5) → "9:59" (4) → "59s" (3) resized the pill
    // and reflowed the top bar once a second.
    const lengths = [899, 599, 47, 5].map(s => clockText(renderAt(s)).length)
    expect(new Set(lengths)).toEqual(new Set([5]))
    expect(clockText(renderAt(899))).toMatch(/^\d{2,}:\d{2}$/)
    expect(clockText(renderAt(47))).toBe('00:47')
  })

  it('reserves width and refuses to shrink inside the flex row', () => {
    const markup = renderAt(599)
    expect(markup).toContain('tabular-nums')
    expect(markup).toContain('min-w-[5ch]')
    expect(markup).toContain('shrink-0')
  })

  it('still goes red under a minute', () => {
    expect(renderAt(599)).not.toContain('bg-red-500')
    expect(renderAt(47)).toContain('bg-red-500')
    expect(renderAt(47)).toContain('animate-pulse')
  })

  it('applies the server clock offset to the first paint', () => {
    // Deadline 60s out in SERVER time, on a device whose clock runs 30s slow:
    // the participant has 30s left, not 60.
    const markup = renderToStaticMarkup(
      createElement(CountdownPill, {
        deadlineAt: Date.now() + 60_000,
        nowOffsetMs: 30_000,
        onExpire: () => {},
      }),
    )
    expect(clockText(markup)).toBe('00:30')
  })
})

describe('CountdownPill implementation', () => {
  const raw = readFileSync(new URL('../components/async/CountdownPill.tsx', import.meta.url), 'utf8')
  // Comments here describe the old polling bug by name, so match on code only.
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('drives the clock from the shared boundary engine, not a poll', () => {
    expect(source).toContain('startBoundaryCountdown')
    expect(source).not.toContain('setInterval')
  })

  it('keeps onExpire in a ref so the timer is not torn down mid-quiz', () => {
    // onExpire is a useCallback keyed on the page's `phase`; as an effect
    // dependency it restarted the countdown on every question → feedback step,
    // resetting the tick phase each time.
    expect(source).toContain('onExpireRef')
    expect(source).toMatch(/}, \[deadlineAt, clock\]\)/)
  })
})
