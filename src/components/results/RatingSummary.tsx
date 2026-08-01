import { getRatingMetrics } from '@/lib/rating-summary'

export function RatingSummary({
  histogram,
  average,
  ratingMax,
  className,
}: {
  histogram: number[]
  average?: number | null
  ratingMax?: number | null
  className?: string
}) {
  const metrics = getRatingMetrics(histogram, average, ratingMax)
  if (!metrics) {
    return (
      <div className={`rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm ${className ?? ''}`} style={{ color: '#94A3B8' }}>
        No ratings yet
      </div>
    )
  }

  const ratingLabel = metrics.total === 1 ? 'rating' : 'ratings'
  const accessibleLabel = `Average rating ${metrics.average.toFixed(2)} out of ${metrics.ratingMax} from ${metrics.total} ${ratingLabel}`

  return (
    <div
      className={`rounded-[14px] px-4 py-4 ${className ?? ''}`}
      style={{ background: '#FFFDF3', border: '1px solid #F4E5A1' }}
      role="img"
      aria-label={accessibleLabel}
    >
      <div className="flex items-center gap-0.5 overflow-hidden" aria-hidden="true">
        {Array.from({ length: metrics.ratingMax }).map((_, index) => {
          const fill = Math.min(1, Math.max(0, metrics.average - index))
          return (
            <span
              key={index}
              data-rating-star="true"
              className="relative inline-block flex-none font-display leading-none"
              style={{ fontSize: 'clamp(18px, 5vw, 30px)', color: '#CBD5E1' }}
            >
              ★
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${Math.round(fill * 100)}%`, color: '#FBD13B' }}
              >
                ★
              </span>
            </span>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong className="font-display text-[22px] font-black tabular-nums" style={{ color: '#0F1B3D' }}>
          {metrics.average.toFixed(2)} / {metrics.ratingMax}
        </strong>
        <span className="text-[12px] font-semibold" style={{ color: '#64748B' }}>
          {metrics.total} {ratingLabel}
        </span>
      </div>
    </div>
  )
}
