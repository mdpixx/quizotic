'use client'

// Animates a number toward its target instead of snapping to it.
//
// On the live stage every vote rewrites a count. Snapping makes the number the
// loudest thing on screen — it flickers while the bar beside it glides.
// Counting up ties the two together.
//
// Two properties matter more than the easing:
//
//   1. Interruption. Votes arrive faster than the 320ms count, so a new target
//      routinely lands mid-animation. The in-flight frame is cancelled and the
//      next one continues from the value currently on screen — it does not
//      restart from zero, and it does not first jump to the abandoned target.
//   2. Landing exactly. The final value is written from the `p >= 1` branch
//      rather than by accumulating eased steps, so the count always ends on
//      the number the percentage beside it was computed from.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { DUR } from '@/lib/motion'

/** Expo-out — matches EASE.out so counts and bars settle together. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(target: number, duration: number = DUR.base): number {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(target)
  const frameRef = useRef<number | null>(null)
  // The value currently on screen. Held in a ref so a new target continues
  // from it rather than restarting the climb.
  const displayRef = useRef(target)

  const animating = !reduce && duration > 0

  useEffect(() => {
    if (!animating) {
      // Keep the ref truthful so that if motion is re-enabled mid-session the
      // next count starts from what the viewer is actually looking at.
      displayRef.current = target
      return
    }

    const from = displayRef.current
    if (from === target) return

    const start = performance.now()

    // Every setDisplay below runs inside a rAF callback, never synchronously
    // in the effect body — the latter would cascade renders.
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed >= duration) {
        frameRef.current = null
        displayRef.current = target
        setDisplay(target)
        return
      }
      const value = Math.round(from + (target - from) * easeOut(elapsed / duration))
      displayRef.current = value
      setDisplay(value)
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      // Deliberately does NOT write `target` here. Cleanup runs on every new
      // target, and snapping to the abandoned one would make a fast sequence
      // of votes jump forward and back instead of climbing smoothly.
    }
  }, [target, duration, animating])

  // Under reduced motion the target IS the rendered value — no state, no
  // effect-driven render, nothing to fall out of sync.
  return animating ? display : target
}
