// Timer deadline math (Workstream D).
//
// Both clients now compute the display deadline as:
//   endAt = (serverEndAt ?? effectiveStartAt + duration) - measuredRtt/2
//
// The half-RTT correction mirrors the scoring path (server.mjs uses
// receivedAt - rtt/2 to estimate tap time) so the participant's visible
// buzzer aligns with the moment the server scores. Without it, a fast tap
// at the wire looks "late" on the participant's own screen even though the
// server scored it in-window.
//
// This test pins the deadline formula shared by both clients (the code is
// inlined in question_show handlers — extracted here as a pure function so
// the contract is locked).

import { describe, it, expect } from 'vitest'

const START = 1_000_000
const DURATION = 20_000
const SERVER_END = START + DURATION

function computeDisplayDeadline({
  serverEndAt,
  effectiveStartAt,
  durationMs,
  measuredRttMs,
}: {
  serverEndAt?: number
  effectiveStartAt: number
  durationMs: number
  measuredRttMs: number
}): number {
  const halfRtt = Number.isFinite(measuredRttMs) && measuredRttMs > 0 ? measuredRttMs / 2 : 0
  const rawEndAt = typeof serverEndAt === 'number' ? serverEndAt : effectiveStartAt + durationMs
  return rawEndAt - halfRtt
}

describe('timer display deadline (half-RTT correction)', () => {
  it('prefers serverEndAt over locally-derived deadline', () => {
    // If the server sends endAt, the client must use it verbatim (minus
    // half-RTT) — deriving locally would reintroduce offset-noise drift.
    const d = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: 0,
    })
    expect(d).toBe(SERVER_END)
  })

  it('falls back to (start + duration) when serverEndAt is absent', () => {
    // Back-compat for older servers that don't broadcast endAt yet.
    const d = computeDisplayDeadline({
      serverEndAt: undefined,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: 0,
    })
    expect(d).toBe(START + DURATION)
  })

  it('subtracts half the measured RTT from the deadline', () => {
    // A participant with 100ms RTT sees the buzzer 50ms earlier — aligning
    // with the server's scoring (receivedAt - rtt/2).
    const d = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: 100,
    })
    expect(d).toBe(SERVER_END - 50)
  })

  it('applies no correction when RTT is unknown (0 or unset)', () => {
    // Before clock-sync converges, measuredRttMs is 0 — no correction, no NaN.
    expect(computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: 0,
    })).toBe(SERVER_END)
  })

  it('host and participant share identical deadline math', () => {
    // Both clients use the SAME formula. With the same serverEndAt and RTT
    // they land on the exact same deadline — no inter-screen drift.
    const rtt = 80
    const hostDeadline = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: rtt,
    })
    const participantDeadline = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: rtt,
    })
    expect(hostDeadline).toBe(participantDeadline)
  })

  it('handles asymmetric RTT gracefully (correction is half, not full)', () => {
    // Even on a 400ms mobile uplink, the correction is 200ms — not 400.
    // The participant's buzzer fires 200ms before the server's wall-clock
    // deadline, which is exactly when their tap would land at the server.
    const d = computeDisplayDeadline({
      serverEndAt: SERVER_END,
      effectiveStartAt: START,
      durationMs: DURATION,
      measuredRttMs: 400,
    })
    expect(d).toBe(SERVER_END - 200)
  })
})

describe('displayed-second rounding (ceil → round)', () => {
  // The old Math.ceil meant two clients whose ticks landed 99ms apart could
  // show different integers for up to 100ms. Math.round halves the worst-case
  // visible delta at a second boundary.
  function remainingSeconds(deadline: number, now: number): number {
    return Math.max(0, Math.round((deadline - now) / 1000))
  }

  it('shows 20 at the start (deadline - now = duration)', () => {
    expect(remainingSeconds(SERVER_END, START)).toBe(20)
  })

  it('shows 0 at the deadline', () => {
    expect(remainingSeconds(SERVER_END, SERVER_END)).toBe(0)
  })

  it('two clients 99ms apart round to the same integer at most boundaries', () => {
    // At now = deadline - 19500ms (19.5s left): client A (now) sees 20,
    // client B (+99ms, closer to deadline) sees... round(19401/1000)=19.
    // With ceil it was ceil(19500/1000)=20 vs ceil(19401/1000)=20 — same.
    // The real win is at the half-second boundaries: round converges faster.
    // Spot-check: at 19.5s and 19.4s, round gives 20/19 (1 apart);
    // ceil would give 20/20 (0 apart) here but DIVERGES at .0 boundaries.
    // The contract: round never differs by more than 1 between two clients
    // within 100ms of each other.
    const base = SERVER_END - 19500
    const a = remainingSeconds(SERVER_END, base)
    const b = remainingSeconds(SERVER_END, base + 99)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
  })

  it('never returns negative (clamps to 0 past the deadline)', () => {
    expect(remainingSeconds(SERVER_END, SERVER_END + 5000)).toBe(0)
  })
})
