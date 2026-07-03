'use client'

import { useCallback, useRef } from 'react'
import type { Options as ConfettiOptions, Shape, CreateTypes } from 'canvas-confetti'

// Single source of truth for celebration bursts across the app. Every site
// that previously called canvas-confetti directly (Podium winner reveal,
// participant correct-answer pop, voting milestone, leaderboard ambient loop)
// should fire through this hook so the look stays consistent and shape/physics
// tuning lives in one place.
//
// ── Why we bind to an explicit canvas (the previous bug) ────────────────────
// canvas-confetti's DEFAULT appends its own canvas to document.body. That had
// stopped rendering in the host finale: the podium lives inside a framer-motion
// <motion.section> (which applies a `transform`) with overflow:hidden, and the
// global canvas ended up clipped / behind the stacked section so particles drew
// but were never visible. The fix is to render OUR OWN full-viewport canvas as
// a direct child of <body> (portal'd, position:fixed, pointer-events:none, a
// z-index that beats everything) and bind confetti to it with confetti.create.
// Because this canvas is a body-level sibling — not inside any transformed or
// clipped ancestor — confetti is always painted on top. This is the
// library-documented pattern for embedding confetti into an existing app.

type Preset = 'winner' | 'mini' | 'milestone' | 'ambient'

type ConfettiFn = (options?: ConfettiOptions) => Promise<null> | null

const BRAND_COLORS = [
  '#0F1B3D', '#FBD13B', '#FF8A47', '#16A34A',
  '#2D3A8C', '#FFFFFF', '#DC2626', '#7C3AED',
  '#22D3EE', '#EC4899', '#FBBF24',
]
const GOLD_COLORS = ['#FFE066', '#FBD13B', '#FFFFFF', '#FFC300', '#FBBF24', '#FFD700']

const CONFETTI_CANVAS_ID = 'quizotic-confetti-canvas'

// Lazily create (once per page) a full-viewport <canvas> appended directly to
// <body>, then return it. Idempotent — repeated calls return the same node.
function getConfettiCanvas(): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('document unavailable')
  const existing = document.getElementById(CONFETTI_CANVAS_ID) as HTMLCanvasElement | null
  if (existing) return existing
  const canvas = document.createElement('canvas')
  canvas.id = CONFETTI_CANVAS_ID
  // Full viewport, fixed, never blocks pointer events, always on top. Inline
  // styles so no CSS load order / Tailwind purge can strip it.
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999',
    // Transparent so it never dims the podium beneath it.
    background: 'transparent',
  } as Partial<CSSStyleDeclaration>)
  document.body.appendChild(canvas)
  return canvas
}

// Cached confetti scope bound to our dedicated canvas + custom shapes. Built
// lazily on first call so the participant join page (which doesn't celebrate)
// never pays the cost.
let cached: {
  confetti: CreateTypes
  shapes: { rect: Shape; ribbon: Shape; curl: Shape; star: Shape; circle: Shape; square: Shape }
} | null = null

async function loadConfetti() {
  if (cached) return cached
  try {
    const mod = await import('canvas-confetti')
    // Bind to our body-level canvas. `resize` keeps it sized to the viewport;
    // `useWorker` offloads the physics off the main thread for smoother bursts.
    const canvas = getConfettiCanvas()
    const confetti = mod.default.create(canvas, { resize: true, useWorker: true }) as CreateTypes
    const make = mod.default.shapeFromPath as ((opts: { path: string }) => Shape) | undefined
    // Real-world confetti is mostly rectangles (3:1) with the occasional
    // long ribbon (8:1). Both shapes carry per-particle rotation in
    // canvas-confetti so they tumble naturally on the way down.
    const rect: Shape = make ? make({ path: 'M 0 0 L 9 0 L 9 3 L 0 3 Z' }) : 'square'
    const ribbon: Shape = make ? make({ path: 'M 0 0 L 24 0 L 24 3 L 0 3 Z' }) : 'square'
    const curl: Shape = make ? make({ path: 'M 1 10 C 1 2 19 2 19 10 C 19 18 7 18 7 11 L 11 11 C 11 14 15 14 15 10 C 15 6 5 6 5 10 Z' }) : 'circle'
    cached = {
      confetti,
      shapes: { rect, ribbon, curl, star: 'star', circle: 'circle', square: 'square' },
    }
    return cached
  } catch (err) {
    // Surface the failure instead of silently no-opping. A previous regression
    // (dead 'winner' preset + silent catch) made confetti vanish with zero
    // console output, which looked like "confetti doesn't work." Log once.
    if (!loadConfettiWarned) {
      loadConfettiWarned = true
      console.warn('[quizotic] canvas-confetti failed to load — celebrations will be skipped.', err)
    }
    return null
  }
}
let loadConfettiWarned = false
let reducedMotionLoopWarned = false

