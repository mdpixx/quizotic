import { describe, expect, it } from 'vitest'
import { buildServeOrder, nextIndexInOrder, ordinalInOrder } from '@/lib/async-order'

// Per-participant question order for self-paced quizzes. The load-bearing
// properties are: it is a PERMUTATION (never drops or duplicates a question),
// it is DETERMINISTIC (a refresh or a resume replays the same sequence), and it
// returns RAW snapshot indices (Answer rows key on those).

const Q = (id: string, type = 'mcq') => ({ id, type, text: `${id} text` })

const PLAIN = [Q('a'), Q('b'), Q('c'), Q('d'), Q('e'), Q('f')]

const WITH_SLIDES = [
  { id: 'lb0', type: 'leaderboard', text: '' },
  Q('q1'),
  { id: 'lb2', type: 'leaderboard', text: '' },
  Q('q3'),
  Q('q4'),
  { id: 'lb5', type: 'leaderboard', text: '' },
]

const NAME_FIRST = [
  { id: 'n0', type: 'openended', text: 'Enter your full name (as per records)', isNameCapture: true },
  Q('q1'), Q('q2'), Q('q3'), Q('q4'),
]

function order(questions: typeof PLAIN, participantId: string | null, enabled = true) {
  return buildServeOrder({ questions, participantId, sessionId: 'sess-1', enabled })
}

