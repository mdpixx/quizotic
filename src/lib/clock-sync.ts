// NTP-style clock-sync for the participant socket.
//
// The server's submit_answer scoring uses (receivedAt - questionStartedAt)
// minus an rtt/2 hack to estimate when the player actually tapped. That
// breaks under asymmetric latency (mobile uplink slow, downlink fine) and
// under one-shot RTT noise. We replace the hack with a real handshake:
//
//   T0 — client send time (client clock)
//   T1 — server receive time (server clock)
//   T2 — server reply time   (server clock)
//   T3 — client receive time (client clock)
//
//   offset (client → server) ≈ ((T1 - T0) + (T2 - T3)) / 2
//   rtt                       ≈ (T3 - T0) - (T2 - T1)
//
// Offset selection: a rolling window of recent samples, taking the MEDIAN
// offset (not the smallest-RTT one). Median rejects outliers — a single
// lucky low-RTT ping that happened to carry a noisy offset no longer locks
// in for the whole session — while still tracking real clock drift over
// long sessions. The smallest-RTT sample's RTT value is still tracked
// separately for the display half-RTT correction (getMeasuredRttMs).

import type { Socket } from 'socket.io-client'

interface ClockSyncState {
  offsetMs: number      // add to client Date.now() to get server time
  rttMs: number
  samples: number
}

interface Sample {
  offset: number
  rtt: number
}

const state: ClockSyncState = { offsetMs: 0, rttMs: 0, samples: 0 }

// Rolling window of recent samples. Capped so memory stays bounded on a
// long session; median is recomputed on each new sample (cheap at this size).
const WINDOW_SIZE = 8
const sampleWindow: Sample[] = []

let burstTimer: ReturnType<typeof setInterval> | null = null
let steadyTimer: ReturnType<typeof setInterval> | null = null
let bestRttMs = Infinity
let burstFiresLeft = 0
let activeSocket: Socket | null = null
let lastResyncAt = 0

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Recompute the authoritative offset from the rolling window: take the
// MEDIAN offset across the lowest-RTT half of samples. Weighting toward
// low-RTT keeps transport noise out (those samples had the least asymmetric
// delay distortion) while the median (not min) avoids locking in a single
// lucky-but-noisy ping. With <4 samples we just take the plain median.
function recomputeOffset(): void {
  if (!sampleWindow.length) return
  if (sampleWindow.length < 4) {
    state.offsetMs = median(sampleWindow.map(s => s.offset))
    return
  }
  // Sort a copy by RTT, take the lower half, then median those offsets.
  const byRtt = [...sampleWindow].sort((a, b) => a.rtt - b.rtt)
  const half = byRtt.slice(0, Math.max(2, Math.ceil(byRtt.length / 2)))
  state.offsetMs = median(half.map(s => s.offset))
}

function ping(socket: Socket): void {
  if (!socket.connected) return
  const t0 = Date.now()
  // Server ack returns { receiveTime, replyTime }. Defensive against missing ack.
  socket.timeout(2500).emit(
    'ping_time',
    { clientTime: t0 },
    (err: Error | null, reply?: { receiveTime?: number; replyTime?: number }) => {
      if (err || !reply || typeof reply.receiveTime !== 'number' || typeof reply.replyTime !== 'number') return
      const t3 = Date.now()
      const t1 = reply.receiveTime
      const t2 = reply.replyTime
      const rtt = (t3 - t0) - (t2 - t1)
      if (rtt <= 0) return // impossible/negative — clock jumped, discard
      const offset = ((t1 - t0) + (t2 - t3)) / 2
      // Push into the rolling window (FIFO evict when full).
      sampleWindow.push({ offset, rtt })
      if (sampleWindow.length > WINDOW_SIZE) sampleWindow.shift()
      // Track the smallest-RTT seen for the display half-RTT correction.
      if (rtt < bestRttMs) {
        bestRttMs = rtt
        state.rttMs = rtt
      }
      // Median-of-window replaces the old permanent best-of-N lock-in.
      recomputeOffset()
      state.samples++
    },
  )
}

export function startClockSync(socket: Socket): () => void {
  // Reset on a fresh connection (offset is meaningful only per-server-process).
  state.offsetMs = 0
  state.rttMs = 0
  state.samples = 0
  sampleWindow.length = 0
  bestRttMs = Infinity
  activeSocket = socket

  // Burst: 6 pings 250ms apart at connect → quickly converge on a low-rtt sample.
  burstFiresLeft = 6
  ping(socket)
  burstTimer = setInterval(() => {
    if (burstFiresLeft <= 0) {
      if (burstTimer) clearInterval(burstTimer)
      burstTimer = null
      // Steady state: every 15s to track drift on long sessions (tightened
      // from 30s after live-session red-zone timer report).
      steadyTimer = setInterval(() => ping(socket), 15_000)
      return
    }
    burstFiresLeft--
    ping(socket)
  }, 250)

  return () => {
    if (burstTimer) { clearInterval(burstTimer); burstTimer = null }
    if (steadyTimer) { clearInterval(steadyTimer); steadyTimer = null }
    activeSocket = null
  }
}

// On-demand 3-ping burst, throttled to at most once every 2s. Call this from
// the participant client when a `question_show` arrives — it tightens the
// offset right before the timer math runs, catching drift that would
// otherwise make the question start in the red zone.
//
// onSettled fires once the burst has had time to land (or immediately when
// the call is throttled because a resync ran <2s ago — the offset is already
// fresh). Callers use it to recompute displayed remaining-time with the
// tightened offset instead of the possibly-stale one.
export function resyncClock(onSettled?: () => void): void {
  if (!activeSocket || !activeSocket.connected) {
    onSettled?.()
    return
  }
  const now = Date.now()
  if (now - lastResyncAt < 2000) {
    onSettled?.()
    return
  }
  lastResyncAt = now
  // Flush the window so fresh samples dominate — a stale offset captured
  // during a long lobby pause must not survive into the question. The two
  // best surviving samples are kept so a single bad resync burst can't
  // wipe a previously-good convergence.
  if (sampleWindow.length > 2) sampleWindow.splice(0, sampleWindow.length - 2)
  let firesLeft = 3
  ping(activeSocket)
  const t = setInterval(() => {
    if (firesLeft <= 0 || !activeSocket?.connected) {
      clearInterval(t)
      return
    }
    firesLeft--
    ping(activeSocket)
  }, 120)
  // 3 pings x 120ms apart + one typical mobile RTT of headroom.
  if (onSettled) setTimeout(onSettled, 600)
}

export function getServerTimeOffsetMs(): number {
  return state.offsetMs
}

export function getServerNow(): number {
  return Date.now() + state.offsetMs
}

export function getMeasuredRttMs(): number {
  return state.rttMs
}

// ─── Test-only helpers ──────────────────────────────────────────────────────
// Exposed so clock-sync.test.ts can drive the window directly without faking
// socket round-trips. Not for use in production code.
export const __test = {
  WINDOW_SIZE,
  ingestSample(offset: number, rtt: number): void {
    sampleWindow.push({ offset, rtt })
    if (sampleWindow.length > WINDOW_SIZE) sampleWindow.shift()
    if (rtt < bestRttMs) { bestRttMs = rtt; state.rttMs = rtt }
    recomputeOffset()
    state.samples++
  },
  resetForTest(): void {
    state.offsetMs = 0
    state.rttMs = 0
    state.samples = 0
    sampleWindow.length = 0
    bestRttMs = Infinity
  },
  windowLength(): number { return sampleWindow.length },
}
