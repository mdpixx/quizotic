// Intent tiers. Design spec §2.
//
// The tier is the volume control for the whole system: Tier 0 is 40-60% of
// signups and is never nudged, which is the single largest protection for the
// sending domain. If this computation drifts loose, send volume climbs and
// the reputation the two-channel split exists to protect erodes.

import { describe, expect, it } from 'vitest'
import { computeTier, hasActivated, TIER, type TierSignals } from '../lib/lifecycle/tiers'

const HOUR = 60 * 60 * 1000
const signup = new Date('2026-07-01T10:00:00Z')

const signals = (over: Partial<TierSignals> = {}): TierSignals => ({
  onboarded: false,
  createdAt: signup,
  lastActiveAt: signup,
  quizCount: 0,
  hostedSessionCount: 0,
  ...over,
})

describe('tier computation', () => {
  it('treats a signup that never came back as a ghost', () => {
    expect(computeTier(signals())).toBe(TIER.GHOST)
  })

  it('does not count activity in the signup session as a return visit', () => {
    // Finishing signup takes minutes and lastActiveAt is debounce-updated
    // during it. Counting that as "came back" would promote every ghost to
    // Explorer and roughly double send volume.
    expect(computeTier(signals({ lastActiveAt: new Date(signup.getTime() + 3 * HOUR) }))).toBe(
      TIER.GHOST,
    )
  })

  it('promotes to explorer once they genuinely return', () => {
    expect(computeTier(signals({ lastActiveAt: new Date(signup.getTime() + 25 * HOUR) }))).toBe(
      TIER.EXPLORER,
    )
  })

  it('promotes to explorer on completed onboarding alone', () => {
    expect(computeTier(signals({ onboarded: true }))).toBe(TIER.EXPLORER)
  })

  it('promotes to builder on a quiz, even without a return visit', () => {
    expect(computeTier(signals({ quizCount: 1 }))).toBe(TIER.BUILDER)
  })

  it('only reaches host when somebody actually showed up', () => {
    // A lobby opened and closed alone is not activation. Treating it as such
    // would silence exactly the person most worth reaching.
    expect(computeTier(signals({ quizCount: 1, hostedSessionCount: 0 }))).toBe(TIER.BUILDER)
    expect(computeTier(signals({ quizCount: 1, hostedSessionCount: 1 }))).toBe(TIER.HOST)
  })

  it('ranks a hosted session above everything else', () => {
    expect(computeTier(signals({ onboarded: false, quizCount: 0, hostedSessionCount: 2 }))).toBe(
      TIER.HOST,
    )
  })

  it('treats only tier 3 as activated', () => {
    expect(hasActivated(TIER.HOST)).toBe(true)
    for (const t of [TIER.GHOST, TIER.EXPLORER, TIER.BUILDER]) {
      expect(hasActivated(t)).toBe(false)
    }
  })
})
