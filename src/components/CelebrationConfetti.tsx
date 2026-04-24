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

const COLORS = ['#F5E642', '#FF8A47', '#16A34A', '#2D3A8C', '#FFFFFF', '#DC2626', '#7C3AED', '#0EA5E9']

interface Particle {
  id: number
  left: number       // 0-100 vw
  delay: number      // s
  duration: number   // s
  size: number       // px
  color: string
  driftX: number     // px, lateral drift at end
  rotate: number     // deg, total rotation
  shape: 'square' | 'circle'
}

function makeBatch(seedOffset: number, count: number): Particle[] {
  const batch: Particle[] = []
  for (let i = 0; i < count; i++) {
    const id = seedOffset + i
    // Deterministic pseudo-random per id so React keys stay stable.
    const r1 = ((id * 9301 + 49297) % 233280) / 233280
    const r2 = ((id * 48271 + 12345) % 233280) / 233280
    const r3 = ((id * 1103515245 + 12345) % 2147483648) / 2147483648
    const r4 = ((id * 214013 + 2531011) % 2147483648) / 2147483648
    batch.push({
      id,
      left: r1 * 100,
      delay: r2 * 2.2,
      duration: 3.2 + r3 * 2.4,
      size: 6 + Math.floor(r4 * 9),
      color: COLORS[id % COLORS.length],
      driftX: (r3 - 0.5) * 140,
      rotate: (r4 > 0.5 ? 1 : -1) * (360 + Math.floor(r1 * 540)),
      shape: r2 > 0.5 ? 'circle' : 'square',
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

export function CelebrationConfetti({ active, batchSize = 42, intervalMs = 2400 }: CelebrationConfettiProps) {
  const reduced = usePrefersReducedMotion()
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (!active || reduced) return
    const id = setInterval(() => setSeed(s => s + 1), intervalMs)
    return () => clearInterval(id)
  }, [active, reduced, intervalMs])

  if (!active || reduced) return null

  // Two overlapping batches so a continuous stream is visible — one from the
  // last cycle still finishing, one newly launched.
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
      {[...batchA, ...batchB].map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: '-8%',
            left: `${p.left}vw`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : 2,
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            opacity: 0,
            animation: `celebFall ${p.duration}s cubic-bezier(0.2, 0.6, 0.35, 1) ${p.delay}s both`,
            // @ts-expect-error — CSS custom properties are strings
            '--drift-x': `${p.driftX}px`,
            '--rotate': `${p.rotate}deg`,
          }}
        />
      ))}
      <style>{`
        @keyframes celebFall {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          8% { opacity: 1; }
          85% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift-x), 118vh, 0) rotate(var(--rotate));
          }
        }
      `}</style>
    </div>
  )
}