describe('buildServeOrder — shuffling off', () => {
  it('returns authored order', () => {
    expect(order(PLAIN, 'p1', false)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('still drops leaderboard slides', () => {
    expect(buildServeOrder({ questions: WITH_SLIDES, participantId: 'p1', sessionId: 's', enabled: false }))
      .toEqual([1, 3, 4])
  })
})

describe('buildServeOrder — shuffling on', () => {
  it('is a permutation: same questions, no drops, no duplicates', () => {
    const got = order(PLAIN, 'p1')
    expect([...got].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('actually reorders for at least some participants', () => {
    const authored = [0, 1, 2, 3, 4, 5]
    const reordered = ['p1', 'p2', 'p3', 'p4', 'p5']
      .map(p => order(PLAIN, p))
      .filter(o => JSON.stringify(o) !== JSON.stringify(authored))
    expect(reordered.length).toBeGreaterThan(0)
  })

  it('gives different participants different sequences', () => {
    const seqs = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(order(PLAIN, `p${i}`))),
    )
    expect(seqs.size).toBeGreaterThan(1)
  })

  // The whole feature collapses if this is not true: a participant who
  // refreshes mid-attempt would be re-served a question they already answered.
  it('is stable for the same participant across repeated calls', () => {
    const first = order(PLAIN, 'p1')
    for (let i = 0; i < 5; i++) expect(order(PLAIN, 'p1')).toEqual(first)
  })

  it('is scoped per session, so re-scheduling the same quiz reshuffles', () => {
    const a = buildServeOrder({ questions: PLAIN, participantId: 'p1', sessionId: 'sess-A', enabled: true })
    const b = buildServeOrder({ questions: PLAIN, participantId: 'p1', sessionId: 'sess-B', enabled: true })
    expect([...a].sort()).toEqual([...b].sort())
    // Different seed — not asserting they differ on one pair (they might
    // legitimately collide), only that the session participates in the seed.
    const differsSomewhere = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify(buildServeOrder({ questions: PLAIN, participantId: `p${i}`, sessionId: 'sess-A', enabled: true }))
      !== JSON.stringify(buildServeOrder({ questions: PLAIN, participantId: `p${i}`, sessionId: 'sess-B', enabled: true })),
    )
    expect(differsSomewhere.some(Boolean)).toBe(true)
  })

  it('excludes leaderboard slides and returns raw snapshot indices', () => {
    const got = buildServeOrder({ questions: WITH_SLIDES, participantId: 'p7', sessionId: 's', enabled: true })
    expect([...got].sort((a, b) => a - b)).toEqual([1, 3, 4])
  })
})

describe('buildServeOrder — name capture pinning', () => {
  it('keeps an explicit name-capture slide first for every participant', () => {
    for (let i = 0; i < 25; i++) {
      const got = buildServeOrder({ questions: NAME_FIRST, participantId: `p${i}`, sessionId: 's', enabled: true })
      expect(got[0]).toBe(0)
      expect([...got].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    }
  })

  it('pins a name question detected by wording too, not just the explicit flag', () => {
    const heuristic = [
      { id: 'n0', type: 'openended', text: 'What is your name?' },
      Q('q1'), Q('q2'), Q('q3'),
    ]
    for (let i = 0; i < 15; i++) {
      const got = buildServeOrder({ questions: heuristic, participantId: `p${i}`, sessionId: 's', enabled: true })
      expect(got[0]).toBe(0)
    }
  })

  it('does not pin an ordinary open-ended first question', () => {
    const plainOpen = [
      { id: 'o0', type: 'openended', text: 'Describe the water cycle.' },
      Q('q1'), Q('q2'), Q('q3'), Q('q4'), Q('q5'),
    ]
    const firsts = new Set(
      Array.from({ length: 25 }, (_, i) =>
        buildServeOrder({ questions: plainOpen, participantId: `p${i}`, sessionId: 's', enabled: true })[0]),
    )
    expect(firsts.size).toBeGreaterThan(1)
  })

  // A name question the host buried at slide 5 is not the identity prompt, and
  // hoisting it would MOVE a question rather than hold one still.
  it('does not pin a name-like question found later in the quiz', () => {
    const buried = [Q('q0'), Q('q1'), { id: 'n2', type: 'openended', text: 'What is your name?' }, Q('q3'), Q('q4')]
    const firsts = new Set(
      Array.from({ length: 25 }, (_, i) =>
        buildServeOrder({ questions: buried, participantId: `p${i}`, sessionId: 's', enabled: true })[0]),
    )
    expect(firsts.size).toBeGreaterThan(1)
  })
})

describe('buildServeOrder — degenerate inputs', () => {
  it('returns authored order without a participant id to seed from', () => {
    expect(order(PLAIN, null)).toEqual([0, 1, 2, 3, 4, 5])
    expect(order(PLAIN, '')).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('handles a single-question quiz', () => {
    expect(buildServeOrder({ questions: [Q('only')], participantId: 'p1', sessionId: 's', enabled: true })).toEqual([0])
  })

  it('handles an empty quiz and a slides-only quiz', () => {
    expect(buildServeOrder({ questions: [], participantId: 'p1', sessionId: 's', enabled: true })).toEqual([])
    expect(buildServeOrder({
      questions: [{ id: 'lb', type: 'leaderboard', text: '' }],
      participantId: 'p1', sessionId: 's', enabled: true,
    })).toEqual([])
  })
})

describe('nextIndexInOrder', () => {
  it('walks the participant order, not the snapshot order', () => {
    const serve = [3, 0, 4, 1]
    expect(nextIndexInOrder(serve, new Set())).toBe(3)
    expect(nextIndexInOrder(serve, new Set([3]))).toBe(0)
    expect(nextIndexInOrder(serve, new Set([3, 0]))).toBe(4)
  })

  it('returns -1 once everything in the order is answered', () => {
    expect(nextIndexInOrder([3, 0, 4], new Set([0, 3, 4]))).toBe(-1)
  })

  it('ignores answers to indices outside the order (e.g. a removed slide)', () => {
    expect(nextIndexInOrder([1, 3], new Set([0, 2, 1]))).toBe(3)
  })
})

describe('ordinalInOrder', () => {
  it('numbers by the participant sequence so "3 of 4" means their third', () => {
    const serve = [3, 0, 4, 1]
    expect(ordinalInOrder(serve, 3)).toBe(1)
    expect(ordinalInOrder(serve, 0)).toBe(2)
    expect(ordinalInOrder(serve, 1)).toBe(4)
  })

  it('falls back to 1 for an index not in the order', () => {
    expect(ordinalInOrder([1, 3], 9)).toBe(1)
  })
})
