/**
 * async-order — per-participant QUESTION order for self-paced quizzes.
 *
 * WHY THIS IS SERVER-SIDE (unlike option-shuffle)
 * ----------------------------------------------
 * Option jumbling is display-only: the client renders a permutation of an
 * array it already holds. Question order is different — the self-paced player
 * is served ONE question at a time (`/api/async/[slug]/state` and `/answer`
 * each return the next one), so the server is the only thing that can decide
 * what comes next. The permutation therefore lives here and the client simply
 * renders what it is given.
 *
 * WHY IT IS DERIVED, NOT STORED
 * -----------------------------
 * The order must survive a refresh, a reconnect, and a resume days later, and
 * it must be identical every time it is recomputed — otherwise a participant
 * who reloads mid-attempt could be served a question they already answered, or
 * skip one entirely. Rather than persist a permutation column per attendee, it
 * is derived from (sessionId, participantId), which are both already stable and
 * already on hand at every call site. Same inputs in, same order out, forever.
 *
 * Answer rows key on the RAW snapshot index (`@@unique([sessionId,
 * participantId, questionIndex])`), and this module only ever reorders raw
 * indices — never renumbers them. Grading, the report, the participant matrix
 * and the Excel workbook are all untouched by shuffling.
 */

import { createSeededRng, seededShuffle } from './option-shuffle'
import { isNameCaptureQuestion } from './openended-input.mjs'

/**
 * Structurally typed rather than importing Question: callers hold two different
 * question shapes (scoring.ts's and quiz-types'), and only these fields matter
 * here. A richer object assigns fine — the fields are listed so an object
 * literal (a test fixture) isn't rejected by the excess-property check.
 */
interface OrderableQuestion {
  id?: string
  type: string
  text?: string
  isNameCapture?: boolean
}

/** Mirrors isLeaderboardSlide in quiz-types — kept local to avoid a cycle. */
function isSlide(q: OrderableQuestion): boolean {
  return q.type === 'leaderboard'
}

/**
 * The order in which one participant is served the questions of one attempt.
 *
 * Returns RAW snapshot indices. Leaderboard flow slides are excluded (they are
 * never served self-paced). When `enabled` is false — or there is no
 * participant identity to seed from — the authored order is returned, so
 * callers can use the result unconditionally.
 *
 * A name-capture slide is PINNED to the front rather than shuffled into the
 * middle. Asking someone their name after question seven reads like a bug, and
 * the report's real-name column depends on it being answered.
 */
export function buildServeOrder(opts: {
  questions: OrderableQuestion[]
  participantId: string | null | undefined
  sessionId: string | null | undefined
  enabled: boolean
}): number[] {
  const { questions, participantId, sessionId, enabled } = opts

  const answerable = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !isSlide(q))

  if (!enabled || !participantId || answerable.length < 2) {
    return answerable.map(({ index }) => index)
  }

  // Only the question the host actually placed first can be the identity
  // prompt — isNameCaptureQuestion's heuristic branch is scoped to slide 0, and
  // pinning a name question found deeper in the quiz would move it, which is
  // the opposite of what pinning is for.
  const [first] = answerable
  const pinned = first && isNameCaptureQuestion(first.q, first.index) ? first : null
  const rest = pinned ? answerable.slice(1) : answerable

  const rand = createSeededRng(`${sessionId ?? 'nosession'}::${participantId}`)
  const shuffled = seededShuffle(rest.map(({ index }) => index), rand)

  return pinned ? [pinned.index, ...shuffled] : shuffled
}

/**
 * The next raw index to serve: the first entry of `order` the participant has
 * not answered yet. Returns -1 when the attempt is complete.
 */
export function nextIndexInOrder(order: number[], answered: Set<number>): number {
  return order.find(i => !answered.has(i)) ?? -1
}

/** 1-based position of a raw index within the participant's order. */
export function ordinalInOrder(order: number[], rawIndex: number): number {
  const at = order.indexOf(rawIndex)
  return at === -1 ? 1 : at + 1
}
