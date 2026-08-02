// Session awards — the end-of-quiz recognition engine.
//
// Unlike most UI in this project, this one is genuinely testable by CALLING it:
// src/lib/awards.mjs is pure (no Socket.io, no Next, no DB), extracted from
// server.mjs for exactly that reason — same rationale as session-state.mjs.
//
// The behaviour that matters most is the ALLOCATION. Computed as independent
// thresholds, the top scorer wins Flawless and Quickest and On Fire and Went
// the Distance — one person celebrated four times, three fewer faces named,
// and the whole point of the feature (recognising people who aren't on the
// podium) is lost. The first describe block is the guard on that.

import { describe, expect, it } from 'vitest'
import { computeSessionAwards, summariseParticipant } from '../lib/awards.mjs'

type AnswerFixture = { isCorrect: boolean; timeMs: number; points?: number }

function p(
  name: string,
  answers: (AnswerFixture | undefined)[],
  extra: Record<string, unknown> = {},
) {
  const score = answers.reduce((s, a) => s + (a?.points ?? (a?.isCorrect ? 1000 : 0)), 0)
  return {
    participantId: `pid-${name}`,
    name,
    archetype: `arch-${name}`,
    score,
    answers,
    ...extra,
  }
}

/** Builds the plain input object the engine takes (never a live session). */
function input(
  entries: [string, ReturnType<typeof p>][],
  overrides: Record<string, unknown> = {},
) {
  return {
    participants: new Map(entries),
    totalQuestions: 5,
    anonymousMode: false,
    sessionMode: 'competitive' as const,
    ...overrides,
  }
}

const ALL_RIGHT_FAST = [
  { isCorrect: true, timeMs: 900 },
  { isCorrect: true, timeMs: 900 },
  { isCorrect: true, timeMs: 900 },
  { isCorrect: true, timeMs: 900 },
  { isCorrect: true, timeMs: 900 },
]

describe('award allocation spreads across distinct people', () => {
  // `ace` independently wins Flawless, On Fire, Quickest AND Went the Distance.
  // The others are weaker on every axis but still qualify for something.
  const ace = p('ace', ALL_RIGHT_FAST)
  const bea = p('bea', [
    { isCorrect: true, timeMs: 3000 },
    { isCorrect: true, timeMs: 3000 },
    { isCorrect: true, timeMs: 3000 },
    { isCorrect: false, timeMs: 3000 },
    { isCorrect: true, timeMs: 3000 },
  ])
  const cal = p('cal', [
    { isCorrect: true, timeMs: 5000 },
    { isCorrect: false, timeMs: 5000 },
    { isCorrect: true, timeMs: 5000 },
    { isCorrect: false, timeMs: 5000 },
    { isCorrect: false, timeMs: 5000 },
  ])
  const dev = p('dev', [
    { isCorrect: false, timeMs: 7000 },
    { isCorrect: false, timeMs: 7000 },
    { isCorrect: true, timeMs: 7000 },
    { isCorrect: false, timeMs: 7000 },
    { isCorrect: false, timeMs: 7000 },
  ])

  const { classAwards } = computeSessionAwards(
    input([['s1', ace], ['s2', bea], ['s3', cal], ['s4', dev]]),
  )

  it('never names the same person twice', () => {
    const winners = classAwards.map(a => a.winner)
    expect(winners.length).toBeGreaterThan(1)
    expect(new Set(winners).size).toBe(winners.length)
  })

  it('gives the runaway leader exactly one award, not four', () => {
    expect(classAwards.filter(a => a.winner === 'ace')).toHaveLength(1)
  })

  it('names several different people', () => {
    expect(new Set(classAwards.map(a => a.winner)).size).toBeGreaterThanOrEqual(3)
  })

  it('returns awards with everything the UI needs to render', () => {
    for (const a of classAwards) {
      expect(a.key).toBeTruthy()
      expect(a.icon).toBeTruthy()
      expect(a.label).toBeTruthy()
      expect(a.winner).toBeTruthy()
      expect(a.detail).toBeTruthy()
    }
  })
})

