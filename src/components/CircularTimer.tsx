'use client'

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // 125.66

export function CircularTimer({ timeLeft, total }: { timeLeft: number; total: number }) {
  const progress = total > 0 ? timeLeft / total : 0
  const offset = CIRCUMFERENCE * (1 - progress)
  const isLow = timeLeft <= 5

  return (
    <div className="relative w-12 h-12">
      <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="#e0e7ff" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={RADIUS} fill="none"
          stroke={isLow ? '#ef4444' : '#4f46e5'}
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${isLow ? 'text-red-500' : 'text-indigo-600'}`}>
        {timeLeft}
      </span>
    </div>
  )
}
