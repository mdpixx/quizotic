'use client'

// Class awards — the projector-side ceremony the host runs after the podium.
//
// PLACEMENT, and why it is an on-demand overlay rather than a screen in the
// flow: this is the same question ImmersiveStatsOverlay already answered for
// the stats screen, and the answer is the same. It is NOT forced. The podium is
// the climax of the session and must not be cut away from or diluted; the host
// opens this when the room is ready and dismisses it back to the podium.
//
// REVEAL ONE AT A TIME. A grid of six awards reads as a results table and the
// room's attention has nowhere to land. Advancing one name at a time makes it a
// ceremony — the host can react, and people can clap between names. That is the
// whole reason this exists rather than a list in the post-session report.
//
// Award allocation guarantees distinct winners (src/lib/awards.mjs), so this
// never reads out the same person six times.

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/Avatar'

export interface ClassAward {
  key: string
  icon: string
  label: string
  winner: string
  archetype?: string | null
  detail: string
}

interface ClassAwardsOverlayProps {
  open: boolean
  onClose: () => void
  awards: ClassAward[]
  /** Skips entry/exit animation when the host prefers reduced motion. */
  reduceMotion?: boolean
}

export function ClassAwardsOverlay({ open, onClose, awards, reduceMotion = false }: ClassAwardsOverlayProps) {
  // How many awards have been revealed so far. 0 = title card.
  const [revealed, setRevealed] = useState(0)

  const total = awards.length
  const done = revealed >= total

  const advance = useCallback(() => {
    setRevealed(r => Math.min(r + 1, total))
  }, [total])

  // Reset to the title card each time the overlay opens, so a second showing
  // starts the ceremony from the top rather than on the last name.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setRevealed(0)
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      // Space / Enter / ArrowRight advance the ceremony. Preventing default on
      // Space matters: without it the projector page scrolls behind the overlay.
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, advance])

  if (!open) return null

  const shown = awards.slice(0, revealed)
  const current = revealed > 0 ? awards[revealed - 1] : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Class awards"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{
        background: 'radial-gradient(circle at 50% 30%, rgba(45,42,102,0.96), rgba(7,17,38,0.98))',
        backdropFilter: 'blur(6px)',
      }}
      onClick={done ? onClose : advance}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label="Close awards"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
        style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <p className="shrink-0 text-xs md:text-sm font-black uppercase tracking-[0.28em] mb-2" style={{ color: 'rgba(251,209,59,0.8)' }}>
        Class Awards
      </p>

      {/* Centre stage — the name currently being announced. */}
      <div className="flex-1 min-h-0 w-full max-w-3xl flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.key}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.86, y: 16 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-center"
            >
              <div className="text-6xl md:text-8xl leading-none mb-3" aria-hidden>{current.icon}</div>
              <p className="font-display text-2xl md:text-4xl font-black" style={{ color: '#FBD13B' }}>
                {current.label}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                {current.archetype && <Avatar archetype={current.archetype} size={56} />}
                <p className="font-display text-3xl md:text-5xl font-black" style={{ color: '#FFFFFF' }}>
                  {current.winner}
                </p>
              </div>
              <p className="mt-2 text-base md:text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {current.detail}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="__title"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="text-7xl md:text-8xl leading-none mb-4" aria-hidden>🏅</div>
              <p className="font-display text-3xl md:text-5xl font-black" style={{ color: '#FFFFFF' }}>
                And the awards go to…
              </p>
              <p className="mt-3 text-base md:text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {total} {total === 1 ? 'award' : 'awards'} · tap or press Space to reveal
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Already-announced winners stay on screen as a growing row, so the room
          can still see who was named earlier in the ceremony. */}
      <div className="shrink-0 w-full max-w-4xl flex flex-wrap items-center justify-center gap-2 min-h-[44px]">
        {shown.slice(0, -1).map(a => (
          <span
            key={a.key}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs md:text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <span aria-hidden>{a.icon}</span>
            {a.winner}
          </span>
        ))}
      </div>

      <p className="shrink-0 mt-5 text-xs md:text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {done ? 'Esc or click to close' : `Space to reveal · ${revealed} of ${total}`}
      </p>
    </div>
  )
}
