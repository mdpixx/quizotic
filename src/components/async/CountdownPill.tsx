'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startBoundaryCountdown, type CountdownHandle } from '@/lib/countdown'

interface Props {
  deadlineAt: number // epoch ms in SERVER time — authoritative
  onExpire: () => void
  // serverNow - Date.now(), captured from the API. `deadlineAt` is server time,
  // so a phone whose clock is minutes off would otherwise read a wrong timer
  // from the first second. Defaults to 0 (trust the device clock).
  nowOffsetMs?: number
}

// Zero-padded MM:SS. The constant character count is the point, not cosmetics:
// the pill sits in a flex row beside a `flex-1` progress track, so a string
// that changes width as it counts down ("14:59" → "9:59" → "59s") resized the
// pill every second and reflowed the whole top bar. Minutes may run past 99 on
// a long limit — the pill's min-width absorbs the overflow rather than clipping.
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

// Whole seconds remaining, rounded the way the engine's 'ceil' mode does so the
// first paint agrees with the first tick.
function secondsUntil(deadlineAt: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000))
}

export function CountdownPill({ deadlineAt, onExpire, nowOffsetMs = 0 }: Props) {
  // Both live in refs so the countdown effect depends on `deadlineAt` alone.
  // onExpire is a useCallback keyed on the page's `phase`, so its identity
  // changes on every question → feedback → question step; as a dependency it
  // tore the timer down and restarted it at a fresh sub-second phase mid-quiz.
  const onExpireRef = useRef(onExpire)
  const offsetRef = useRef(nowOffsetMs)
  useEffect(() => {
    onExpireRef.current = onExpire
    offsetRef.current = nowOffsetMs
  })

  const clock = useCallback(() => Date.now() + offsetRef.current, [])

  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadlineAt, Date.now() + nowOffsetMs))
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    let handle: CountdownHandle | null = null

    // Boundary-scheduled rather than polled: the engine wakes at the exact
    // instant the digit changes and re-derives the next boundary from the clock
    // every hop, so it cannot drift. The old setInterval(500) sampled at a phase
    // that slid against the true second boundary, making some seconds flash by
    // in ~500ms and others linger ~1500ms.
    const start = () => {
      handle?.stop()
      handle = startBoundaryCountdown(deadlineAt, left => {
        setSecondsLeft(left)
        if (left <= 0 && !expiredRef.current) {
          expiredRef.current = true
          onExpireRef.current()
        }
      }, { round: 'ceil', now: clock })
    }
    start()

    // A backgrounded tab throttles setTimeout, so the pill can return stale and
    // late to expire. Restarting re-derives the value from the clock and emits
    // it immediately — the same snap the live participant screen performs.
    const snap = () => {
      if (document.visibilityState === 'visible') start()
    }
    document.addEventListener('visibilitychange', snap)
    window.addEventListener('focus', snap)

    return () => {
      handle?.stop()
      document.removeEventListener('visibilitychange', snap)
      window.removeEventListener('focus', snap)
    }
  }, [deadlineAt, clock])

  const urgent = secondsLeft <= 60

  return (
    <div
      role="timer"
      className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
        urgent ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-200'
      }`}
    >
      <span className="text-xs" aria-hidden="true">⏱</span>
      <span className="tabular-nums text-center min-w-[5ch]">{formatClock(secondsLeft)}</span>
    </div>
  )
}
