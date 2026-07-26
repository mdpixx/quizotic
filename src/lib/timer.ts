/**
 * timer.ts
 *
 * Question-timer bounds and helpers. Deliberately a standalone module with no
 * imports: the participant page (src/app/join/page.tsx) has a <100KB budget and
 * must not pull in quiz-builder-logic's type pills, answer colors and
 * validation just to clamp a number. quiz-builder-logic re-exports these for
 * builder-side callers.
 *
 * Keep TIMER_MIN_ACTIVE / TIMER_MAX in sync with clampTimerSeconds() in
 * server.mjs — the server is the authority, this is belt-and-suspenders.
 */

/** `0` = no timer. The host advances manually; the all-answered check still fires. */
export const TIMER_NONE = 0
/** Floor for an *active* timer. Below this the countdown opens in the red zone. */
export const TIMER_MIN_ACTIVE = 5
/** Ceiling. 10 minutes covers RC passages and multi-part case scenarios. */
export const TIMER_MAX = 600

/**
 * Clamp an untrusted timer value.
 *
 * Returns `fallback` only for non-numeric input. `0` and negatives collapse to
 * TIMER_NONE rather than the fallback — callers previously wrote
 * `Number(x) || 20`, which silently converted a deliberate "no timer" into a
 * 20-second countdown.
 */
export function clampTimer(value: unknown, fallback = 20): number {
  // Number(null) and Number('') are both 0, which would land in the "no timer"
  // branch below — so a legacy DB row with a NULL timerSeconds would silently
  // become an untimed question instead of taking the fallback. Reject the
  // empty-ish values explicitly before coercing.
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  if (typeof value === 'boolean') return fallback

  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  if (n <= 0) return TIMER_NONE
  return Math.max(TIMER_MIN_ACTIVE, Math.min(TIMER_MAX, n))
}

/** '20s' · '1m 30s' · '5m' · 'No timer'. */
export function formatTimer(seconds: number): string {
  if (seconds <= 0) return 'No timer'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}
