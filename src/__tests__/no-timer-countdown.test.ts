import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircularTimer } from '@/components/CircularTimer'
import { MobileTopBar, StageRail } from '@/components/join/ParticipantChrome'

// A question authored with `timerSeconds: 0` ("No timer") has no deadline: the
// host advances manually. The countdown ring used to render anyway, and because
// `timeLeft` of 0 trips the `isLow` urgency ramp (<= 5s) it painted a RED,
// pulsing "0" the instant the question opened — participants read that as "time
// is up" before they had answered. The participant's linear progress bar and the
// host's room gauge both already omit themselves for no-timer questions, so the
// ring was the odd one out.

describe('CircularTimer with no timer', () => {
  it('renders nothing when the question has no timer', () => {
    expect(renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 0, total: 0 }))).toBe('')
  })

  it('renders nothing for a nonsensical negative or NaN duration', () => {
    expect(renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 0, total: -5 }))).toBe('')
    expect(renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 0, total: NaN }))).toBe('')
  })

  it('still renders — and still goes red — for a real timer running out', () => {
    const running = renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 20, total: 30 }))
    expect(running).toContain('<svg')
    expect(running).not.toContain('#DC2626')
    expect(running).not.toContain('animate-pulse')

    const expiring = renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 3, total: 30 }))
    expect(expiring).toContain('#DC2626')
    expect(expiring).toContain('animate-pulse')

    // Zero on a question that DID have a timer is genuinely "time up" — the red
    // ring belongs there.
    const done = renderToStaticMarkup(createElement(CircularTimer, { timeLeft: 0, total: 30 }))
    expect(done).toContain('#DC2626')
  })
})

const railProps = {
  points: 1000,
  questionNumber: 1,
  questionTotal: 5,
  isScored: true,
  soundMuted: false,
  onToggleSound: () => {},
  connectionState: 'connected' as const,
}

const barProps = {
  archetype: 'Storm Tiger',
  team: null,
  totalScore: 0,
  streak: 0,
  soundMuted: false,
  onToggleSound: () => {},
}

describe('participant chrome with no timer', () => {
  it('drops the desktop rail countdown and its seconds caption', () => {
    const timed = renderToStaticMarkup(createElement(StageRail, { ...railProps, timeLeft: 30, total: 30 }))
    expect(timed).toContain('30 seconds')

    const untimed = renderToStaticMarkup(createElement(StageRail, { ...railProps, timeLeft: 0, total: 0 }))
    expect(untimed).not.toContain('seconds')
    expect(untimed).not.toContain('<svg')
    // The rest of the rail still stands — only the timer block goes.
    expect(untimed).toContain('Question')
    expect(untimed).toContain('Worth')
  })

  it('drops the mobile top-bar countdown but keeps identity and sound', () => {
    const untimed = renderToStaticMarkup(createElement(MobileTopBar, { ...barProps, timeLeft: 0, total: 0 }))
    expect(untimed).not.toContain('#DC2626')
    expect(untimed).toContain('Storm Tiger')
    expect(untimed).toContain('Mute sounds')

    expect(renderToStaticMarkup(createElement(MobileTopBar, { ...barProps, timeLeft: 20, total: 30 })))
      .toContain('<svg')
  })
})
