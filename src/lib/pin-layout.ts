// De-overlap for the pin/scatter slide types (`grid_2x2`, `pinpoint`).
//
// Participants cluster. On a 2x2 grid most of a room lands in one quadrant,
// and the dots stack until six responses look like two. Nudging them apart is
// the difference between "everyone agrees" and "I cannot tell how many people
// answered".
//
// Coordinates are PERCENT OF PLOT (0–100), not pixels, so the spread scales
// with the projector instead of collapsing to nothing on a big screen.
//
// Sizing was measured, not guessed. A single relaxation pass capped at ~4px —
// the original spec — does essentially nothing: fourteen taps inside a 5% box
// stay a blob. Eight damped iterations with a 3%-of-plot cap on each dot's
// TOTAL displacement lifts the closest pair from 1.2% to 2.7% apart while no
// dot moves far enough to misrepresent where someone actually tapped.
//
// Full separation is explicitly not the goal. Mentimeter's clusters overlap
// too; the goal is that density stays legible.

export interface Pin {
  x: number
  y: number
}

export interface RelaxOptions {
  /** Target spacing between dot centres, in percent of plot. */
  minDistance?: number
  /** Hard cap on each dot's total displacement, in percent of plot. */
  maxDisplacement?: number
  /** Relaxation passes. More converges further; 8 is where it stops mattering. */
  iterations?: number
  /** Keep dots this far inside the plot edge, in percent. */
  padding?: number
}

const DEFAULTS: Required<RelaxOptions> = {
  minDistance: 3.4,
  maxDisplacement: 3,
  iterations: 8,
  padding: 2,
}

/** Damping per pass. Undamped pairwise pushes oscillate instead of settling. */
const DAMPING = 0.6

/** Golden angle — spreads coincident dots evenly instead of along one axis. */
const GOLDEN_ANGLE = 2.399963

/** Radial step for the pre-scatter, in percent of plot. */
const SCATTER_STEP = 0.35

/**
 * Breaks ties between exactly-coincident dots before relaxation runs.
 *
 * Pairwise repulsion cannot separate a stack on its own: with every dot at the
 * same point the problem is degenerate, each pair pushes along one shared
 * axis, and the displacement cap then lands every dot on one of two points.
 * Measured on six identical taps, the closest pair came out at 4.6e-10 — six
 * people rendering as one dot, which is the exact failure this module exists
 * to prevent.
 *
 * A phyllotaxis offset (golden angle, sqrt radius) fans them into 2-D first,
 * giving the relaxation real directions to work with. Indexed within the
 * coincident group so it stays deterministic.
 */
function preScatter(pins: Pin[]): Pin[] {
  const seen = new Map<string, number>()
  return pins.map(p => {
    const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}`
    const k = seen.get(key) ?? 0
    seen.set(key, k + 1)
    if (k === 0) return p
    const angle = k * GOLDEN_ANGLE
    const radius = SCATTER_STEP * Math.sqrt(k)
    return { x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius }
  })
}

/**
 * Spreads overlapping pins just enough to be countable.
 *
 * Pure and deterministic: the same input always produces the same output, so
 * a re-render never reshuffles the dots a viewer is already looking at.
 */
export function relaxPins(pins: readonly Pin[], options: RelaxOptions = {}): Pin[] {
  const { minDistance, maxDisplacement, iterations, padding } = { ...DEFAULTS, ...options }

  const origin = pins.map(p => ({ x: p.x, y: p.y }))
  if (pins.length < 2) return pins.map(p => ({ x: p.x, y: p.y }))

  const out = preScatter(pins.map(p => ({ x: p.x, y: p.y })))

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x
        const dy = out[j].y - out[i].y
        const dist = Math.hypot(dx, dy)

        // preScatter guarantees no two dots are still coincident here.
        if (dist >= minDistance || dist <= 1e-9) continue

        const push = ((minDistance - dist) / 2) * DAMPING
        const ux = dx / dist
        const uy = dy / dist
        out[i].x -= ux * push
        out[i].y -= uy * push
        out[j].x += ux * push
        out[j].y += uy * push
      }
    }
  }

  return out.map((p, i) => {
    let dx = p.x - origin[i].x
    let dy = p.y - origin[i].y
    const moved = Math.hypot(dx, dy)
    if (moved > maxDisplacement) {
      dx = (dx / moved) * maxDisplacement
      dy = (dy / moved) * maxDisplacement
    }
    return {
      x: clamp(origin[i].x + dx, padding, 100 - padding),
      y: clamp(origin[i].y + dy, padding, 100 - padding),
    }
  })
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Deterministic hash of a pin coordinate.
 *
 * Mirrors `pinColor` in PinMap so a dot's colour, drift phase, amplitude and
 * period all derive from where it sits — never from its array index, which
 * would reshuffle every time another response arrived. `salt` separates the
 * independent uses.
 */
export function pinHash(pin: Pin, salt: number): number {
  const bx = Math.round(pin.x / 2)
  const by = Math.round(pin.y / 2)
  return Math.abs((bx * 73856093) ^ (by * 19349663) ^ salt)
}

export interface DriftSpec {
  /** X amplitude in px. */
  dx: number
  /** Y amplitude in px. */
  dy: number
  /** Loop duration in seconds. */
  duration: number
  /** Negative offset in seconds, so dots are mid-loop on arrival. */
  delay: number
}

const DRIFT_SALT = { angle: 0x2545, amplitude: 0x51ed, period: 0x9e37 } as const

/**
 * Idle-drift parameters for one dot.
 *
 * Amplitude 1.5–3px over 2.5–4s: enough that the chart is visibly alive,
 * small enough that no dot appears to change its answer. Every dot gets its
 * own period and a negative delay so the field never pulses in unison —
 * synchronised drift reads as a glitch, not as life.
 *
 * Consumed as CSS custom properties driving a keyframe animation, never a
 * requestAnimationFrame loop: 200 dots on a JS loop drops frames on the kind
 * of laptop that is usually driving a projector.
 */
export function driftFor(pin: Pin): DriftSpec {
  const angle = (pinHash(pin, DRIFT_SALT.angle) % 628) / 100
  const amplitude = 1.5 + (pinHash(pin, DRIFT_SALT.amplitude) % 150) / 100
  const duration = 2.5 + (pinHash(pin, DRIFT_SALT.period) % 150) / 100
  const delay = -((pinHash(pin, DRIFT_SALT.period) % 400) / 100)
  return {
    dx: round2(Math.cos(angle) * amplitude),
    dy: round2(Math.sin(angle) * amplitude),
    duration: round2(duration),
    delay: round2(delay),
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Smallest centre-to-centre distance in a set. Infinity for fewer than two. */
export function closestPair(pins: readonly Pin[]): number {
  let min = Infinity
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      min = Math.min(min, Math.hypot(pins[j].x - pins[i].x, pins[j].y - pins[i].y))
    }
  }
  return min
}
