import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HostStagePreview } from '@/components/host/builder/preview/HostStagePreview'
import { ParticipantPreview } from '@/components/host/builder/preview/ParticipantPreview'
import { PHONE_HEIGHT, PHONE_WIDTH, STAGE_HEIGHT, STAGE_WIDTH } from '@/components/host/builder/preview/DeviceFrame'
import type { Question, QuestionType } from '@/lib/quiz-types'

// The builder preview is the only place a host sees their content before going
// live, so a preview that misrepresents the live layout is worse than none —
// hosts author against it. The first version got two things wrong that these
// tests pin down:
//
//   1. It drew participant answers as a 2×2 grid. On a phone the live page
//      (src/app/join/page.tsx) stacks full-width horizontal bars; the quadrant
//      grid appears only at lg+ or in shared-screen mode.
//   2. Its "phone" was a 280×380 box — a tablet aspect — so the frame itself
//      lied about the device.
//
// These render both panes to static markup for every question type: the layout
// contract is asserted directly, and any type that throws fails the suite.

function q(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'mcq',
    text: 'Which pigment absorbs the light energy that drives photosynthesis?',
    options: ['Chlorophyll a', 'Carotene', 'Xanthophyll', 'Anthocyanin'],
    correctAnswer: '0',
    timerSeconds: 20,
    points: 1000,
    ...overrides,
  }
}

const phone = (questions: Question[], index = 0) =>
  renderToStaticMarkup(createElement(ParticipantPreview, { questions, index }))

const stage = (questions: Question[], index = 0, title?: string) =>
  renderToStaticMarkup(createElement(HostStagePreview, { questions, index, title }))

const ALL_TYPES: QuestionType[] = [
  'mcq', 'multiselect', 'truefalse', 'fillblank', 'matching', 'poll', 'openended',
  'wordcloud', 'qa', 'rating', 'ranking', 'case', 'drawing', 'leaderboard',
]

describe('device frames', () => {
  it('models a phone-shaped phone and a 16:9 stage', () => {
    // A phone is much taller than it is wide; the old 280×380 frame (0.74) read
    // as a tablet.
    expect(PHONE_WIDTH / PHONE_HEIGHT).toBeLessThan(0.5)
    expect(STAGE_WIDTH / STAGE_HEIGHT).toBeCloseTo(16 / 9, 3)
  })
})

describe('participant preview matches the live phone layout', () => {
  it('stacks answer options as full-width bars, never a 2-column grid', () => {
    const html = phone([q()])
    expect(html).toContain('flex flex-col gap-2.5')
    expect(html).not.toContain('grid-cols-2')
    // The live bar: horizontal row, 60px floor, round letter badge, text fills.
    expect(html).toContain('min-h-[60px]')
    expect(html).toContain('rounded-full bg-white/25')
  })

  it('paints option tiles with the canonical flat hues the live page uses', () => {
    const html = phone([q()])
    // Flat `background: OPTION_COLORS[i]`, not the host stage's gradient.
    expect(html).toContain('#F23A5C')
    expect(html).toContain('#2D7FF9')
    expect(html).not.toContain('linear-gradient(160deg')
  })

  it('sizes question text for a 390px viewport, not the browser window', () => {
    // .participant-question-text is a vw clamp, which inside a scaled frame
    // would follow the desktop window (30px) instead of the phone (20px).
    expect(phone([q()])).toContain('font-size:20px')
    expect(phone([q({ text: 'x'.repeat(150) })])).toContain('font-size:17.6px')
    expect(phone([q({ text: 'x'.repeat(250) })])).toContain('font-size:15.6px')
  })

  it('omits both countdowns on no-timer questions, like the live page', () => {
    const timed = phone([q({ timerSeconds: 30 })])
    expect(timed).toContain('rgba(15,27,61,0.1)') // linear progress bar
    expect(timed).toContain('<svg') // countdown ring

    // See no-timer-countdown.test.ts: an untimed question has no deadline, so
    // neither the bar nor the ring should appear here either.
    const untimed = phone([q({ timerSeconds: 0 })])
    expect(untimed).not.toContain('rgba(15,27,61,0.1)')
    expect(untimed).not.toContain('#DC2626')
  })

  it('shows a textarea + submit for text types instead of option tiles', () => {
    const html = phone([q({ type: 'openended', options: undefined })])
    expect(html).toContain('Type your answer…')
    expect(html).toContain('min-h-[140px]')
    expect(html).not.toContain('min-h-[60px]')
  })

  it('labels unscored questions Participation and scored ones with their points', () => {
    expect(phone([q({ type: 'poll' })])).toContain('Participation')
    expect(phone([q()])).toContain('1000 pts')
  })
})

