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

// The digits were `text-white` on both variants, so on the participant's white
// card they rendered white-on-white (measured 1:1 contrast in the browser) and
// were legible only through the drop shadow's blur.
describe('CircularTimer digit legibility', () => {
  const render = (variant: 'light' | 'dark', timeLeft: number) =>
    renderToStaticMarkup(createElement(CircularTimer, { timeLeft, total: 30, variant }))

  it('paints light-variant digits navy, not white, and drops the shadow', () => {
    const html = render('light', 20)
    expect(html).toContain('color:#0F1B3D')
    expect(html).not.toContain('text-white')
    expect(html).not.toContain('text-shadow')
  })

  it('keeps white digits and the shadow on the host stage', () => {
    const html = render('dark', 20)
    expect(html).toContain('color:#FFFFFF')
    expect(html).toContain('text-shadow')
  })

  it('uses urgency hues that survive their own background', () => {
    // amber-700 on white (4.9:1) rather than amber-500 (2.1:1, below the 3:1
    // floor for large bold text).
    expect(render('light', 8)).toContain('color:#B45309')
    expect(render('light', 3)).toContain('color:#DC2626')
    // Dark keeps the hues it already shipped — the host stage is unchanged.
    expect(render('dark', 8)).toContain('color:#F59E0B')
    expect(render('dark', 3)).toContain('color:#EF4444')
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
