// Kernel density estimation for the rating / 100-point scale slides.
//
// Those two types previously rendered a single large average and threw the
// distribution away, which is the one number that cannot tell a presenter what
// they actually want to know. A room that answers all 3s and a room that
// splits 1/5 both average 3.0; only the second is worth talking about.
//
// Deliberately dependency-free and pure so it unit-tests without a DOM, and so
// the curve can be computed identically on the host stage and (later) in a
// report.

export interface DensityOptions {
  /** Inclusive domain of the scale, e.g. [1, 5] or [0, 100]. */
  domain: [number, number]
  /** Number of samples across the domain. Fixed so paths interpolate. */
  points?: number
  /**
   * Lower bound on bandwidth, as a fraction of the domain width.
   *
   * Silverman's rule collapses toward zero as the sample variance does, so a
   * single response — or twenty identical ones — would otherwise render as a
   * spike of infinite height and no width. The floor turns that into a soft
   * bump, which is both honest (one person answered) and legible.
   */
  minBandwidthFraction?: number
}

const DEFAULTS = {
  points: 64,
  minBandwidthFraction: 1 / 14,
}

/** Sample standard deviation. Returns 0 for fewer than two samples. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/**
 * Silverman's rule of thumb, floored so a degenerate sample still has width.
 */
export function bandwidth(values: number[], domain: [number, number], minFraction: number): number {
  const span = domain[1] - domain[0]
  const floor = span * minFraction
  if (values.length < 2) return floor
  const silverman = 1.06 * stdDev(values) * Math.pow(values.length, -1 / 5)
  return Math.max(silverman, floor)
}

/**
 * Gaussian KDE evaluated at `points` evenly spaced positions across `domain`.
 *
 * Always returns exactly `points` values, including for an empty sample (all
 * zeros). That fixed length is what lets the renderer interpolate between two
 * successive curves — the path morphs as responses arrive rather than being
 * redrawn from scratch on every vote.
 */
export function kde(values: number[], options: DensityOptions): number[] {
  const { domain } = options
  const points = options.points ?? DEFAULTS.points
  const minFraction = options.minBandwidthFraction ?? DEFAULTS.minBandwidthFraction

  const out = new Array<number>(points).fill(0)
  if (values.length === 0) return out

  const [lo, hi] = domain
  const span = hi - lo
  const h = bandwidth(values, domain, minFraction)
  const norm = 1 / (values.length * h * Math.sqrt(2 * Math.PI))

  for (let i = 0; i < points; i++) {
    const x = lo + span * (i / (points - 1))
    let sum = 0
    for (const v of values) {
      const u = (x - v) / h
      sum += Math.exp(-0.5 * u * u)
    }
    out[i] = sum * norm
  }
  return out
}

/**
 * Turns density samples into a closed SVG path, smoothed with quadratic
 * midpoints. `width`/`height` are viewBox units; the caller stretches the
 * viewBox to the frame.
 *
 * The curve is normalised to its own peak, so the ridge always fills the
 * available height. Absolute density is meaningless to an audience — the shape
 * is the message.
 */
export function densityPath(
  samples: number[],
  width: number,
  height: number,
  /**
   * Fraction of the frame left clear above the tallest point.
   *
   * Without it the peak lands exactly on the top edge and the ridge reads as
   * a filled area chart pressed against the ceiling rather than a curve.
   */
  headroom = 0.08,
): string {
  const n = samples.length
  if (n < 2) return `M 0 ${height} L ${width} ${height} Z`

  const peak = Math.max(...samples)
  const usable = height * (1 - headroom)
  const x = (i: number) => (i / (n - 1)) * width
  // A flat-zero sample set (no responses) must sit on the baseline, not fill.
  const y = (i: number) => (peak <= 0 ? height : height - (samples[i] / peak) * usable)

  let d = `M 0 ${height} L ${x(0).toFixed(2)} ${y(0).toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2
    const my = (y(i) + y(i + 1)) / 2
    d += ` Q ${x(i).toFixed(2)} ${y(i).toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`
  }
  d += ` L ${x(n - 1).toFixed(2)} ${y(n - 1).toFixed(2)} L ${width} ${height} Z`
  return d
}

/** Arithmetic mean, or null for an empty sample. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Where the mean sits across the domain, as a 0–1 fraction. */
export function meanFraction(values: number[], domain: [number, number]): number | null {
  const m = mean(values)
  if (m === null) return null
  const [lo, hi] = domain
  if (hi === lo) return 0
  return Math.min(1, Math.max(0, (m - lo) / (hi - lo)))
}