describe('host stage preview matches the live Atrium', () => {
  it('renders the three-zone stage: navrail, spotlight, room gauge', () => {
    const html = stage([q()], 0, 'Photosynthesis')
    expect(html).toContain('host-atrium')
    expect(html).toContain('host-navrail')
    expect(html).toContain('host-question-card')
    expect(html).toContain('host-gauge')
    // Answers are the live 2-column options grid, driven by .host-options-stage.
    expect(html).toContain('host-options-stage')
    expect(html).toContain('host-option-tile')
    // Scoped so globals.css can pin the frame's viewport-relative sizes.
    expect(html).toContain('qz-preview-stage')
  })

  it('centres the question in its own spotlight card and shows the quiz title', () => {
    expect(stage([q()], 0, 'Photosynthesis — Class 10')).toContain('Photosynthesis — Class 10')
    expect(stage([q()])).toContain('Untitled quiz')
  })

  it('backfills default options so true/false is not an empty stage', () => {
    const html = stage([q({ type: 'truefalse', options: undefined })])
    expect(html).toContain('True')
    expect(html).toContain('False')
  })

  it('numbers questions the way the live stage does, skipping leaderboard slides', () => {
    const questions = [q(), q({ id: 'l', type: 'leaderboard' }), q({ id: 'q3' })]
    // Third slide is the SECOND answerable question.
    expect(stage(questions, 2)).toContain('>02<')
    expect(stage(questions, 2)).toContain('/ 2')
  })

  it('never invents a live count or a join PIN', () => {
    const html = stage([q()])
    expect(html).toContain('••••••')
    expect(html).toContain('answers in')
    expect(html).not.toContain('of 0 in')
  })
})

describe('every question type renders in both panes', () => {
  for (const type of ALL_TYPES) {
    it(`renders ${type}`, () => {
      const question = q({
        type,
        scenarioText: type === 'case' ? 'A student answers in the final second.' : undefined,
        matchPairs: type === 'matching' ? [{ left: 'Chlorophyll', right: 'Green' }] : undefined,
        blankAnswers: type === 'fillblank' ? ['chlorophyll'] : undefined,
      })
      expect(() => stage([question])).not.toThrow()
      expect(() => phone([question])).not.toThrow()
      expect(stage([question]).length).toBeGreaterThan(0)
      expect(phone([question]).length).toBeGreaterThan(0)
    })
  }
})

// ── Question image panel ────────────────────────────────────────────────────
// The preview is a REPLICA of the live stage, not the live component rendered
// small — transform: scale() creates no new viewport, so every vw/vh value in
// the live stylesheet would resolve against the real browser window and the
// frame would lie. The replica therefore hardcodes what each clamp resolves to
// at 1440×810.
//
// That trade means the two can silently diverge, which is exactly what these
// assert against: the pinned number has to stay equal to the live clamp
// evaluated at the frame height, and the live cap has to exist in both.
describe('question image panel matches the live stage', () => {
  const withImage = q({ imageUrl: 'https://example.com/diagram.png' })

  const livePage = readFileSync(
    join(process.cwd(), 'src/app/host/session/page.tsx'),
    'utf8',
  )
  const replica = readFileSync(
    join(process.cwd(), 'src/components/host/builder/preview/HostStagePreview.tsx'),
    'utf8',
  )

  it('renders an image panel when the question has one', () => {
    const html = stage([withImage])
    expect(html).toContain('https://example.com/diagram.png')
    expect(html).toContain('object-contain')
  })

  it('pins the panel to the live clamp evaluated at the frame height', () => {
    // Live: clamp(120px, 22vh, 220px). At STAGE_HEIGHT this is the middle term.
    const expected = Math.round(0.22 * STAGE_HEIGHT)
    expect(livePage, 'live clamp changed — repin the replica').toContain(
      'clamp(120px, 22vh, 220px)',
    )
    expect(replica, `replica must pin height: ${expected}`).toContain(`height: ${expected}`)
  })

  it('carries the card-cap guard on both sides', () => {
    // The live panel is bound to the card's own content box because the clamp
    // is viewport-relative while the card cap is a percentage of the stage.
    // Without it a 1024×768 projector clipped the panel out of the card.
    for (const [name, src] of [['live stage', livePage], ['preview replica', replica]] as const) {
      expect(src, `${name} must cap the image panel to the card`).toMatch(/maxHeight: '100%'/)
    }
  })

  it('keeps the panel inside the preview card at the frame size', () => {
    // Card cap is 34% of the stage, less 34px padding top and bottom.
    const cardContentBox = 0.34 * STAGE_HEIGHT - 2 * 34
    expect(Math.round(0.22 * STAGE_HEIGHT)).toBeLessThan(cardContentBox)
  })
})
