'use client'

import { useEffect, useRef, useState } from 'react'
import { Podium } from './Podium'
import { CelebrationConfetti } from './CelebrationConfetti'

interface CelebrationOverlayProps {
  leaderboard: Array<{ name: string; archetype?: string; score: number }>
  sessionMode: string
  onDismiss: () => void
  title?: string
  // When set, the overlay starts fading out at this many ms after mount,
  // then calls onDismiss after the 600ms fade completes. Used by the host
  // page so the projected screen automatically hands off to the underlying
  // Podium without a click. Without this prop the overlay stays until the
  // host manually clicks "View Report →".
  autoDismissMs?: number
}

// Full-screen celebration shown to the host when a session ends. Wraps
// <Podium> which owns the staggered reveal, sounds, and confetti burst. The
// dismiss button appears only after the reveal completes (~6.5s) so it
// doesn't short-circuit the moment.
const FADE_OUT_MS = 600

export function CelebrationOverlay({
  leaderboard,
  sessionMode,
  onDismiss,
  title = 'Quiz complete!',
  autoDismissMs,
}: CelebrationOverlayProps) {
  const [canDismiss, setCanDismiss] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const t = setTimeout(() => setCanDismiss(true), 6500)
    return () => clearTimeout(t)
  }, [])

  // Smooth fade-out before unmount. beginFade flips opacity to 0; after the
  // 600ms CSS transition completes we call the parent's onDismiss, which
  // unmounts us. Without this two-step the previous behavior was a hard cut
  // from overlay → podium, visible as a "flash" on the projected screen.
  const beginFade = () => {
    if (dismissing) return
    setDismissing(true)
    setTimeout(() => onDismissRef.current(), FADE_OUT_MS)
  }

  // Auto-dismiss after the configured delay so the host's projected screen
  // hands off to the Podium underneath without needing a click.
  useEffect(() => {
    if (typeof autoDismissMs !== 'number') return
    const t = setTimeout(beginFade, autoDismissMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs])

  // Close on Escape for keyboard users (only after reveal completes).
  useEffect(() => {
    if (!canDismiss) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beginFade()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDismiss])

  return (
    <div
      role="dialog"
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: 'radial-gradient(circle at 50% 40%, #1E2B6B 0%, #0F1B3D 70%)',
        opacity: dismissing ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        pointerEvents: dismissing ? 'none' : undefined,
      }}
    >
      {/* DOM-based falling-particle layer — paints at z-index 60 above this
          modal so it's guaranteed visible even if canvas-confetti fails. */}
      <CelebrationConfetti active />
      {/* Drifting stars backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ opacity: 0.35 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              background: '#fff',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animation: `starTwinkle ${2 + (i % 5) * 0.6}s ease-in-out ${(i % 7) * 0.3}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-2xl" style={{ zIndex: 1 }}>
        <h1
          className="text-center font-black mb-6"
          style={{
            color: '#FBD13B',
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            textShadow: '0 2px 10px rgba(251,209,59,0.28)',
            animation: 'titleDrop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          {title}
        </h1>

        <div className="bg-white rounded-3xl shadow-2xl p-8" style={{ animation: 'cardLift 0.8s ease-out 0.2s both', overflow: 'hidden' }}>
          <Podium leaderboard={leaderboard} sessionMode={sessionMode} loopConfetti />
        </div>

        <div className="flex justify-center mt-6" style={{ minHeight: 52 }}>
          {canDismiss && (
            <button
              type="button"
              onClick={beginFade}
              className="px-6 py-3 rounded-xl font-bold text-sm transition-transform hover:scale-105 active:scale-95"
              style={{
                background: '#FBD13B',
                color: '#0F1B3D',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                animation: 'cardLift 0.4s ease-out both',
              }}
              aria-label="Dismiss celebration and view the session report"
            >
              View Report →
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes titleDrop {
          0% { opacity: 0; transform: translateY(-24px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardLift {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
