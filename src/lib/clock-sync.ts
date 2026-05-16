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
// Best-of-N: keep the smallest-rtt sample's offset across a short burst at
// connect, then a slower steady-state cadence.

import type { Socket } from 'socket.io-client'

interface ClockSyncState {
  offsetMs: number      // add to client Date.now() to get server time
  rttMs: number
  samples: number
}

const state: ClockSyncState = { offsetMs: 0, rttMs: 0, samples: 0 }

let burstTimer: ReturnType<typeof setInterval> | null = null
let steadyTimer: ReturnType<typeof setInterval> | null = null
let bestRttMs = Infinity
let burstFiresLeft = 0
let activeSocket: Socket | null = null
let lastResyncAt = 0

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
      const offset = ((t1 - t0) + (t2 - t3)) / 2
      // Keep the offset from the smallest-rtt sample we've seen — that one
      // had the least transport-noise distortion.
      if (rtt > 0 && rtt < bestRttMs) {
        bestRttMs = rtt
        state.offsetMs = offset
        state.rttMs = rtt
      }
      state.samples++
    },
  )
}

export function startClockSync(socket: Socket): () => void {
  // Reset on a fresh connection (offset is meaningful only per-server-process).
  state.offsetMs = 0
  state.rttMs = 0
  state.samples = 0
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
export function resyncClock(): void {
  if (!activeSocket || !activeSocket.connected) return
  const now = Date.now()
  if (now - lastResyncAt < 2000) return
  lastResyncAt = now
  // Reset best-rtt so a fresh tight ping can replace a stale offset.
  bestRttMs = Infinity
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
