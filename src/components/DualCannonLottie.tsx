'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'

// Dual side-cannon confetti for the end-of-session finale. The asset
// (public/lottie/confetti-cannons.json) is a single confetti burst; we mount it
// TWICE — once clipped to the left half, once mirrored (scaleX(-1)) and clipped
// to the right half — so the two bursts fire from the screen edges toward the
// center, framing the podium without burying it. Each cannon is scaled to 0.7
// and the wrapper is capped to the bottom ~80% of the viewport, so the confetti
// stays around the podium rather than climbing the whole screen.
//
// Asset: confetti.json from github.com/fedemartinm/react-award (MIT, © 2023
// Fede Martin). Self-contained pure-vector precomps, no external asset URLs, so
// it never touches a third-party CDN at runtime. Both the player (lottie-web via
// lottie-react) and the ~152KB JSON load lazily — the player through
// next/dynamic, the JSON through a runtime fetch — so nothing here lands in any
// bundle until the celebration actually mounts.

// lottie-react pulls in lottie-web; keep it out of the SSR/initial bundle.
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

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

const ASSET_SRC = '/lottie/confetti-cannons.json'

function Cannon({ side, data, loop }: { side: 'left' | 'right'; data: object; loop: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: side === 'left' ? 0 : '50%',
        right: side === 'left' ? '50%' : 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <Lottie
        animationData={data}
        loop={loop}
        autoplay
        // The source burst originates at the bottom-inner edge of its frame
        // (the cannon mouth), so cropping each copy to its own half keeps the
        // burst on-screen while mirroring the right copy makes it fire inward.
        // 'xMinYMid slice' keeps the bottom-anchored origin at the inner edge.
        rendererSettings={{ preserveAspectRatio: side === 'left' ? 'xMinYMin slice' : 'xMaxYMin slice' }}
        style={{
          width: '100%',
          height: '100%',
          // Mirror the right cannon so both fire inward. Combined scale(0.7)
          // shrinks each burst to frame the podium instead of burying it.
          transform: side === 'right' ? 'scaleX(-1) scale(0.7)' : 'scale(0.7)',
          transformOrigin: side === 'left' ? 'bottom right' : 'bottom left',
        }}
      />
    </div>
  )
}

export function DualCannonLottie() {
  const reduced = usePrefersReducedMotion()
  // The raw Lottie JSON, fetched at runtime so it stays out of the JS bundle.
  const [data, setData] = useState<object | null>(null)

  // Always fetch the animation data, even under prefers-reduced-motion. The
  // render branch below plays it once (no loop) in that case, so reduce-motion
  // users still get the celebration moment instead of a blank finale.
  useEffect(() => {
    let cancelled = false
    fetch(ASSET_SRC)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(json => { if (!cancelled) setData(json) })
      .catch(() => { /* asset unavailable — celebration silently degrades to the other layers */ })
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        // Anchor the cannon layer to the bottom ~80% of the viewport so the
        // confetti hugs the podium area instead of climbing to the ceiling and
        // burying the "Session Complete" heading. Left/right stay full-width.
        left: 0,
        right: 0,
        bottom: 0,
        top: '20%',
        overflow: 'hidden',
        pointerEvents: 'none',
        // Sits with the floating-gold particle layer (z-60) so it paints above
        // the celebration modal but never intercepts clicks.
        zIndex: 60,
      }}
    >
      <Cannon side="left" data={data} loop={!reduced} />
      <Cannon side="right" data={data} loop={!reduced} />
    </div>
  )
}
