// The NudgeCard component. Design spec §4.
//
// There is no DOM test environment in this project (vitest runs in 'node' and
// jsdom is not a dependency), so this asserts on the source rather than a
// render. That is a weaker check than mounting the component, and it is chosen
// deliberately over adding a test-only browser environment for one card.
//
// What it does cover is the part that is not visual: the card is the mechanism
// that suppresses the email version, so the properties below are load-bearing
// rather than cosmetic.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAMPAIGN_KEYS } from '../lib/lifecycle/campaigns'
import { NUDGE_CARDS } from '../lib/lifecycle/cards'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const CARD = read('src/components/host/NudgeCard.tsx')
const PROVEN = read('src/components/host/CompleteProfileCard.tsx')

describe('nudge card copy', () => {
  it('has copy for every campaign, and no orphans', () => {
    // A campaign with no card would render a blank box on the dashboard; a
    // card with no campaign is dead weight nobody will ever see.
    expect(Object.keys(NUDGE_CARDS).sort()).toEqual([...CAMPAIGN_KEYS].sort())
  })

  it('gives every card a destination inside the app', () => {
    for (const [key, card] of Object.entries(NUDGE_CARDS)) {
      expect(card.ctaHref, key).toMatch(/^\//)
      expect(card.title.length, key).toBeGreaterThan(0)
      expect(card.ctaLabel.length, key).toBeGreaterThan(0)
    }
  })

  it('keeps the card shorter than the email it replaces', () => {
    // The card is read by someone already looking at their dashboard. Saying
    // as much as the email would make it feel like an ad.
    for (const [key, card] of Object.entries(NUDGE_CARDS)) {
      expect(card.body.length, `${key} body`).toBeLessThan(180)
    }
  })
})

describe('nudge card behaviour', () => {
  it('reports the sighting on mount, not on interaction', () => {
    // This is what stops the email: the worker only mails a nudge whose
    // shownAt is still null after 48h. If the card only reported on click,
    // active users would receive onboarding mail about a card they saw.
    expect(CARD).toMatch(/useEffect/)
    expect(CARD).toMatch(/'shown'/)
  })

  it('renders nothing when there is no nudge', () => {
    // A nudge is the least important thing on the dashboard and must never
    // be able to break it.
    expect(CARD).toMatch(/if \(!nudge\) return null/)
  })

  it('swallows every fetch failure', () => {
    // Two try/catch blocks: the load and the transition. Neither may throw
    // into the dashboard's render tree.
    expect(CARD.match(/catch\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('offers both a dismiss control and a CTA', () => {
    expect(CARD).toMatch(/'dismissed'/)
    expect(CARD).toMatch(/'acted'/)
    expect(CARD).toMatch(/aria-label="Dismiss"/)
  })
})

describe('visual consistency with the proven dashboard card', () => {
  // The card sits in the same band as CompleteProfileCard, which is already
  // live on this dashboard. Reusing its exact container and control styling is
  // what keeps a new card from looking bolted on — and pinning it here is what
  // this suite can check that a screenshot cannot: that they stay in step.
  const shared = [
    'rounded-2xl border p-4',
    "background: '#FFFDF0'",
    "borderColor: '#F1E9A8'",
    "background: '#0F1B3D', color: '#fff'",
    'aria-label="Dismiss"',
  ]

  for (const token of shared) {
    it(`matches the existing dashboard card on: ${token}`, () => {
      expect(PROVEN).toContain(token)
      expect(CARD).toContain(token)
    })
  }
})

describe('dashboard wiring', () => {
  const PAGE = read('src/app/host/(dashboard)/page.tsx')

  it('is mounted on the host dashboard', () => {
    expect(PAGE).toMatch(/import \{ NudgeCard \}/)
    expect(PAGE).toMatch(/<NudgeCard \/>/)
  })
})
