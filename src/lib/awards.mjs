// End-of-session awards — pure helpers, extracted from server.mjs so they can
// be exercised in unit tests without booting Next.js / Socket.io. Same rationale
// and shape as session-state.mjs.
//
// WHY THIS EXISTS
// A quiz ends and exactly three people are celebrated. Everyone else reads a
// podium of other people's names and then finds themselves in a list. These
// helpers turn the answer log we already keep into one true, specific,
// flattering fact per participant — plus a short set of named awards the host
// can project for the room.
//
// INPUT is a plain object, never a live session, so tests can build fixtures:
//   participants:    Map<socketId, participantRecord>
//   totalQuestions:  number of answerable questions in the quiz
//   anonymousMode:   boolean — award by archetype instead of name
//   sessionMode:     'competitive' | 'accuracy' | 'reflection'
//
// A participantRecord (server.mjs:3017) carries { participantId, name,
// archetype, score, answers }, where `answers` is a SPARSE array indexed by
// question index whose entries are { isCorrect, points, timeMs, ... }.

// Typed here rather than in a .d.ts so the shapes travel with the logic — both
// the TS callers (host page, tests) and this file stay honest about them.
/**
 * @typedef {Object} PersonalBadge
 * @property {string} key
 * @property {string} icon
 * @property {string} label
 * @property {string} detail
 */
/**
 * @typedef {Object} ClassAward
 * @property {string} key
 * @property {string} icon
 * @property {string} label
 * @property {string} winner
 * @property {string|null} archetype
 * @property {string} detail
 */
/**
 * @typedef {Object} ParticipantSummary
 * @property {number} answered
 * @property {number} correct
 * @property {number} bestStreak
 * @property {number} accuracy
 * @property {number} meanCorrectTimeMs
 * @property {boolean} answeredAll
 * @property {boolean} perfect
 * @property {number} score
 */

// ─── Constants ───────────────────────────────────────────────────────────────

// A run this long is worth calling out; below it, "on fire" is just noise.
const MIN_STREAK = 3
// Speed is only meaningful once someone has a couple of correct answers to
// average over — otherwise one lucky fast guess wins it.
const MIN_CORRECT_FOR_SPEED = 2
// Sharpshooter is a consolation award; it should read as genuinely good.
const MIN_SHARP_ACCURACY = 0.6
const MIN_PERSONAL_ACCURACY = 0.7
// Below this many players, percentile bands are meaningless ("top 10%" of 4
// people is one person, who is simply the winner).
const MIN_FOR_PERCENTILE = 8

// ─── Summarising one participant ─────────────────────────────────────────────

/**
 * Reduce a participant's sparse answer log to the facts every award needs.
 *
 * bestStreak is recomputed here rather than read off `participant.streakCount`.
 * That field is the LIVE streak: applyStreak() in server.mjs resets it to 0 the
 * moment an answer is wrong, so at end-of-session it reflects whether the
 * player happened to finish on a correct answer — not their longest run.
 *
 * @returns {ParticipantSummary}
 */
