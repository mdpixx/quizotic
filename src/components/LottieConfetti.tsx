'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'

// Self-hosted Lottie confetti for the end-of-session finale. The animation
// JSON lives at public/lottie/confetti.json (sourced from LottieFiles but
// fully self-contained — pure vector precomps, no external asset URLs) so it
// never touches a third-party CDN at runtime.
//
// Both the player (lottie-web via lottie-react) and the ~95KB JSON are loaded
// lazily — the player through next/dynamic, the JSON through a runtime fetch —
// so nothing here lands in any bundle until the celebration actually mounts.

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

interface LottieConfettiProps {
  // Full-viewport `fixed` overlay (default, for the finale modal) or a `absolute`
  // layer scoped to the nearest positioned ancestor.
  layer?: 'fixed' | 'absolute'
  // Asset path under /public. Override only if a different animation is wanted.
  src?: string
}

export function LottieConfetti({ layer = 'fixed', src = '/lottie/confetti.json' }: LottieConfettiProps) {
  const reduced = usePrefersReducedMotion()
  // The raw Lottie JSON, fetched at runtime so it stays out of the JS bundle.
  const [data, setData] = useState<object | null>(null)

  // Always fetch the animation data, even under prefers-reduced-motion. The
  // render branch below plays it once (no loop) in that case, so reduce-motion
  // users still get the celebration moment instead of a blank finale.
  useEffect(() => {
    let cancelled = false
    fetch(src)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(json => { if (!cancelled) setData(json) })
      .catch(() => { /* asset unavailable — celebration silently degrades to the other layers */ })
    return () => { cancelled = true }
  }, [src])

  if (!data) return null

  return (
    <div
      aria-hidden
      style={{
        position: layer,
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        // Sits with the floating-gold particle layer (z-60) so it paints above
        // the celebration modal but never intercepts clicks.
        zIndex: 60,
      }}
    >
      <Lottie
        animationData={data}
        // Loop the celebration normally; under prefers-reduced-motion play a
        // single pass (no perpetual motion) rather than blanking the finale.
        loop={!reduced}
        autoplay
        // Cover the whole viewport, cropping overflow, so confetti reaches the
        // edges regardless of aspect ratio (the source is 16:9, 1920×1080).
        rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