describe('best streak comes from the answer log, not the live counter', () => {
  // REGRESSION GUARD: participant.streakCount is the *live* streak and is reset
  // to 0 by applyStreak() the moment an answer is wrong (server.mjs). Reading
  // it directly at end-of-session awards On Fire to whoever happened to end on
  // a correct answer, not to whoever actually had the longest run.
  const runner = p(
    'runner',
    [
      { isCorrect: true, timeMs: 2000 },
      { isCorrect: true, timeMs: 2000 },
      { isCorrect: true, timeMs: 2000 },
      { isCorrect: true, timeMs: 2000 },
      { isCorrect: false, timeMs: 2000 },
    ],
    { streakCount: 0 }, // live counter says zero — it was just reset
  )
  const laggard = p(
    'laggard',
    [
      { isCorrect: false, timeMs: 2000 },
      { isCorrect: false, timeMs: 2000 },
      { isCorrect: false, timeMs: 2000 },
      { isCorrect: false, timeMs: 2000 },
      { isCorrect: true, timeMs: 2000 },
    ],
    { streakCount: 1 }, // live counter says one — it ended on a correct answer
  )

  it('summarises the true longest run', () => {
    expect(summariseParticipant(runner, 5).bestStreak).toBe(4)
    expect(summariseParticipant(laggard, 5).bestStreak).toBe(1)
  })

  it('awards On Fire to the real streak holder', () => {
    const { classAwards } = computeSessionAwards(
      input([['s1', runner], ['s2', laggard]]),
    )
    const onFire = classAwards.find(a => a.key === 'on_fire')
    expect(onFire?.winner).toBe('runner')
    expect(onFire?.detail).toContain('4')
  })

  it('does not let a gap in the answers array continue a run', () => {
    // Skipped questions are holes in the sparse array — a run must break there.
    const skipper = p('skipper', [
      { isCorrect: true, timeMs: 1000 },
      { isCorrect: true, timeMs: 1000 },
      undefined,
      { isCorrect: true, timeMs: 1000 },
      { isCorrect: true, timeMs: 1000 },
    ])
    expect(summariseParticipant(skipper, 5).bestStreak).toBe(2)
  })
})

describe('every participant gets a badge', () => {
  it('gives a true floor badge to someone who got everything wrong', () => {
    const tried = p('tried', [
      { isCorrect: false, timeMs: 4000 },
      { isCorrect: false, timeMs: 4000 },
      { isCorrect: false, timeMs: 4000 },
      { isCorrect: false, timeMs: 4000 },
      { isCorrect: false, timeMs: 4000 },
    ])
    const { personalBadges } = computeSessionAwards(
      input([['s1', p('ace', ALL_RIGHT_FAST)], ['s2', tried]]),
    )
    const badge = personalBadges.get('pid-tried')
    expect(badge).toBeTruthy()
    expect(badge!.label).toBeTruthy()
    expect(badge!.detail).toBeTruthy()
    // It must be a participation badge, not a placing. Answering everything
    // wrong earns "went the distance", never a medal.
    expect(['distance', 'finisher']).toContain(badge!.key)
  })

  it('never hands a podium badge to someone who scored nothing', () => {
    // REGRESSION: in a small room every player is technically on the podium, so
    // an unguarded ladder gave a player who got everything wrong "🥉 3rd place
    // · 0 points" — a rank they did not earn, stapled to proof they scored
    // nothing. Caught in a real 3-player session, not by the test above, which
    // only checked that the wording avoided the literal word "rank".
    const zero = p('zero', [
      { isCorrect: false, timeMs: 4000 },
      { isCorrect: false, timeMs: 4000 },
    ])
    const { personalBadges } = computeSessionAwards(
      input([
        ['s1', p('ace', ALL_RIGHT_FAST)],
        ['s2', p('bea', [{ isCorrect: true, timeMs: 3000 }])],
        ['s3', zero],
      ]),
    )
    const badge = personalBadges.get('pid-zero')!
    expect(['champion', 'runner_up', 'third']).not.toContain(badge.key)
    expect(badge.detail).not.toContain('0 points')
  })

  it('leaves nobody without one', () => {
    const { personalBadges } = computeSessionAwards(
      input([
        ['s1', p('ace', ALL_RIGHT_FAST)],
        ['s2', p('mid', [{ isCorrect: true, timeMs: 3000 }, { isCorrect: false, timeMs: 3000 }])],
        ['s3', p('low', [{ isCorrect: false, timeMs: 9000 }])],
      ]),
    )
    expect(personalBadges.size).toBe(3)
    for (const b of personalBadges.values()) expect(b.label).toBeTruthy()
  })

  it('celebrates the winner as champion', () => {
    const { personalBadges } = computeSessionAwards(
      input([['s1', p('ace', ALL_RIGHT_FAST)], ['s2', p('low', [{ isCorrect: false, timeMs: 9000 }])]]),
    )
    expect(personalBadges.get('pid-ace')?.key).toBe('champion')
  })
})

