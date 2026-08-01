/**
 * Canonical question-timer contract shared by the browser bundle and the
 * plain-ESM Socket.IO server. Keep timer bounds and normalization here so a
 * builder change cannot drift away from the live-session payload validator.
 */

/** `0` = no timer. The host advances manually; all-answered still advances. */
export const TIMER_NONE = 0
/** Floor for an active timer. */
export const TIMER_MIN_ACTIVE = 5
/** Ten-minute ceiling for reading-heavy questions and scenarios. */
export const TIMER_MAX = 600
/** Fallback for missing, empty, or non-numeric legacy values. */
export const TIMER_DEFAULT = 20

/**
 * Return whether a value is a canonical timer sent over the socket contract.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidTimerSeconds(value) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && (value === TIMER_NONE || (value >= TIMER_MIN_ACTIVE && value <= TIMER_MAX))
}

/**
 * Normalize an untrusted timer value for builder and server runtime use.
 *
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function clampTimer(value, fallback = TIMER_DEFAULT) {
  // Number(null) and Number('') are both 0. Treat missing legacy data as the
  // fallback rather than silently turning it into an untimed question.
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  if (typeof value === 'boolean') return fallback

  const seconds = Math.round(Number(value))
  if (!Number.isFinite(seconds)) return fallback
  if (seconds <= TIMER_NONE) return TIMER_NONE
  return Math.max(TIMER_MIN_ACTIVE, Math.min(TIMER_MAX, seconds))
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatTimer(seconds) {
  if (seconds <= TIMER_NONE) return 'No timer'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds === 0
    ? `${minutes}m`
    : `${minutes}m ${remainingSeconds}s`
}
