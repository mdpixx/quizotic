'use client'

const RADIUS = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CircularTimer({ timeLeft, total }: { timeLeft: number; total: number }) {
  const progress = total > 0 ? timeLeft / total : 0
  const offset = CIRCUMFERENCE * (1 - progress)
  const isLow = timeLeft <= 5

  return (
    <div className="relative w-20 h-20">
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="#dbeafe" strokeWidth="4" />
        <circle
          cx="40" cy="40" r={RADIUS} fill="none"
          stroke={isLow ? '#ef4444' : '#4361EE'}
          strokeWidth="4"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-2xl font-black ${isLow ? 'text-red-500' : 'text-blue-600'}`}>
        {timeLeft}
      </span>
    </div>
  )
}