describe('anonymous sessions', () => {
  it('never leaks a name into class awards', () => {
    // Archetypes deliberately share no substring with the names, so "the name
    // did not leak" is a real assertion rather than an artefact of the fixture.
    const one = p('Priya Sharma', ALL_RIGHT_FAST, { archetype: 'Swift Otter' })
    const two = p('Rahul Verma', [{ isCorrect: true, timeMs: 8000 }], { archetype: 'Brave Yak' })

    const { classAwards } = computeSessionAwards(
      input([['s1', one], ['s2', two]], { anonymousMode: true }),
    )

    expect(classAwards.length).toBeGreaterThan(0)
    const winners = classAwards.map(a => a.winner)
    for (const w of winners) {
      expect(w).not.toContain('Priya')
      expect(w).not.toContain('Rahul')
      expect(['Swift Otter', 'Brave Yak']).toContain(w)
    }
  })

  it('still uses real names when anonymous mode is off', () => {
    const { classAwards } = computeSessionAwards(
      input([
        ['s1', p('Priya Sharma', ALL_RIGHT_FAST, { archetype: 'Swift Otter' })],
        ['s2', p('Rahul Verma', [{ isCorrect: true, timeMs: 8000 }], { archetype: 'Brave Yak' })],
      ]),
    )
    expect(classAwards.map(a => a.winner)).toContain('Priya Sharma')
  })
})

describe('ghosts and empty rooms', () => {
  it('never awards a ghost', () => {
    // Ghosts are synthetic leaderboard entries replayed from a past session.
    const { classAwards } = computeSessionAwards(
      input([
        ['ghost::0', p('GhostChamp', ALL_RIGHT_FAST, { isGhost: true })],
        ['s1', p('human', [{ isCorrect: true, timeMs: 6000 }, { isCorrect: true, timeMs: 6000 }])],
      ]),
    )
    for (const a of classAwards) expect(a.winner).not.toBe('GhostChamp')
  })

  it('returns empty rather than throwing on an empty room', () => {
    const { classAwards, personalBadges } = computeSessionAwards(input([]))
    expect(classAwards).toEqual([])
    expect(personalBadges.size).toBe(0)
  })

  it('handles a participant who never answered anything', () => {
    const { personalBadges } = computeSessionAwards(input([['s1', p('silent', [])]]))
    expect(personalBadges.get('pid-silent')).toBeTruthy()
  })
})

describe('reflection mode', () => {
  it('never awards accuracy or speed', () => {
    const { classAwards } = computeSessionAwards(
      input(
        [
          ['s1', p('a', ALL_RIGHT_FAST)],
          ['s2', p('b', [{ isCorrect: true, timeMs: 8000 }])],
        ],
        { sessionMode: 'reflection' },
      ),
    )
    const keys = classAwards.map(a => a.key)
    expect(keys).not.toContain('flawless')
    expect(keys).not.toContain('quickest')
    expect(keys).not.toContain('on_fire')
  })

  it('runs no class ceremony, but still badges everyone', () => {
    // DOCUMENTED CURRENT BEHAVIOUR, not an aspiration. A real reflection
    // session scores nothing, so every score is 0; dense ranking puts the whole
    // room at rank 1; and the two consolation awards exclude ranks 1-3 to stop
    // the podium hogging them. Net effect: zero class awards, and the host's
    // trigger (gated on classAwards.length > 0) never appears — which is
    // defensible, since a reflection session is not a competition.
    //
    // The assertion above passes trivially on an empty array, so it alone would
    // never have surfaced this. If reflection should ever get its own
    // participation ceremony, THIS is the test that must change.
    const participants: [string, ReturnType<typeof p>][] = []
    for (let i = 0; i < 12; i++) {
      const person = p(`r${i}`, [
        { isCorrect: false, timeMs: 4000, points: 0 },
        { isCorrect: false, timeMs: 4000, points: 0 },
      ])
      person.score = 0 // reflection questions award nothing
      participants.push([`s${i}`, person])
    }

    const { classAwards, personalBadges } = computeSessionAwards(
      input(participants, { sessionMode: 'reflection', totalQuestions: 2 }),
    )

    expect(classAwards).toEqual([])
    // Every participant is still recognised on their own screen.
    expect(personalBadges.size).toBe(12)
    for (const b of personalBadges.values()) expect(b.label).toBeTruthy()
  })
})
