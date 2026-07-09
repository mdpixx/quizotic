'use client'

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

  const isDark = variant === 'dark'
  const trackColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,27,61,0.15)'
  const restColor = isDark ? '#FFFFFF' : '#0F1B3D'
  const ringColor = isLow ? '#DC2626' : isWarning ? '#F59E0B' : restColor
  const textColor = isLow ? 'text-red-500' : isWarning ? 'text-amber-400' : 'text-white'

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
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s, stroke-width 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-black ${textColor}`}
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontSize: size >= 76 ? '1.5rem' : '1.25rem' }}>
        {timeLeft}
      </span>
    </div>
  )
}
