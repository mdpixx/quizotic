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
interface FitTextOptions {
  min: number
  max: number
  deps: readonly unknown[]
  /**
   * Write the size to this CSS custom property on `target` instead of an
   * inline font-size — for fitting a GROUP (e.g. every option tile in the
   * answer grid shares one size via `font-size: var(--opt-fit-size, …)`).
   */
  cssVar?: string
  /**
   * Custom fit predicate evaluated after each candidate size is applied.
   * Needed when scroll metrics can't see the overflow: a centered flex item
   * taller than its min-h-0 parent paints ABOVE the box, and upward overflow
   * is invisible to scrollHeight (scroll metrics only extend down/right) —
   * geometric rect containment is the honest check there. The box's own
   * scroll overflow is always checked in addition.
   */
  fits?: () => boolean
}

// (Callers pick min: keep >= 12px — below that a projected wall becomes
// unreadable from the back of a classroom.)
export function useFitText(
  box: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  { min, max, deps, cssVar, fits }: FitTextOptions
): void {
  useLayoutEffect(() => {
    const boxEl = box.current
    const targetEl = target.current
    if (!boxEl || !targetEl) return

    const apply = (px: number) => {
      if (cssVar) targetEl.style.setProperty(cssVar, `${px}px`)
      else targetEl.style.fontSize = `${px}px`
    }

    const clears = (el: HTMLElement): boolean =>
      el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1

    const fitsAt = (px: number): boolean => {
      apply(px)
      return clears(boxEl) && (fits ? fits() : true)
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
      apply(best)
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

    // Re-fit when the box's real bounds move: the box itself (its flex/grid
    // share can change when SIBLINGS resize — e.g. the question card refits
    // after its image loads and the answer grid inherits the leftover) and
    // its parent (viewport/layout shifts). The size guard makes this
    // loop-safe against our own font writes: a converged fit re-applies the
    // same size, so observed dimensions stop changing and the observer goes
    // quiet.
    const parent = boxEl.parentElement
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      const last = new Map<HTMLElement, { w: number; h: number }>()
      const watched = parent ? [boxEl, parent] : [boxEl]
      for (const el of watched) last.set(el, { w: el.clientWidth, h: el.clientHeight })
      ro = new ResizeObserver(() => {
        let changed = false
        for (const el of watched) {
          const prev = last.get(el)!
          if (el.clientWidth !== prev.w || el.clientHeight !== prev.h) {
            last.set(el, { w: el.clientWidth, h: el.clientHeight })
            changed = true
          }
        }
        if (changed) fit()
      })
      for (const el of watched) ro.observe(el)
    }

    return () => {
      cancelled = true
      for (const img of images) img.removeEventListener('load', onImgLoad)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
