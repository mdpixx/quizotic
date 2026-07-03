'use client'

// Accuracy donut + correct / incorrect / unattempted breakdown shown on the
// host's answer-reveal footer. Pure SVG — semantic result colors, not the
// answer-option palette (those hues mean option identity, not correctness).

const COLORS = {
  correct: '#16A34A',
  incorrect: '#DC2626',
  unattempted: '#9CA3AF',
} as const

interface RevealStatsDonutProps {
  correct: number
  incorrect: number
  unattempted: number
}

export function RevealStatsDonut({ correct, incorrect, unattempted }: RevealStatsDonutProps) {
  const total = Math.max(0, correct) + Math.max(0, incorrect) + Math.max(0, unattempted)
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const size = 96
  const stroke = 10
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const arc = total > 0 ? (correct / total) * circumference : 0

  const rows = [
    { label: 'Correct', value: correct, color: COLORS.correct },
    { label: 'Incorrect', value: incorrect, color: COLORS.incorrect },
    { label: 'Unattempted', value: unattempted, color: COLORS.unattempted },
  ]

  return (
    <div className="flex items-center gap-4 flex-shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${accuracy}% accuracy`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.correct}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference - arc}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="900" fontFamily="var(--font-heading)">
          {accuracy}%
        </text>
      </svg>
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.82)' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
            <span>{row.label}</span>
            <span className="tabular-nums font-black" style={{ color: '#fff' }}>{row.value}/{total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