// Probe Battery API once per session. Returns 0.5 for low battery (halve
// counts) or 1 for full power. Cached to avoid awaiting the Battery promise
// on every burst.
let batteryScale: number | null = null
async function getBatteryScale(): Promise<number> {
  if (batteryScale !== null) return batteryScale
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }
    if (typeof nav.getBattery === 'function') {
      const b = await nav.getBattery()
      batteryScale = (b.level < 0.2 && !b.charging) ? 0.5 : 1
    } else {
      batteryScale = 1
    }
  } catch {
    batteryScale = 1
  }
  return batteryScale
}

function scale(opts: ConfettiOptions, factor: number): ConfettiOptions {
  if (factor === 1) return opts
  return {
    ...opts,
    particleCount: Math.max(8, Math.round((opts.particleCount ?? 50) * factor)),
  }
}

// ─── Preset implementations ──────────────────────────────────────────────────

async function firePreset(preset: Preset) {
  const lib = await loadConfetti()
  if (!lib) return // loadConfetti already warned via console
  const { confetti, shapes } = lib
  // Visible confirmation the call path + canvas binding succeeded. Look for
  // this in the browser console on the next play — if it logs but you still
  // see no confetti, the issue is rendering (z-index/clip), not the call.
  console.info(`[quizotic] confetti fired: preset=${preset}`, { canvasBound: true })
  const factor = await getBatteryScale()
  const base: ConfettiOptions = {
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    decay: 0.92,
    gravity: 1.0,
  }
  // Mostly rectangles, some ribbons and circles, occasional star.
  const mixedShapes = [shapes.rect, shapes.rect, shapes.ribbon, shapes.curl, shapes.circle, shapes.star]

  if (preset === 'winner') {
    fireWinner(confetti, base, mixedShapes, shapes, factor)
    return
  }
  if (preset === 'mini') {
    confetti(scale({
      ...base, origin: { x: 0.5, y: 0.7 }, angle: 90, spread: 75,
      particleCount: 35, startVelocity: 40, gravity: 1.0, decay: 0.9, ticks: 200,
      scalar: 0.9, shapes: mixedShapes,
    }, factor))
    return
  }
  if (preset === 'milestone') {
    confetti(scale({
      ...base, origin: { x: 0, y: 0.95 }, angle: 70, spread: 40,
      particleCount: 50, startVelocity: 70, ticks: 300, scalar: 1.0, shapes: mixedShapes,
    }, factor))
    confetti(scale({
      ...base, origin: { x: 1, y: 0.95 }, angle: 110, spread: 40,
      particleCount: 50, startVelocity: 70, ticks: 300, scalar: 1.0, shapes: mixedShapes,
    }, factor))
    return
  }
  // ambient — single side-cannon shot used by the podium loop variant.
  confetti(scale({
    ...base, origin: { x: 0.02, y: 0.85 }, angle: 75, spread: 55,
    particleCount: 35, startVelocity: 65, ticks: 350, scalar: 1.05, shapes: mixedShapes,
  }, factor))
  confetti(scale({
    ...base, origin: { x: 0.98, y: 0.85 }, angle: 105, spread: 55,
    particleCount: 35, startVelocity: 65, ticks: 350, scalar: 1.05, shapes: mixedShapes,
  }, factor))
}

