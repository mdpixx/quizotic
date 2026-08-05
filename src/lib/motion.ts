// Shared motion vocabulary for the presentation stage.
//
// Before this file every component invented its own timing — the spring
// `cubic-bezier(0.34,1.56,0.64,1)` at 0.6s appeared in four separate places,
// the slide pager used 0.34s `[0.22,1,0.36,1]`, the word cloud used a bare
// `duration-500`, and the speed waveform used `duration-300`. Nothing was
// wrong individually; together they read as several UIs sharing a screen.
//
// The rule this file encodes:
//
//   entrances     → EASE.out      (things arriving settle, they don't bounce)
//   value changes → EASE.spring   (a bar growing has momentum)
//   exits         → EASE.calm at 60% duration (leaving is never the story)
//
// Durations are milliseconds. Framer Motion wants seconds, so use `sec()`.

export const DUR = {
  instant: 120,
  quick: 200,
  base: 320,
  slow: 520,
  entrance: 680,
} as const

export type DurationKey = keyof typeof DUR

// Cubic-bezier control points. Typed as 4-tuples so Framer Motion accepts them
// directly as an `ease` value without a cast at each call site.
export const EASE = {
  /** Expo-out. Default for anything entering or settling into place. */
  out: [0.22, 1, 0.36, 1],
  /** Overshoots ~11%. For values that change magnitude — bar widths, handles. */
  spring: [0.34, 1.56, 0.64, 1],
  /** Material standard. Neutral; use for exits and colour/opacity shifts. */
  calm: [0.4, 0, 0.2, 1],
  /** Symmetric. For looping ambient motion that should have no visible start. */
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

export type EaseKey = keyof typeof EASE

/** Per-item delay for staggered groups, in milliseconds. */
export const STAGGER = {
  tight: 40,
  base: 70,
  loose: 110,
} as const

/** Milliseconds → seconds, for Framer Motion's `transition` objects. */
export function sec(ms: number): number {
  return ms / 1000
}

/** CSS `transition` shorthand, e.g. `cssTransition('width', 'slow', 'spring')`. */
export function cssTransition(
  property: string,
  duration: DurationKey = 'base',
  ease: EaseKey = 'out',
): string {
  const [a, b, c, d] = EASE[ease]
  return `${property} ${DUR[duration]}ms cubic-bezier(${a},${b},${c},${d})`
}

export interface MotionSpec {
  /** Duration in milliseconds. */
  duration: number
  ease: readonly [number, number, number, number]
  /** Per-item stagger in milliseconds. Omitted for single elements. */
  stagger?: number
}

/**
 * Collapses a motion spec when the viewer has asked for reduced motion.
 *
 * Reduced motion means "no movement", not "no feedback" — a stage where
 * results appear with no transition at all reads as broken rather than calm.
 * So the reduced form keeps a short opacity-only fade and drops the stagger,
 * which is what actually causes discomfort (many elements moving at once).
 *
 * Callers are still responsible for not animating `transform`/`x`/`y` under
 * reduce; this only bounds the timing.
 */
export function motionSafe(reduce: boolean, spec: MotionSpec): MotionSpec {
  if (!reduce) return spec
  return { duration: Math.min(spec.duration, 150), ease: EASE.calm }
}

/** Framer Motion `transition` object from a spec. */
export function toTransition(spec: MotionSpec): { duration: number; ease: readonly [number, number, number, number] } {
  return { duration: sec(spec.duration), ease: spec.ease }
}

/**
 * Delay for the nth item of a staggered group, in milliseconds.
 *
 * Capped so a large result set doesn't push the last item past the point
 * where the presenter has already moved on — with 200 pins on a grid and no
 * cap, a 40ms stagger would still be placing dots eight seconds later.
 */
export function staggerDelay(index: number, step: number = STAGGER.tight, cap: number = 400): number {
  return Math.min(index * step, cap)
}
