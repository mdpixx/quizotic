// Open-ended answer constraints — shared by the builder, the participant input
// and the server's submit handler.
//
// Why hosts asked for this: an open-ended slide is the only way to collect a
// roll number or employee code, and a free textarea guarantees the host spends
// the evening cleaning "42", "no. 42", "Roll42" and "  42 " into one column.
// Constraining the input at source is the difference between a usable report
// and a manual reconciliation.
//
// The bigger win is not validation, it is the KEYBOARD: inputMode 'number'
// renders a numeric input, which pops the phone's numeric keypad. Across 200
// students that is minutes saved, and far fewer typos.
//
// All fields are optional on Question. Absent = 'any' = today's behaviour, so
// every existing quiz keeps working untouched.

/** @typedef {'any' | 'text' | 'number' | 'alphanumeric'} OpenEndedInputMode */

export const OPEN_ENDED_INPUT_MODES = ['any', 'text', 'number', 'alphanumeric']

// Unicode-aware so Devanagari, Tamil, Bengali etc. count as letters.
const NON_TEXT_RE = /[^\p{L}\p{M}\s'.-]/u
const NON_DIGIT_RE = /[^0-9]/
const NON_ALNUM_RE = /[^\p{L}\p{N}]/u

export function normalizeInputMode(mode) {
  return OPEN_ENDED_INPUT_MODES.includes(mode) ? mode : 'any'
}

/** Only openended slides expose these settings today. */
export function supportsInputMode(type) {
  return type === 'openended'
}

/**
 * The exact length requirement for a question, or null when free-length.
 * Guards against a corrupted row shipping `exactLength: 0` or a huge value.
 */
export function exactLengthFor(question) {
  if (!question || question.lengthMode !== 'exact') return null
  const n = Number(question.exactLength)
  if (!Number.isInteger(n) || n < 1 || n > 64) return null
  return n
}

/** Apply the host's casing rule. Employee codes are the motivating case: */
/** "emp123" and "EMP123" should land in the report as one value, not two. */
export function applyTransform(value, question) {
  const raw = String(value ?? '')
  return question?.transform === 'uppercase' ? raw.toUpperCase() : raw
}

/**
 * Strip characters the mode disallows. Used by the participant input to filter
 * as they type — showing an error after the fact for a character their keyboard
 * should not have offered is a worse experience than simply not accepting it.
 */
export function filterToMode(value, question) {
  const mode = normalizeInputMode(question?.inputMode)
  let out = String(value ?? '')
  if (mode === 'number') out = out.replace(/[^0-9]/g, '')
  else if (mode === 'text') out = out.replace(/[^\p{L}\p{M}\s'.-]/gu, '')
  else if (mode === 'alphanumeric') out = out.replace(/[^\p{L}\p{N}\s'.-]/gu, '')
  const exact = exactLengthFor(question)
  if (exact != null) out = out.slice(0, exact)
  return applyTransform(out, question)
}

/**
 * Validate a submitted open-ended answer against the question's constraints.
 *
 * Returns `{ ok: true, value }` with the transformed value, or
 * `{ ok: false, error }` with participant-facing copy.
 *
 * The server REJECTS rather than accepting-and-flagging: at submit time the
 * participant has not locked an answer yet, so a clear error lets them fix it
 * on the spot. Accepting silently would hand the host dirty data with no
 * recourse — the exact problem this feature exists to solve.
 */
export function validateOpenEndedAnswer(rawValue, question) {
  const mode = normalizeInputMode(question?.inputMode)
  const exact = exactLengthFor(question)
  const value = applyTransform(String(rawValue ?? '').trim(), question)

  if (!value) return { ok: false, error: 'Enter an answer' }

  if (mode === 'number' && NON_DIGIT_RE.test(value)) {
    return { ok: false, error: 'Numbers only' }
  }
  if (mode === 'text' && NON_TEXT_RE.test(value)) {
    return { ok: false, error: 'Letters only — no numbers or symbols' }
  }
  if (mode === 'alphanumeric' && NON_ALNUM_RE.test(value.replace(/[\s'.-]/g, ''))) {
    return { ok: false, error: 'Letters and numbers only' }
  }
  if (exact != null && value.length !== exact) {
    const unit = mode === 'number' ? 'digits' : 'characters'
    return { ok: false, error: `Enter exactly ${exact} ${unit}` }
  }
  return { ok: true, value }
}

/** Helper text under the participant input, e.g. "6 digits". Null when free. */
export function inputHintFor(question) {
  const mode = normalizeInputMode(question?.inputMode)
  const exact = exactLengthFor(question)
  if (exact != null) {
    return mode === 'number' ? `${exact} digits` : `${exact} characters`
  }
  if (mode === 'number') return 'Numbers only'
  if (mode === 'text') return 'Letters only'
  if (mode === 'alphanumeric') return 'Letters and numbers'
  return null
}

// ─── Name-capture slides ─────────────────────────────────────────────────────
// A slide flagged isNameCapture is the host's "tell me who you really are"
// question. The report promotes its answer to a sub-line under the participant's
// leaderboard name, which is what lets a host reconcile "rahul123" back to
// "Rahul Sharma, Roll 42".

// Retroactive detection for the thousands of sessions already run before the
// flag existed. Deliberately narrow — it only fires on the FIRST slide, only
// for openended, and only when the wording is unambiguous, because a false
// positive would relabel a real question's answers as someone's name.
const NAME_QUESTION_RE =
  /\b(your\s+name|full\s+name|first\s+name|last\s+name|enter\s+your\s+name|roll\s*(no|number)|enrol+ment\s*(no|number)|admission\s*(no|number)|employee\s*(code|id|no|number)|staff\s*id)\b|नाम|नाव|பெயர்|নাম|పేరు|ಹೆಸರು|નામ/i

export function isNameCaptureQuestion(question, index) {
  if (!question || question.type !== 'openended') return false
  if (question.isNameCapture === true) return true
  // Heuristic fallback applies to the first slide only.
  if (index !== 0) return false
  return NAME_QUESTION_RE.test(String(question.text ?? ''))
}

/** The slide inserted by the builder's "Add name slide" nudge. */
export function buildNameCaptureQuestion(id) {
  return {
    id,
    type: 'openended',
    text: 'Enter your full name (as per records)',
    options: undefined,
    timerSeconds: 30,
    points: 1000,
    isNameCapture: true,
    inputMode: 'text',
    lengthMode: 'free',
    transform: 'none',
  }
}
