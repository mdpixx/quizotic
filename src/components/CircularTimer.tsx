'use client'

// Urgency ramp: brand navy → amber at ≤10s → red + pulse at ≤5s. The pulse
// uses Tailwind's motion-safe variant so prefers-reduced-motion users get the
// colour change without the animation. `size` lets the host bar run a slimmer
// circle to save vertical space without changing the ring math.
export function CircularTimer({ timeLeft, total, size = 80 }: { timeLeft: number; total: number; size?: number }) {
  const radius = size * 0.4
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  // Clamp to 1 — a host-extended timer can push timeLeft above the question's
  // original duration, and an unclamped ratio yields a negative dash offset.
  const progress = Math.min(1, total > 0 ? timeLeft / total : 0)
  const offset = circumference * (1 - progress)
  const isLow = timeLeft <= 5
  const isWarning = timeLeft <= 10 && !isLow

  const ringColor = isLow ? '#DC2626' : isWarning ? '#F59E0B' : '#0F1B3D'
  const textColor = isLow ? 'text-red-500' : isWarning ? 'text-amber-400' : 'text-white'

  return (
    <div className={`relative ${isLow ? 'motion-safe:animate-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(15,27,61,0.15)" strokeWidth="4" />
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
