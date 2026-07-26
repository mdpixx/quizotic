'use client'

import { useState } from 'react'

// Urgency ramp: rest colour → amber at ≤10s → red + pulse at ≤5s. The pulse
// uses Tailwind's motion-safe variant so prefers-reduced-motion users get the
// colour change without the animation. `size` lets the host bar run a slimmer
// circle to save vertical space without changing the ring math.
//
// `variant` themes the ring for its background: 'light' (default) is tuned for
// the participant's light card — navy rest ring on a faint navy track. 'dark'
// is for the host's navy Atrium stage, where a navy ring would be invisible —
// it uses a white rest ring on a faint white track. The amber/red urgency
// colours are shared, so both surfaces read the same when time runs low.
export function CircularTimer({
  timeLeft,
  total,
  size = 80,
  variant = 'light',
}: {
  timeLeft: number
  total: number
  size?: number
  variant?: 'light' | 'dark'
}) {
  const radius = size * 0.4
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  // Clamp to 1 — a host-extended timer can push timeLeft above the question's
  // original duration, and an unclamped ratio yields a negative dash offset.
  const progress = Math.min(1, total > 0 ? timeLeft / total : 0)
  const offset = circumference * (1 - progress)
  const isLow = timeLeft <= 5
  const isWarning = timeLeft <= 10 && !isLow

  // Ease the ring over 1s for the ordinary per-second decrement (host and
  // participant now step in lockstep, so their rings glide together), but SNAP
  // instantly when the value jumps by more than one second — a clock-offset
  // resync or a tab-wake can move it several seconds at once, and a 1s glide
  // there reads as the ring lagging the number. Track the previous value in
  // state (React's sanctioned "adjust state on prop change" pattern) so we
  // never read a ref during render; `snap` persists into the committed render.
  const [prevTimeLeft, setPrevTimeLeft] = useState(timeLeft)
  const [snap, setSnap] = useState(false)
  if (timeLeft !== prevTimeLeft) {
    setSnap(Math.abs(timeLeft - prevTimeLeft) > 1)
    setPrevTimeLeft(timeLeft)
  }
  const dashTransition = snap ? 'stroke-dashoffset 0s' : 'stroke-dashoffset 1s linear'

  // A question with `timerSeconds: 0` has no deadline at all, so there is no
  // countdown to draw. Rendering the ring anyway painted an empty track around a
  // red, pulsing "0" — `timeLeft` of 0 trips the `isLow` urgency ramp — which
  // read as "time is up" the instant the question opened. The participant's
  // linear progress bar and the host's room gauge already omit themselves for
  // no-timer questions; the ring now matches them instead of contradicting them.
  //
  // Placed AFTER the hooks on purpose: MobileTopBar keeps one instance mounted
  // across questions, so a timed question following an untimed one would change
  // the hook count if this returned earlier.
  if (!(total > 0)) return null

  const isDark = variant === 'dark'
  const trackColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,27,61,0.15)'
  const restColor = isDark ? '#FFFFFF' : '#0F1B3D'
  const ringColor = isLow ? '#DC2626' : isWarning ? '#F59E0B' : restColor

  // The digits used to be `text-white` for BOTH variants, so on the participant's
  // light surfaces they were white-on-white — measured 1:1 contrast, readable
  // only through the drop shadow's blur. They now track the ring, so the number
  // and its arc always read as one object.
  //
  // Light needs darker urgency hues than dark does: amber-500 on white is 2.1:1,
  // under the 3:1 floor even for large bold text, so light steps down to
  // amber-700. The dark variant keeps exactly the colours it renders today, so
  // the host stage is visually unchanged.
  const digitColor = isDark
    ? (isLow ? '#EF4444' : isWarning ? '#F59E0B' : '#FFFFFF')
    : (isLow ? '#DC2626' : isWarning ? '#B45309' : '#0F1B3D')

  return (
    <div className={`relative ${isLow ? 'motion-safe:animate-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth="4" />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke={ringColor}
          strokeWidth={isLow ? 5 : 4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: `${dashTransition}, stroke 0.3s, stroke-width 0.3s` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: digitColor,
          // The shadow exists to lift white digits off the host's busy navy
          // stage. On the light card it only muddied dark digits.
          textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.5)' : undefined,
          fontSize: size >= 76 ? '1.5rem' : '1.25rem',
        }}>
        {timeLeft}
      </span>
    </div>
  )
}
