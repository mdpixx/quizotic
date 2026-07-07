'use client'

import { useLayoutEffect, type RefObject } from 'react'

/**
 * Closed-loop text fitting for bounded boxes (e.g. the host stage question
 * card, which is capped at a % of the stage and overflow-hidden).
 *
 * Binary-searches a pixel font size on `target` until `box` no longer
 * overflows its own bounds — measuring the real rendered box instead of
 * guessing from character counts. Length-bucket heuristics tuned on laptop
 * screens under-shrink on projectors (1024×768, 125% display scaling) and the
 * box's overflow:hidden then clips the question; measuring can't miss.
 *
 * The search runs in useLayoutEffect (pre-paint, no visible thrash) and
 * re-runs when `deps` change or the box's parent resizes. The CSS class
 * font-size remains the pre-hydration fallback; the fitted value is written
 * as an inline style, which wins over any bucket class.
 */
export function useFitText(
  box: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  { min, max, deps }: { min: number; max: number; deps: readonly unknown[] }
): void {
  useLayoutEffect(() => {
    const boxEl = box.current
    const targetEl = target.current
    if (!boxEl || !targetEl) return

    const fitsAt = (px: number): boolean => {
      targetEl.style.fontSize = `${px}px`
      return (
        boxEl.scrollHeight <= boxEl.clientHeight + 1 &&
        boxEl.scrollWidth <= boxEl.clientWidth + 1
      )
    }

    const fit = () => {
      let lo = min
      let hi = max
      let best = min
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (fitsAt(mid)) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      // Apply the best size even when nothing "fits": min is the legibility
      // floor and the box's own overflow rule is the last-resort guard.
      targetEl.style.fontSize = `${best}px`
    }

    fit()

    let cancelled = false

    // Late layout shifts move the goalposts after the first pass: web fonts
    // swapping in change text metrics, and images inside the box report zero
    // height until they load. Re-fit when either lands.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!cancelled) fit() })
    }
    const images = Array.from(boxEl.querySelectorAll('img'))
    const onImgLoad = () => { if (!cancelled) fit() }
    for (const img of images) {
      if (!img.complete) img.addEventListener('load', onImgLoad)
    }

    // The box is content-sized up to its cap, so observing it would loop on
    // our own writes. Its parent provides the bound (the % cap resolves
    // against it) and only changes on real layout shifts — observe that.
    const parent = boxEl.parentElement
    let ro: ResizeObserver | null = null
    if (parent && typeof ResizeObserver !== 'undefined') {
      let lastW = parent.clientWidth
      let lastH = parent.clientHeight
      ro = new ResizeObserver(() => {
        if (parent.clientWidth === lastW && parent.clientHeight === lastH) return
        lastW = parent.clientWidth
        lastH = parent.clientHeight
        fit()
      })
      ro.observe(parent)
    }

    return () => {
      cancelled = true
      for (const img of images) img.removeEventListener('load', onImgLoad)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