export function summariseParticipant(participant, totalQuestions) {
  const answers = Array.isArray(participant?.answers) ? participant.answers : []
  const total = Number(totalQuestions) || 0

  let answered = 0
  let correct = 0
  let bestStreak = 0
  let run = 0
  let correctTimeTotal = 0

  // Walk by index, not by iterating the array: it is sparse, and a skipped
  // question must BREAK a run rather than be stepped over as if it never
  // happened. `for...of` over a sparse array would silently join two runs.
  const upper = Math.max(total, answers.length)
  for (let i = 0; i < upper; i++) {
    const a = answers[i]
    if (a === undefined || a === null) { run = 0; continue }
    answered++
    if (a.isCorrect === true) {
      correct++
      run++
      if (run > bestStreak) bestStreak = run
      correctTimeTotal += Number(a.timeMs) || 0
    } else {
      run = 0
    }
  }

  return {
    answered,
    correct,
    bestStreak,
    accuracy: answered > 0 ? correct / answered : 0,
    // Infinity sorts last, so someone with no correct answers can never win a
    // speed award by virtue of having no data.
    meanCorrectTimeMs: correct > 0 ? correctTimeTotal / correct : Infinity,
    answeredAll: total > 0 && answered >= total,
    perfect: total > 0 && correct >= total,
    score: Number(participant?.score) || 0,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isGhost(socketId, participant) {
  return (typeof socketId === 'string' && socketId.startsWith('ghost::')) || participant?.isGhost === true
}

function displayName(participant, anonymousMode) {
  if (anonymousMode) return participant?.archetype || 'Player'
  return participant?.name || participant?.archetype || 'Player'
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

function pct(x) {
  return `${Math.round(x * 100)}%`
}

// ─── Class awards ────────────────────────────────────────────────────────────
//
// ALLOCATION, NOT THRESHOLDS. This is the decision the whole feature rests on.
// Evaluated independently, the runaway leader wins Flawless AND On Fire AND
// Quickest AND Went the Distance: one person celebrated four times, and three
// people who deserved a mention never get named. So each award goes to the best
// candidate who has NOT already won something, and an award with no un-awarded
// candidate is simply dropped. A small room therefore yields fewer awards —
// which is correct, and far better than the same face four times.
//
// Ordered by how much the recognition is worth to the room, not by how hard the
// achievement is: the consolation awards sit last so they fall to people the
// podium missed.
const AWARD_DEFS = [
  {
    key: 'flawless',
    icon: '🎯',
    label: 'Flawless',
    modes: ['competitive', 'accuracy'],
    pick: s => (s.perfect && s.answered > 0 ? s.correct : null),
    detail: (s, ctx) => `${s.correct} of ${ctx.totalQuestions} correct`,
  },
  {
    key: 'on_fire',
    icon: '🔥',
    label: 'On Fire',
    modes: ['competitive', 'accuracy'],
    pick: s => (s.bestStreak >= MIN_STREAK ? s.bestStreak : null),
    detail: s => `${s.bestStreak} in a row`,
  },
  {
    key: 'quickest',
    icon: '⚡',
    label: 'Quickest Draw',
    modes: ['competitive'],
    // Lower is better, so negate to keep "highest wins" uniform.
    pick: s => (s.correct >= MIN_CORRECT_FOR_SPEED ? -s.meanCorrectTimeMs : null),
    detail: s => `${seconds(s.meanCorrectTimeMs)} average`,
  },
  {
    key: 'comeback',
    icon: '📈',
    label: 'Best Comeback',
    modes: ['competitive', 'accuracy'],
    // Needs rank history, which server.mjs records as `worstRank` while the
    // quiz runs. Absent (older sessions, or a quiz that never showed
    // standings), the award is simply skipped rather than faked.
    pick: (s, ctx, p) => {
      const worst = Number(p?.worstRank)
      const final = ctx.rankOf(p)
      if (!Number.isFinite(worst) || !Number.isFinite(final)) return null
      const climb = worst - final
      return climb >= 2 ? climb : null
    },
    detail: (s, ctx, p) => `climbed ${Number(p.worstRank) - ctx.rankOf(p)} places`,
  },
  {
    key: 'sharpshooter',
    icon: '🎓',
    label: 'Sharpshooter',
    modes: ['competitive', 'accuracy'],
    // Consolation: explicitly excludes the podium, who were already celebrated.
    pick: (s, ctx, p) => {
      if (ctx.rankOf(p) <= 3) return null
      return s.accuracy >= MIN_SHARP_ACCURACY && s.answered > 0 ? s.accuracy : null
    },
    detail: s => `${pct(s.accuracy)} accuracy`,
  },
  {
    key: 'distance',
    icon: '💪',
    label: 'Went the Distance',
    modes: ['competitive', 'accuracy', 'reflection'],
    // Pure participation — the one award that has nothing to do with being
    // right, and the reason reflection mode still gets an awards screen.
    pick: (s, ctx, p) => {
      if (ctx.rankOf(p) <= 3) return null
      return s.answeredAll ? s.answered : null
    },
    detail: (s, ctx) => `answered all ${ctx.totalQuestions}`,
  },
]

// ─── Personal badges ─────────────────────────────────────────────────────────
//
// Best-first. The ladder ALWAYS terminates in a true floor, so nobody sees an
// empty space where their classmates got a badge — that exclusion is precisely
// what made a rank-based screen worth replacing. Nothing below the podium tier
// mentions rank or compares the player to a named other.
const BADGE_LADDER = [
  // Podium tiers require a NON-ZERO score. In a small room everyone is
  // technically on the podium, so without this a player who got every question
  // wrong is handed "🥉 3rd place · 0 points" — a rank they did not earn,
  // attached to a number that states they scored nothing. That is exactly the
  // comparative, demotivating message this ladder exists to replace, and it is
  // worse than the honest floor further down.
  {
    key: 'champion', icon: '🏆', label: 'Champion',
    when: (s, c) => c.rank === 1 && c.scored && s.score > 0,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'runner_up', icon: '🥈', label: '2nd place',
    when: (s, c) => c.rank === 2 && c.scored && s.score > 0,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'third', icon: '🥉', label: '3rd place',
    when: (s, c) => c.rank === 3 && c.scored && s.score > 0,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'flawless', icon: '🎯', label: 'Flawless',
    when: (s, c) => c.scored && s.perfect,
    detail: (s, c) => `${s.correct} of ${c.totalQuestions} correct`,
  },
  {
    key: 'top10', icon: '⭐', label: 'Top 10%',
    when: (s, c) => c.scored && s.score > 0 && c.field >= MIN_FOR_PERCENTILE && c.percentile <= 0.1,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'on_fire', icon: '🔥', label: 'On Fire',
    when: (s, c) => c.scored && s.bestStreak >= MIN_STREAK,
    detail: s => `${s.bestStreak} correct in a row`,
  },
  {
    key: 'top25', icon: '✨', label: 'Top 25%',
    when: (s, c) => c.scored && s.score > 0 && c.field >= MIN_FOR_PERCENTILE && c.percentile <= 0.25,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'sharp', icon: '💯', label: 'Sharp',
    when: (s, c) => c.scored && s.answered > 0 && s.accuracy >= MIN_PERSONAL_ACCURACY,
    detail: s => `${pct(s.accuracy)} accuracy`,
  },
  {
    key: 'top50', icon: '👍', label: 'Top half',
    when: (s, c) => c.scored && s.score > 0 && c.field >= MIN_FOR_PERCENTILE && c.percentile <= 0.5,
    detail: s => `${s.score.toLocaleString()} points`,
  },
  {
    key: 'distance', icon: '💪', label: 'Went the distance',
    when: s => s.answeredAll,
    detail: (s, c) => `answered all ${c.totalQuestions}`,
  },
  {
    key: 'on_the_board', icon: '✅', label: 'On the board',
    when: (s, c) => c.scored && s.correct > 0,
    detail: s => `${s.correct} correct`,
  },
  // FLOOR — must have no condition. Someone who answered nothing at all still
  // showed up, and that is the only thing this claims.
  {
    key: 'finisher', icon: '🙌', label: 'Finisher',
    when: () => true,
    detail: (s, c) => (s.answered > 0
      ? `answered ${s.answered} of ${c.totalQuestions}`
      : 'made it to the end'),
  },
]

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Compute the projector awards and every participant's personal badge in one
 * pass. The server calls this once at end_session, broadcasts `classAwards`
 * (fixed size, safely under the <1KB event budget) and emits each personal
 * badge to its own socket — a per-participant map in the broadcast would leak
 * everyone's stats to everyone and blow that budget at 500+ players.
 *
 * @returns {{ classAwards: ClassAward[], personalBadges: Map<string, PersonalBadge> }}
 */
export function computeSessionAwards({
  participants,
  totalQuestions = 0,
  anonymousMode = false,
  sessionMode = 'competitive',
} = {}) {
  const empty = { classAwards: [], personalBadges: new Map() }
  if (!participants || typeof participants.entries !== 'function') return empty

  // Real players only — ghosts are replayed entries from a past session and
  // must never win anything in this room.
  const roster = []
  for (const [sid, participant] of participants.entries()) {
    if (!participant || isGhost(sid, participant)) continue
    roster.push({ participant, summary: summariseParticipant(participant, totalQuestions) })
  }
  if (roster.length === 0) return empty

  const scored = sessionMode !== 'reflection'

  // Rank by score, dense (ties share a rank). Reflection has no scores, so
  // everyone sits at rank 1 and every rank-sensitive award is inert anyway.
  const ordered = [...roster].sort((a, b) => b.summary.score - a.summary.score)
  const rankByPid = new Map()
  let lastScore = null
  let lastRank = 0
  ordered.forEach((entry, i) => {
    const rank = entry.summary.score === lastScore ? lastRank : i + 1
    rankByPid.set(entry.participant.participantId, rank)
    lastScore = entry.summary.score
    lastRank = rank
  })

  const ctx = {
    totalQuestions,
    field: roster.length,
    rankOf: p => rankByPid.get(p?.participantId) ?? Infinity,
  }

  // ── Class awards, allocated to distinct people ──
  const classAwards = []
  const taken = new Set()
  for (const def of AWARD_DEFS) {
    if (!def.modes.includes(sessionMode)) continue

    let best = null
    let bestValue = null
    for (const { participant, summary } of roster) {
      if (taken.has(participant.participantId)) continue
      const value = def.pick(summary, ctx, participant)
      if (value === null || value === undefined || Number.isNaN(value)) continue
      if (bestValue === null || value > bestValue) {
        bestValue = value
        best = { participant, summary }
      }
    }
    if (!best) continue // no un-awarded candidate — drop it rather than repeat

    taken.add(best.participant.participantId)
    classAwards.push({
      key: def.key,
      icon: def.icon,
      label: def.label,
      winner: displayName(best.participant, anonymousMode),
      archetype: best.participant.archetype || null,
      detail: def.detail(best.summary, ctx, best.participant),
    })
  }

  // ── Personal badges — one for everyone, no exceptions ──
  const personalBadges = new Map()
  for (const { participant, summary } of roster) {
    const rank = ctx.rankOf(participant)
    const badgeCtx = {
      rank,
      scored,
      field: roster.length,
      totalQuestions,
      // Share of the field at or above this player. Rank 1 of 20 → 0.05.
      percentile: roster.length > 0 ? rank / roster.length : 1,
    }
    const tier = BADGE_LADDER.find(b => b.when(summary, badgeCtx)) ?? BADGE_LADDER[BADGE_LADDER.length - 1]
    personalBadges.set(participant.participantId, {
      key: tier.key,
      icon: tier.icon,
      label: tier.label,
      detail: tier.detail(summary, badgeCtx),
    })
  }

  return { classAwards, personalBadges }
}
