// Typed façade for Next.js/TypeScript consumers. Runtime behavior lives in the
// plain-ESM module so server.mjs and socket-schemas.mjs use the same contract.
export {
  TIMER_NONE,
  TIMER_MIN_ACTIVE,
  TIMER_MAX,
  TIMER_DEFAULT,
  isValidTimerSeconds,
  clampTimer,
  formatTimer,
} from './timer-contract.mjs'
