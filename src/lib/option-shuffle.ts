/**
 * option-shuffle — per-participant answer-option jumbling.
 *
 * WHY THIS IS CLIENT-SIDE AND DISPLAY-ONLY
 * ----------------------------------------
 * The obvious implementation — shuffle server-side and emit a different
 * question_show to every socket — breaks two of the project's load-bearing
 * constraints at once: `question_show` is a single room broadcast (turning it
 * into N per-socket emits multiplies bandwidth by the room size on the hottest
 * path), and every downstream consumer of an answer (checkAnswer,
 * bumpAnswerCounters, countAnswersByOption, persistAnswer, session reports)
 * assumes option indices live in ORIGINAL space.
 *
 * So instead: the server broadcasts the authored order exactly as before plus
 * one boolean. Each participant device derives its OWN permutation from a seed
 * only it has, renders that order, and translates the tapped display slot back
 * to the original index before emitting `submit_answer`. The server never
 * learns a shuffle happened and needs zero changes to scoring, aggregation,
 * persistence or reporting.
 *
 * This is not a secrecy mechanism and does not need to be. Options already
 * reach the client in authored order with `correctAnswer` stripped
 * (sanitizeQuestion in server.mjs), so a devtools user gains nothing from
 * knowing the permutation. The feature exists to stop the person at the next
 * desk copying "it's the blue one" — a display concern, solved at the display
 * layer. A client that computes a wrong permutation only mis-maps its own
 * answer; it cannot affect anyone else's score.
 *
 * DETERMINISM CONTRACT
 * --------------------
 * The order must be stable for a given (participantId, question) pair across
 * re-renders, reconnects, and the late-joiner catch-up replay — otherwise the
 * tiles would visibly re-jumble mid-question, or a participant who refreshed
 * would see a different layout than the one they started answering. The seed
 * therefore contains nothing volatile: no timestamps, no socket ids, no
 * Math.random(). Same inputs in, same order out, forever.
 */

/** Question types whose options are safe to jumble. */
const SHUFFLEABLE_TYPES = new Set(['mcq', 'multiselect'])

/**
 * True/false is deliberately excluded — "True" must precede "False" for the
 * question to read naturally, and jumbling a binary pair adds confusion
 * without adding any anti-copying value (a neighbour glancing over sees a
 * two-tile layout either way).
 *
 * Polls and other non-scored types are excluded because there is nothing to
 * copy, and because the host's live bar chart is indexed by option position —
 * jumbling would make the room's own results harder to read aloud.
 */
export function isShuffleableType(type: string | undefined | null): boolean {
  return !!type && SHUFFLEABLE_TYPES.has(type)
}

/**
 * FNV-1a, 32-bit. Chosen over a cryptographic hash because the requirement is
 * "cheap and identical everywhere", not "unpredictable" — see the module note
 * on why secrecy is not a goal. Runs in a few microseconds on the low-end
 * Android phones that make up most of a classroom.
 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // 32-bit FNV prime (16777619) via shifts — avoids the float precision
    // loss of a plain `h * 16777619` once h exceeds 2^24.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/** mulberry32 — small, fast, well-distributed PRNG with a 32-bit state. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A deterministic 0..1 generator seeded from a string. Exported so the
 * self-paced question-order shuffle (lib/async-order.ts) draws from the same
 * PRNG as this module rather than growing a second copy — the determinism
 * contract above applies verbatim to it.
 */
export function createSeededRng(seed: string): () => number {
  return mulberry32(fnv1a(seed))
}

/** In-place-safe Fisher-Yates using a supplied generator. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Builds the display order for one participant on one question.
 *
 * Returns an array indexed by DISPLAY slot whose values are ORIGINAL option
 * indices. `order[2] === 0` means "the third tile on this participant's screen
 * shows the option the host authored first".
 *
 * Returns the identity order when shuffling is off, the type isn't
 * shuffleable, there's no participant identity to seed from, or there are
 * fewer than two options to permute — so callers can use the result
 * unconditionally without branching.
 */
export function buildDisplayOrder(opts: {
  optionCount: number
  enabled: boolean
  questionType: string | undefined | null
  participantId: string | undefined | null
  questionId: string | undefined | null
  questionIndex: number
}): number[] {
  const { optionCount, enabled, questionType, participantId, questionId, questionIndex } = opts
  const identity = Array.from({ length: Math.max(0, optionCount) }, (_, i) => i)

  if (!enabled) return identity
  if (!isShuffleableType(questionType)) return identity
  if (!participantId) return identity
  if (optionCount < 2) return identity

  // questionId is included so two questions with identical option counts don't
  // receive the same permutation for the same participant (which would make
  // the jumble look suspiciously like a fixed re-ordering across a quiz).
  // questionIndex is a fallback discriminator for legacy questions with a
  // missing or duplicated id.
  const rand = createSeededRng(`${participantId}::${questionId ?? 'noid'}::${questionIndex}`)
  return seededShuffle(identity, rand)
}

/**
 * Inverts a display order: returns an array indexed by ORIGINAL index whose
 * values are DISPLAY slots. Needed for the reveal, where the server sends the
 * correct answer as an original index and the UI must highlight whichever tile
 * that landed on for THIS participant.
 */
export function invertDisplayOrder(order: number[]): number[] {
  const inverse = new Array<number>(order.length)
  for (let slot = 0; slot < order.length; slot++) inverse[order[slot]] = slot
  return inverse
}

/** Display slot → original option index. Falls back to identity when out of range. */
export function toOriginalIndex(order: number[], displaySlot: number): number {
  const mapped = order[displaySlot]
  return typeof mapped === 'number' ? mapped : displaySlot
}

/** Original option index → display slot. Falls back to identity when out of range. */
export function toDisplaySlot(inverse: number[], originalIndex: number): number {
  const mapped = inverse[originalIndex]
  return typeof mapped === 'number' ? mapped : originalIndex
}
