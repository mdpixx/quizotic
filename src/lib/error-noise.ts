// Shared "is this error just noise?" matcher, used by both the PostHog
// exception-autocapture filter (PostHogProvider) and Sentry (beforeSend).
//
// These errors come from the user's browser environment — extensions,
// translation widgets, embedded webviews — not from Quizotic code. They were
// drowning the real signal: ~55% of captured exceptions were the single
// "Object Not Found Matching Id" extension bug. Dropping them at the source
// keeps Error Tracking honest without hiding anything we can act on.

const NOISE_PATTERNS: RegExp[] = [
  // Microsoft/Outlook-style browser extension. Always "Object Not Found
  // Matching Id:N, MethodName:update, ParamCount:4". Never from our code.
  /Object Not Found Matching Id:\s*\d+/i,
  // Benign layout-observer warnings browsers fire under load.
  /ResizeObserver loop (limit exceeded|completed)/i,
  // Generic extension/userscript injection failures.
  /Non-Error promise rejection captured with value: Object Not Found/i,
]

/** True when the given error text is known third-party noise we should drop. */
export function isNoiseError(text: string | null | undefined): boolean {
  if (!text) return false
  return NOISE_PATTERNS.some((re) => re.test(text))
}
