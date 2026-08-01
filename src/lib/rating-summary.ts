export interface RatingMetrics {
  average: number
  ratingMax: number
  total: number
}

export function getRatingMetrics(
  histogram: number[],
  storedAverage: number | null | undefined,
  configuredMax: number | null | undefined,
): RatingMetrics | null {
  const ratingMax = Math.max(1, Math.round((configuredMax ?? histogram.length) || 5))
  const total = histogram.reduce((sum, count) => sum + Math.max(0, count), 0)
  if (total === 0) return null

  const derivedAverage = histogram.reduce(
    (sum, count, index) => sum + Math.max(0, count) * (index + 1),
    0,
  ) / total
  const sourceAverage = typeof storedAverage === 'number' && Number.isFinite(storedAverage)
    ? storedAverage
    : derivedAverage

  return {
    average: Math.min(ratingMax, Math.max(0, sourceAverage)),
    ratingMax,
    total,
  }
}
