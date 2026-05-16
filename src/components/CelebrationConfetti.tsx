'use client'

import { useEffect, useState } from 'react'

// DOM-based celebration particle layer — a deterministic, CSS-only backup
// for canvas-confetti. Paints pure <span>s with keyframe animations so it
// keeps celebrating even if canvas-confetti fails to load or is clipped by
// an unexpected stacking context. Mounted on:
//   - CelebrationOverlay (final "Quiz Complete!" modal)
//   - Session Report page (continues until host clicks Back to Library)
//
// Runs on a loop (new batch every `intervalMs`) until the parent unmounts it
// or sets active=false. Respects prefers-reduced-motion.
//
// Particle shapes mix rectangles (3:1), thin ribbons (8:1), and circles —
// matching the canvas-confetti look so the fallback feels visually consistent.
// Two animation paths: side-cannon (pop up → arc → gravity fall) and rain
// (slow drift from above) — split 70/30 so the dominant feel is the cannon.

const COLORS = [
  '#F5E642', '#FF8A47', '#16A34A', '#2D3A8C', '#FFFFFF',
  '#DC2626', '#7C3AED', '#0EA5E9', '#FBBF24', '#EC4899',
]

type Shape = 'rect' | 'ribbon' | 'circle'
type Path = 'cannonL' | 'cannonR' | 'rain'

interface Particle {
  id: number
  delay: number
  duration: number
  size: number          // base size (height for rect/ribbon, diameter for circle)
  width: number         // px, computed from size + shape ratio
  color: string
  driftX: number
  rotate: number
  shape: Shape
  path: Path
  startX: number        // 0–100 vw (for rain) or anchor x in vw
}

// Cheap deterministic PRNG so React keys + visuals stay stable across renders.
function rand(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280
}

function makeBatch(seedOffset: number, count: number): Particle[] {
  const batch: Particle[] = []
  for (let i = 0; i < count; i++) {
    const id = seedOffset + i
    const r1 = rand(id)
    const r2 = rand(id * 13 + 7)
    const r3 = rand(id * 31 + 11)
    const r4 = rand(id * 71 + 23)

    // 65% circle (reads as "petals"/"bubbles", not boxes), 25% ribbon, 10% rect.
    // Prior 60% rect mix is what made the celebration look "mechanical".
    const shape: Shape = r2 < 0.65 ? 'circle' : r2 < 0.9 ? 'ribbon' : 'rect'
    // Keep particles small per user feedback — tighter range 6–10px
    // (was 5–12) gives more visual consistency. Big confetti reads cluttered.
    const size = 6 + Math.floor(r4 * 5)         // 6–10 px
    const width = shape === 'circle' ? size : shape === 'ribbon' ? size * 7 : size * 3

    // 30% left cannon, 30% right cannon, 40% drift rain. Heavier rain weighting
    // means more slow-drift particles, fewer abrupt cannon arcs.
    const path: Path = r1 < 0.3 ? 'cannonL' : r1 < 0.6 ? 'cannonR' : 'rain'
    const startX = path === 'rain'
      ? r3 * 100
      : path === 'cannonL' ? 2 + r3 * 6 : 92 + r3 * 6

    batch.push({
      id,
      delay: r2 * 1.4,
      // Slower fall = smoother visual feel. Cannons 4.0–6.0s (was 2.4–3.4s),
      // rain 7.0–10.0s (was 4.0–5.6s). User explicitly wanted "smooth, slow".
      duration: path === 'rain' ? 7.0 + r3 * 3.0 : 4.0 + r3 * 2.0,
      size,
      width,
      color: COLORS[id % COLORS.length],
      // Wider sway (±55px was ±30) makes the fall organic, not gravity-sim.
      driftX: (r3 - 0.5) * 110,
      rotate: (r4 > 0.5 ? 1 : -1) * (360 + Math.floor(r1 * 720)),
      shape,
      path,
      startX,
    })
  }
  return batch
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    const onChange = () => setReduced(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return reduced
}

interface CelebrationConfettiProps {
  active: boolean
  batchSize?: number
  intervalMs?: number
}

// Quieter density (32 per batch, was 48) + longer interval (3600ms, was 2400ms)
// — combined with the slower fall durations above, total particles on screen
// stay around 60–70 instead of 100+, so the celebration reads as graceful
// rather than chaotic.
export function CelebrationConfetti({ active, batchSize = 32, intervalMs = 3600 }: CelebrationConfettiProps) {
  const reduced = usePrefersReducedMotion()
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (!active || reduced) return
    const id = setInterval(() => setSeed(s => s + 1), intervalMs)
    return () => clearInterval(id)
  }, [active, reduced, intervalMs])

  if (!active || reduced) return null

  // Two overlapping batches so a continuous stream is visible.
  const batchA = makeBatch(seed * batchSize, batchSize)
  const batchB = makeBatch((seed - 1) * batchSize, batchSize)

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      {[...batchA, ...batchB].map(p => {
        const animationName = p.path === 'rain' ? 'celebRain' : p.path === 'cannonL' ? 'celebCannonL' : 'celebCannonR'
        const top = p.path === 'rain' ? '-8%' : 'auto'
        const bottom = p.path === 'rain' ? 'auto' : '6%'
        return (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top,
              bottom,
              left: `${p.startX}vw`,
              width: p.width,
              height: p.size,
              background: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              opacity: 0,
              animation: `${animationName} ${p.duration}s cubic-bezier(0.18, 0.7, 0.32, 1) ${p.delay}s both`,
              // @ts-expect-error — CSS custom properties are strings
              '--drift-x': `${p.driftX}px`,
              '--rotate': `${p.rotate}deg`,
            }}
          />
        )
      })}
      <style>{`
        /* Side cannons fire upward, peak around 65% of screen height, then
           gravity pulls them down past the bottom. Two-phase keyframe — pop
           up first, then fall — is what makes the motion read as "real". */
        @keyframes celebCannonL {
          0%   { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg); }
          8%   { opacity: 1; }
          35%  { transform: translate3d(calc(20vw + var(--drift-x)), -65vh, 0) rotate(calc(var(--rotate) * 0.4)); }
          90%  { opacity: 1; }
          100% { opacity: 0; transform: translate3d(calc(28vw + var(--drift-x)), 12vh, 0) rotate(var(--rotate)); }
        }
        @keyframes celebCannonR {
          0%   { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg); }
          8%   { opacity: 1; }
          35%  { transform: translate3d(calc(-20vw + var(--drift-x)), -65vh, 0) rotate(calc(var(--rotate) * 0.4)); }
          90%  { opacity: 1; }
          100% { opacity: 0; transform: translate3d(calc(-28vw + var(--drift-x)), 12vh, 0) rotate(var(--rotate)); }
        }
        /* Rain — slow drift from above with sine-wobble horizontal sway so
           particles meander instead of falling straight. The mid-keyframe
           at 50% flips the drift sign, producing a gentle S-curve path. */
        @keyframes celebRain {
          0%   { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg); }
          8%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--drift-x) * -0.7), 55vh, 0) rotate(calc(var(--rotate) * 0.55)); }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--drift-x), 118vh, 0) rotate(var(--rotate)); }
        }
      `}</style>
    </div>
  )
}
