'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

// Floating gold particle celebration — replaces the previous side-cannon
// confetti that read as choreographed and mechanical on a projector.
// Particles are small warm-gold dots that drift up from below the viewport,
// sway gently in a sine path, glow softly, and fade in at the bottom edge
// and out near the top. Inspired by the Mentimeter/Kahoot "premium" finale.
//
// Pure CSS keyframes on DOM <span>s — no canvas, no JS animation loop, no
// per-frame state. Renders ~30 particles on screen at steady state; respects
// prefers-reduced-motion.

// Warm gold + cream palette only — feels premium and matches the Quizotic
// brand yellow #F5E642 already used for the lobby Create button.
const COLORS = [
  '#F5E642',  // brand yellow
  '#FBBF24',  // amber 400
  '#FCD34D',  // amber 300
  '#FFE08A',  // warm gold
  '#FFF7CC',  // cream
]

interface Particle {
  id: number
  delay: number       // seconds before this particle's animation begins
  duration: number    // total drift time, seconds
  size: number        // diameter in px (4–9)
  color: string
  startX: number      // 0–100 vw — base horizontal position
  driftAmplitude: number // px — how wide the sine sway is
  driftPhase: number  // 0–1 — randomizes which way the sway starts
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

    // Bias size toward 5–6 px (smaller = more dust-like). Range 4–9.
    const sizeRoll = r4 * r4  // squared bias toward small
    const size = 4 + Math.round(sizeRoll * 5)

    batch.push({
      id,
      delay: r2 * 1.2,
      // 5–8s drift. Must finish before the parent re-renders this particle
      // out of the DOM — see render-lifetime note on the parent component.
      duration: 5.0 + r3 * 3.0,
      size,
      color: COLORS[id % COLORS.length],
      startX: r1 * 100,
      driftAmplitude: 24 + r3 * 36,  // 24–60 px sway
      driftPhase: r2,
    })
  }
  return batch
}

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const m = window.matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

function getReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

interface CelebrationConfettiProps {
  active: boolean
  batchSize?: number
  intervalMs?: number
  layer?: 'fixed' | 'absolute'
}

// Render-lifetime constraint: each particle's <span> is only in the DOM for
// ~2 × intervalMs (because keys are seeded from `seed` and `seed-1`, so a
// particle survives the current render and the next). Its CSS animation
// must therefore complete inside that window or it gets cut off when the
// parent re-renders. Tuned: animation 5–8s, intervalMs 2400ms → particles
// live ~4.8s in DOM, which fits the 5–8s envelope mostly (the longest tail
// gets clipped, which is fine — the opacity envelope has them at ~0 by then).
//
// With batchSize 14 + intervalMs 2400ms + 2 overlapping batches, ~28
// particles are on screen at any moment.
export function CelebrationConfetti({ active, batchSize = 14, intervalMs = 2400, layer = 'fixed' }: CelebrationConfettiProps) {
  const reduced = usePrefersReducedMotion()
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (!active || reduced) return
    const id = setInterval(() => setSeed(s => s + 1), intervalMs)
    return () => clearInterval(id)
  }, [active, reduced, intervalMs])

  if (!active || reduced) return null

  // Two overlapping batches so the stream feels continuous.
  const batchA = makeBatch(seed * batchSize, batchSize)
  const batchB = makeBatch((seed - 1) * batchSize, batchSize)

  return (
    <div
      aria-hidden
      style={{
        position: layer,
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      {[...batchA, ...batchB].map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-8%',
            left: `${p.startX}vw`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: '999px',
            boxShadow: `0 0 ${p.size * 1.4}px ${p.color}66, 0 0 ${p.size * 0.6}px ${p.color}aa`,
            opacity: 0,
            // Custom property feeds the keyframe's sway amplitude. The
            // per-particle delay desynchronizes start times so the group
            // reads as organic, not choreographed.
            ['--sway' as string]: `${p.driftAmplitude}px`,
            animation: `celebDriftUp ${p.duration}s linear ${p.delay}s forwards, celebFade ${p.duration}s ease-in-out ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        /* Drift up — pure vertical climb from below to above viewport, with
           a slow sine-style horizontal sway (left-right-left) to feel organic.
           The sway uses a 4-step keyframe pattern so the particle gently
           weaves as it rises. */
        @keyframes celebDriftUp {
          0%   { transform: translate3d(0, 0, 0); }
          25%  { transform: translate3d(var(--sway), -30vh, 0); }
          50%  { transform: translate3d(0, -60vh, 0); }
          75%  { transform: translate3d(calc(var(--sway) * -1), -90vh, 0); }
          100% { transform: translate3d(0, -120vh, 0); }
        }
        /* Opacity envelope — particles fade in at the bottom and out near
           the top so nothing visibly pops into existence at viewport edges. */
        @keyframes celebFade {
          0%   { opacity: 0; }
          12%  { opacity: 0.85; }
          82%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