function fireWinner(
  confetti: ConfettiFn,
  base: ConfettiOptions,
  mixedShapes: Shape[],
  shapes: { rect: Shape; ribbon: Shape; curl: Shape; star: Shape; circle: Shape },
  factor: number,
) {
  // Phase 1 (t=0): two side cannons firing inward and upward.
  confetti(scale({
    ...base, origin: { x: 0.02, y: 0.85 }, angle: 75, spread: 50,
    particleCount: 100, startVelocity: 80, ticks: 350, scalar: 1.1, shapes: mixedShapes,
  }, factor))
  confetti(scale({
    ...base, origin: { x: 0.98, y: 0.85 }, angle: 105, spread: 50,
    particleCount: 100, startVelocity: 80, ticks: 350, scalar: 1.1, shapes: mixedShapes,
  }, factor))

  // Phase 2 (t=300): center fountain.
  setTimeout(() => confetti(scale({
    ...base, origin: { x: 0.5, y: 0.9 }, angle: 90, spread: 70,
    particleCount: 120, startVelocity: 65, ticks: 320, scalar: 1.0, shapes: mixedShapes,
  }, factor)), 300)

  // Phase 3 (t=900): side cannons reload — heavier on ribbons for streamer feel.
  setTimeout(() => {
    const ribbonHeavy = [shapes.ribbon, shapes.ribbon, shapes.curl, shapes.curl, shapes.rect, shapes.circle]
    confetti(scale({
      ...base, origin: { x: 0.02, y: 0.85 }, angle: 75, spread: 50,
      particleCount: 60, startVelocity: 70, ticks: 400, scalar: 1.15, shapes: ribbonHeavy,
    }, factor))
    confetti(scale({
      ...base, origin: { x: 0.98, y: 0.85 }, angle: 105, spread: 50,
      particleCount: 60, startVelocity: 70, ticks: 400, scalar: 1.15, shapes: ribbonHeavy,
    }, factor))
  }, 900)

  // Phase 4 (t=1800): drift rain — the falling layer comes from the top with
  // very low initial velocity so gravity is doing all the work.
  setTimeout(() => confetti(scale({
    ...base, origin: { x: 0.5, y: -0.05 }, angle: 270, spread: 180,
    particleCount: 80, startVelocity: 5, gravity: 0.7, ticks: 500, scalar: 0.85,
    shapes: mixedShapes,
  }, factor)), 1800)

  // Phase 5 (t=2800): gold crown burst — pure gold rectangles.
  setTimeout(() => confetti(scale({
    ...base, origin: { x: 0.5, y: 0.5 }, angle: 90, spread: 360,
    particleCount: 90, startVelocity: 35, ticks: 280, scalar: 1.2,
    shapes: [shapes.rect, shapes.rect, shapes.ribbon],
    colors: GOLD_COLORS,
  }, factor)), 2800)

  // Phase 6 (t=3600): star streamers — final flourish.
  setTimeout(() => confetti(scale({
    ...base, origin: { x: 0.5, y: 0.4 }, angle: 90, spread: 100,
    particleCount: 50, startVelocity: 50, ticks: 350, scalar: 1.4,
    shapes: ['star'],
    colors: GOLD_COLORS,
  }, factor)), 3600)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConfetti() {
  // Avoid duplicate fires within a single tick (e.g. double-click on podium
  // reveal). Last-fire timestamp keyed by preset.
  const lastFiredRef = useRef<Record<Preset, number>>({ winner: 0, mini: 0, milestone: 0, ambient: 0 })

  return useCallback((preset: Preset = 'winner') => {
    const now = Date.now()
    const last = lastFiredRef.current[preset]
    // 80ms cooldown — long enough to debounce React StrictMode double-render,
    // short enough that an intentional rapid sequence still fires.
    if (now - last < 80) return
    lastFiredRef.current[preset] = now
    void firePreset(preset)
  }, [])
}

// Looping ambient celebration — replaces Podium.startConfettiLoop. Returns a
// stop() that the caller MUST invoke on unmount. Respects reduced motion.
export function startConfettiLoop(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Reduced-motion users get no animated confetti by design — but log it
    // once so "confetti isn't working" is diagnosable instead of a mystery.
    if (!reducedMotionLoopWarned) {
      reducedMotionLoopWarned = true
      console.info('[quizotic] prefers-reduced-motion is on — confetti loop is intentionally skipped.')
    }
    return () => {}
  }

  let stopped = false
  let tick = 0
  const timers: { welcome: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null } = {
    welcome: null,
    interval: null,
  }

  loadConfetti().then(lib => {
    if (stopped || !lib) return
    const { confetti, shapes } = lib
    const mixed = [shapes.rect, shapes.ribbon, shapes.curl, shapes.circle, shapes.star]

    // Welcome burst — the same physics as `winner` Phase 1+2 so the loop
    // begins with momentum instead of trickling in.
    confetti({
      colors: BRAND_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 1.0,
      origin: { x: 0.5, y: 0.6 }, angle: 90, spread: 110,
      particleCount: 140, startVelocity: 55, scalar: 1.15, ticks: 320, shapes: mixed,
    })
    setTimeout(() => {
      if (stopped) return
      confetti({
        colors: BRAND_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 1.0,
        origin: { x: 0.02, y: 0.85 }, angle: 75, spread: 60,
        particleCount: 80, startVelocity: 70, scalar: 1.1, ticks: 350, shapes: mixed,
      })
      confetti({
        colors: BRAND_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 1.0,
        origin: { x: 0.98, y: 0.85 }, angle: 105, spread: 60,
        particleCount: 80, startVelocity: 70, scalar: 1.1, ticks: 350, shapes: mixed,
      })
    }, 200)

    const fire = () => {
      tick++
      const variant = tick % 3
      if (variant === 0) {
        // Drift rain from the top — pure gravity fall.
        confetti({
          colors: GOLD_COLORS, disableForReducedMotion: true, decay: 0.92,
          origin: { x: 0.5, y: -0.05 }, angle: 270, spread: 180,
          particleCount: 50, startVelocity: 6, gravity: 0.75, ticks: 500, scalar: 0.85,
          shapes: mixed,
        })
      } else if (variant === 1) {
        // Side firework cannons.
        confetti({
          colors: BRAND_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 1.0,
          origin: { x: 0.02, y: 0.85 }, angle: 75, spread: 55,
          particleCount: 30, startVelocity: 65, scalar: 1.1, ticks: 350, shapes: mixed,
        })
        confetti({
          colors: BRAND_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 1.0,
          origin: { x: 0.98, y: 0.85 }, angle: 105, spread: 55,
          particleCount: 30, startVelocity: 65, scalar: 1.1, ticks: 350, shapes: mixed,
        })
      } else {
        // Star burst near the title area.
        confetti({
          colors: GOLD_COLORS, disableForReducedMotion: true, decay: 0.92, gravity: 0.95,
          origin: { x: 0.5, y: 0.4 }, angle: 90, spread: 110,
          particleCount: 50, startVelocity: 45, scalar: 1.3, ticks: 350, shapes: ['star'],
        })
      }
    }

    timers.welcome = setTimeout(fire, 900)
    timers.interval = setInterval(fire, 1800)
  }).catch(err => {
    // loadConfetti already warned; this catches any rejection from the chain.
    if (!loadConfettiWarned) {
      loadConfettiWarned = true
      console.warn('[quizotic] confetti loop aborted — library unavailable.', err)
    }
  })

  return () => {
    stopped = true
    if (timers.welcome) clearTimeout(timers.welcome)
    if (timers.interval) clearInterval(timers.interval)
  }
}
