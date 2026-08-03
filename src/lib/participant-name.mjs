// Participant display-name validation — shared by the join screen (client) and
// both socket join handlers in server.mjs.
//
// Why this exists: the join screen's only checks used to be "non-empty" and
// "<= 30 chars", so "12345", ".", and "..." all sailed through. The host then
// opened the report and could not tell who was who. Blocking letter-free names
// at the boundary is the cheapest fix in the whole identity story.
//
// India-first constraint: the letter test MUST be Unicode-aware. `[a-zA-Z]`
// would reject राहुल, ரமேஷ், রাহুল and রুবি — a majority of our target
// classrooms. `\p{L}` with the `u` flag covers every script.
//
// Digits INSIDE a name are deliberately allowed ("Rahul 42", "Batch3 Anu") —
// only strings with no letters at all are rejected. Over-blocking a real name
// during the 60-second window when a classroom is trying to join is worse than
// letting a slightly odd name through.

/** Minimum number of letters a display name must contain. */
export const MIN_NAME_LETTERS = 2

/** Maximum display-name length (mirrors sanitizeDisplayText's default). */
export const MAX_NAME_LENGTH = 30

// Matches any Unicode letter. Recreated per call site via .test() on a
// non-global regex, so there is no lastIndex state to reset.
const LETTER_RE = /\p{L}/u

/** Count the Unicode letters in a string. */
export function countLetters(value) {
  let n = 0
  for (const ch of String(value ?? '')) {
    if (LETTER_RE.test(ch)) {
      n++
      // Early exit — callers only ever compare against MIN_NAME_LETTERS.
      if (n >= MIN_NAME_LETTERS) return n
    }
  }
  return n
}

/**
 * Validate a participant display name.
 *
 * @param {unknown} value raw name as typed
 * @returns {{ ok: true, name: string } | { ok: false, error: string }}
 */
export function validateParticipantName(value) {
  const trimmed = String(value ?? '').trim()

  if (!trimmed) {
    return { ok: false, error: 'Enter your name' }
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or less` }
  }
  if (countLetters(trimmed) < MIN_NAME_LETTERS) {
    // Deliberately concrete rather than "invalid name" — a participant staring
    // at a rejected "12345" needs to know what to type instead.
    return { ok: false, error: 'Please enter your name in letters, not just numbers' }
  }
  return { ok: true, name: trimmed }
}

/** Convenience boolean form for render-time button gating. */
export function isValidParticipantName(value) {
  return validateParticipantName(value).ok
}
