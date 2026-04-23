'use client'

import { useEffect, useRef, useState } from 'react'

// Shrinks a text element's font-size down until it fits inside its parent's
// box without overflow. Used for slide titles/questions so long content doesn't
// get visually clipped in either the builder preview or the live host view.
//
// Usage:
//   const ref = useAutoShrinkText<HTMLHeadingElement>({ minPx: 16, maxPx: 48 })
//   <h2 ref={ref} ...>{longQuestionText}</h2>
//
// The hook measures the element's scrollHeight/scrollWidth against its parent's
// clientHeight/clientWidth and iteratively reduces fontSize. It reruns on
// window resize and when the text content changes (via a MutationObserver).

interface AutoShrinkOptions {
  minPx?: number
  maxPx?: number
}

export function useAutoShrinkText<T extends HTMLElement>({
  minPx = 14,
  maxPx = 48,
}: AutoShrinkOptions = {}) {
  const ref = useRef<T | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    let raf = 0
    function fit() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!el || !parent) return
        // Reset to max, then step down until it fits or we hit min.
        el.style.fontSize = `${maxPx}px`
        const fits = () =>
          el.scrollHeight <= parent.clientHeight && el.scrollWidth <= parent.clientWidth
        let size = maxPx
        while (!fits() && size > minPx) {
          size -= 1
          el.style.fontSize = `${size}px`
        }
      })
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    ro.observe(el)
    const mo = new MutationObserver(fit)
    mo.observe(el, { childList: true, characterData: true, subtree: true })
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', fit)
    }
    // force is intentionally unused; keeps the hook hot-reload friendly
  }, [minPx, maxPx, force])

  return ref
}
