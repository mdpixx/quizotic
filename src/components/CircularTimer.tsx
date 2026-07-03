'use client'

const RADIUS = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Urgency ramp: brand navy → amber at ≤10s → red + pulse at ≤5s. The pulse
// uses Tailwind's motion-safe variant so prefers-reduced-motion users get the
// colour change without the animation.
export function CircularTimer({ timeLeft, total }: { timeLeft: number; total: number }) {
  // Clamp to 1 — a host-extended timer can push timeLeft above the question's
  // original duration, and an unclamped ratio yields a negative dash offset.
  const progress = Math.min(1, total > 0 ? timeLeft / total : 0)
  const offset = CIRCUMFERENCE * (1 - progress)
  const isLow = timeLeft <= 5
  const isWarning = timeLeft <= 10 && !isLow

  const ringColor = isLow ? '#DC2626' : isWarning ? '#F59E0B' : '#0F1B3D'
  const textColor = isLow ? 'text-red-500' : isWarning ? 'text-amber-400' : 'text-white'

  return (
    <div className={`relative w-20 h-20 ${isLow ? 'motion-safe:animate-pulse' : ''}`}>
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="rgba(15,27,61,0.15)" strokeWidth="4" />
        <circle
          cx="40" cy="40" r={RADIUS} fill="none"
          stroke={ringColor}
          strokeWidth={isLow ? 5 : 4}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s, stroke-width 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-2xl font-black ${textColor}`}
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
        {timeLeft}
      </span>
    </div>
  )
}
