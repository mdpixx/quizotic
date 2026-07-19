// Shared countdown tick engine for the host and participant live-quiz timers.
//
// The realtime layer is already server-authoritative + NTP-corrected
// (src/lib/clock-sync.ts): the server broadcasts an absolute `endAt` and both
// clients map their local clock onto server time via getServerNow(). The one
// thing that still made the two screens flip digits apart was HOW each client
// sampled that clock: a free-running `setInterval(_, 100)`. Two independent
// 100ms pollers start at different instants and sample getServerNow() at
// different sub-second phases, so the flip — which happens at the exact
// server-time instant `endAt - (n - 0.5) * 1000` — is only NOTICED at each
// screen's next poll, up to ~100ms later, at a different phase. Side by side,
// one screen flips before the other.
//
// This engine removes that last source: it schedules each update to the EXACT
// server-time second boundary instead of polling. Because both clients share
// the same `endAt` and the same getServerNow() mapping, they compute the same
// boundary and fire at the same real-world instant — the digit changes together
// on every screen (bounded only by residual clock-offset error, already
// median-tightened in clock-sync.ts). Bonus: it re-renders once per second
// instead of 10×/sec.

import { getServerNow } from './clock-sync'

// Land a hair past the boundary so Math.round() has definitely crossed it —
// firing exactly on the boundary can round to the pre-flip value on some
// clocks and waste a tick.
const GUARD_MS = 10

export interface CountdownHandle {
  stop(): void
}

export interface CountdownOptions {
  // Get-ready gate: while server-time < startAt the live value is not emitted;
  // the engine sleeps until startAt, then begins the countdown. Mirrors the
  // participant/host `if (now < effectiveStartAt) return` guard.
  startAt?: number
  // Fired once, the first time server-time crosses startAt (or immediately if
  // there is no gate). Callers use it to clear the "Get Ready" overlay.
  onStart?: () => void
  // Clamp the emitted value to at most this many seconds (unused by the live
  // countdown; available for a capped pre-roll).
  max?: number
}

// Remaining whole seconds until `endAt` in SERVER time. Shared by the live
// countdown and by the resync / visibilitychange snap callbacks that re-read
// the value without rescheduling.
export function currentSecondsLeft(endAt: number): number {
  return Math.max(0, Math.round((endAt - getServerNow()) / 1000))
}

// The server-time instant at which the displayed integer will next change,
// given the current `now`. Exposed for tests; the value `n` shown for
// `now ∈ (endAt - (n + 0.5)·1000, endAt - (n - 0.5)·1000]` flips to `n - 1` at
// `endAt - (n - 0.5)·1000`.
export function nextBoundaryAt(endAt: number, now: number): number {
  const n = Math.max(0, Math.round((endAt - now) / 1000))
  return endAt - (n - 0.5) * 1000
}

export function startBoundaryCountdown(
  endAt: number,
  onTick: (secondsLeft: number) => void,
  opts: CountdownOptions = {},
): CountdownHandle {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  let startFired = false

  const clamp = (n: number): number =>
    typeof opts.max === 'number' ? Math.min(opts.max, n) : n

  function stop(): void {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleNext(): void {
    if (stopped) return
    const now = getServerNow()
    // Pre-start gate: wake exactly at startAt (offset corrections that land
    // meanwhile just re-derive the wait on the next hop).
    if (opts.startAt !== undefined && now < opts.startAt) {
      timer = setTimeout(tick, opts.startAt - now + GUARD_MS)
      return
    }
    const n = Math.max(0, Math.round((endAt - now) / 1000))
    if (n <= 0) return // reached zero — nothing left to schedule
    const boundary = endAt - (n - 0.5) * 1000
    timer = setTimeout(tick, Math.max(0, boundary - now) + GUARD_MS)
  }

  function tick(): void {
    if (stopped) return
    const now = getServerNow()
    // Woke before startAt (clock offset shifted backward mid-wait) — re-gate.
    if (opts.startAt !== undefined && now < opts.startAt) {
      scheduleNext()
      return
    }
    if (!startFired) {
      startFired = true
      opts.onStart?.()
    }
    const left = Math.max(0, Math.round((endAt - now) / 1000))
    onTick(clamp(left))
    if (left <= 0) {
      stop()
      return
    }
    scheduleNext()
  }

  // Initial paint: emit immediately unless we're still in the get-ready gate
  // (the caller owns the "Get Ready" UI until onStart fires).
  const now0 = getServerNow()
  if (!(opts.startAt !== undefined && now0 < opts.startAt)) {
    startFired = true
    opts.onStart?.()
    onTick(clamp(Math.max(0, Math.round((endAt - now0) / 1000))))
  }
  scheduleNext()

  return { stop }
}
