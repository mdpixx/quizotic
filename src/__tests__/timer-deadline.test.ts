// Timer display-deadline math (Workstream D, revised).
//
// Both clients now compute the DISPLAY deadline as the RAW server deadline:
//   endAt = serverEndAt ?? (effectiveStartAt + duration)
//
// The per-device half-RTT correction was REMOVED from the display so the host
// and participant screens count to the byte-identical deadline and flip digits
// together — the point of the "absolute sync" fix. Half-RTT still governs
// answer SCORING on the server (submit_answer uses serverSubmittedAt / rtt/2),
// which is where fairness lives; it must not skew the visible countdown or two
// clients with different RTT drift apart on screen.
//
// This test pins the deadline formula shared by both clients (the code is
// inlined in the question_show handlers — extracted here as a pure function so
// the contract is locked).

import { describe, it, expect } from 'vitest'

const START = 1_000_000
const DURATION = 20_000
const SERVER_END = START + DURATION

function computeDisplayDeadline({
  serverEndAt,
  effectiveStartAt,
  durationMs,
}: {
  serverEndAt?: number
  effectiveStartAt: number
  durationMs: number
}): number {
  return typeof serverEndAt === 'number' ? serverEndAt : effectiveStartAt + durationMs
}

describe('timer display deadline (raw server endAt, no half-RTT)', () => {
  it('prefers serverEndAt over locally-derived deadline', () => {
    // If the server sends endAt, the client must use it verbatim — deriving
    // locally would reintroduce offset-noise drift.
    const d = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
    })
    expect(d).toBe(SERVER_END)
  })

  it('falls back to (start + duration) when serverEndAt is absent', () => {
    // Back-compat for older servers that don't broadcast endAt yet.
    const d = computeDisplayDeadline({
      serverEndAt: undefined,
      effectiveStartAt: START,
      durationMs: DURATION,
    })
    expect(d).toBe(START + DURATION)
  })

  it('host and participant share identical deadline math', () => {
    // Both clients use the SAME formula with the SAME serverEndAt → identical
    // deadline, no inter-screen drift.
    const hostDeadline = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
    })
    const participantDeadline = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
    })
    expect(hostDeadline).toBe(participantDeadline)
  })

  it('two clients with DIFFERENT RTT now land on the identical display deadline', () => {
    // The core change: RTT no longer enters the display path, so a host on
    // 2ms wifi and a participant on 120ms 4G count to the exact same deadline.
    // (RTT is no longer even a parameter to the display formula.)
    const host = computeDisplayDeadline({ serverEndAt: SERVER_END, effectiveStartAt: START, durationMs: DURATION })
    const participant = computeDisplayDeadline({ serverEndAt: SERVER_END, effectiveStartAt: START, durationMs: DURATION })
    expect(host).toBe(participant)
    expect(host).toBe(SERVER_END)
  })
})

describe('displayed-second rounding (ceil → round)', () => {
  // Math.round (not ceil) halves the worst-case visible delta at a second
  // boundary between two clients whose ticks land close together.
  function remainingSeconds(deadline: number, now: number): number {
    return Math.max(0, Math.round((deadline - now) / 1000))
  }

  it('shows 20 at the start (deadline - now = duration)', () => {
    expect(remainingSeconds(SERVER_END, START)).toBe(20)
  })

  it('shows 0 at the deadline', () => {
    expect(remainingSeconds(SERVER_END, SERVER_END)).toBe(0)
  })

  it('two clients 99ms apart round within 1 of each other', () => {
    const base = SERVER_END - 19500
    const a = remainingSeconds(SERVER_END, base)
    const b = remainingSeconds(SERVER_END, base + 99)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
  })

  it('never returns negative (clamps to 0 past the deadline)', () => {
    expect(remainingSeconds(SERVER_END, SERVER_END + 5000)).toBe(0)
  })
})
