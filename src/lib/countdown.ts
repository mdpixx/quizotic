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
  // Rounding for the displayed whole-seconds value. The live question timer
  // uses the default 'round' (flips at half-second boundaries, so a 20s timer
  // reads "20" right away). The 3-2-1 get-ready overlay uses 'ceil' so each
  // digit owns a FULL second — 3:[3s,2s) 2:[2s,1s) 1:[1s,0s) — and the "1"→0
  // transition lands exactly on startAt, aligning with the live timer's
  // onStart gate (no ~500ms blank gap before the overlay clears).
  round?: 'round' | 'ceil'
}

// Remaining whole seconds until `endAt` in SERVER time. Shared by the live
// countdown and by the resync / visibilitychange snap callbacks that re-read
// the value without rescheduling.
export function currentSecondsLeft(endAt: number): number {
  return Math.max(0, Math.round((endAt - getServerNow()) / 1000))
}

// Apply the rounding mode (default 'round') to a raw seconds value. Exposed so
// the engine and any caller can agree on rounding without duplicating the math.
export function applyRoundMode(raw: number, mode?: 'round' | 'ceil'): number {
  return mode === 'ceil' ? Math.ceil(raw) : Math.round(raw)
}

// The server-time instant at which the displayed integer will next change,
// given the current `now` and rounding mode. For the default 'round' mode the
// value `n` shown for `now ∈ (endAt - (n + 0.5)·1000, endAt - (n - 0.5)·1000]`
// flips to `n - 1` at `endAt - (n - 0.5)·1000`. For 'ceil' mode each digit owns
// a full second — `n` shown for `now ∈ (endAt - n·1000, endAt - (n-1)·1000]`
// flips at the whole-second boundary `endAt - (n - 1)·1000` — so the 3-2-1
// get-ready overlay lands its final "1"→0 transition exactly on `startAt`.
export function nextBoundaryAt(endAt: number, now: number, mode?: 'round' | 'ceil'): number {
  const n = Math.max(0, applyRoundMode((endAt - now) / 1000, mode))
  // Flip boundary: round → endAt - (n - 0.5)·1000 (half-second);
  // ceil → endAt - (n - 1)·1000 (whole-second).
  return mode === 'ceil' ? endAt - (n - 1) * 1000 : endAt - (n - 0.5) * 1000
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
  // Shared rounding: every internal site and the initial paint must agree, so a
  // 'ceil' get-ready overlay flips at whole-second boundaries instead of the
  // round mode's half-second boundaries.
  const roundedLeft = (now: number): number =>
    Math.max(0, applyRoundMode((endAt - now) / 1000, opts.round))

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
    // Schedule to the boundary of the CLAMPED displayed value, not the raw
    // value: when `max` is clamping (e.g. raw=4 shown as 3) the raw 4→3 flip is
    // NOT a visible change, so waking there would emit a redundant duplicate
    // tick ~500ms later. Deriving the wait from the displayed value skips
    // straight to the next change the user actually sees.
    const displayed = clamp(roundedLeft(now))
    if (displayed <= 0) return // reached zero — nothing left to schedule
    const boundary = opts.round === 'ceil'
      ? endAt - (displayed - 1) * 1000
      : endAt - (displayed - 0.5) * 1000
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
    const left = roundedLeft(now)
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
    onTick(clamp(roundedLeft(now0)))
  }
  scheduleNext()

  return { stop }
}
