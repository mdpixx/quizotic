'use client'

// Shared scroll-reveal motion system for the marketing landing page.
//
// Progressive enhancement by construction: the server HTML renders everything
// fully visible (SEO crawlers and no-JS / slow-connection visitors always see
// the whole page — a hard requirement for 1–2 Mbps classroom networks). Only
// after hydration does JS arm the hidden state and animate elements in, via
// IntersectionObserver + CSS transitions. No animation library needed.
//
// Reduced motion: elements are simply never armed, so they stay static.
//
// Usage: <Reveal> for single blocks, <Stagger>/<StaggerItem> for lists that
// cascade in. StaggerItem may be nested at any depth inside its Stagger.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURATION = 0.65

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Phase = 'static' | 'hidden' | 'shown'

function revealStyle(phase: Phase, y: number, delay: number, base?: CSSProperties): CSSProperties {
  if (phase === 'hidden') {
    return { ...base, opacity: 0, transform: `translateY(${y}px)` }
  }
  if (phase === 'shown') {
    return {
      ...base,
      opacity: 1,
      transform: 'translateY(0)',
      transition: `opacity ${DURATION}s ${EASE} ${delay}s, transform ${DURATION}s ${EASE} ${delay}s`,
    }
  }
  return base ?? {}
}

interface RevealProps {
  children: ReactNode
  /** Seconds to hold before starting (use sparingly — lists prefer <Stagger>). */
  delay?: number
  /** Initial vertical offset in px. */
  y?: number
  /** 'view' animates when scrolled into view (default); 'mount' animates on load. */
  on?: 'view' | 'mount'
  style?: CSSProperties
  className?: string
}

export function Reveal({ children, delay = 0, y = 28, on = 'view', style, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('static')

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    // If hydration arrived long after first paint (slow connection), the
    // visitor is already reading — don't yank visible content into a replay.
    if (on === 'mount' && performance.now() > 2500) return

    let obs: IntersectionObserver | null = null
    // rAF so the hide + animate never blocks the first client paint.
    const raf = requestAnimationFrame(() => {
      setPhase('hidden')
      if (on === 'mount') {
        requestAnimationFrame(() => setPhase('shown'))
        return
      }
      obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setPhase('shown')
          obs?.disconnect()
        }
      }, { rootMargin: '0px 0px -70px 0px', threshold: 0.01 })
      obs.observe(el)
    })
    return () => {
      cancelAnimationFrame(raf)
      obs?.disconnect()
    }
  }, [on])

  return (
    <div ref={ref} className={className} style={revealStyle(phase, y, delay, style)}>
      {children}
    </div>
  )
}

// ── Stagger ────────────────────────────────────────────────────────────────
// Parent owns one observer; each item declares its `index` explicitly to
// compute its transition delay. Context lets items sit at any depth below
// the Stagger, not just as direct children.

interface StaggerCtx {
  phase: Phase
  gap: number
}

const StaggerContext = createContext<StaggerCtx | null>(null)

interface StaggerProps {
  children: ReactNode
  /** Seconds between each item starting. */
  gap?: number
  style?: CSSProperties
  className?: string
}

export function Stagger({ children, gap = 0.09, style, className }: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('static')

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let obs: IntersectionObserver | null = null
    const raf = requestAnimationFrame(() => {
      setPhase('hidden')
      obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          setPhase('shown')
          obs?.disconnect()
        }
      }, { rootMargin: '0px 0px -70px 0px', threshold: 0.01 })
      obs.observe(el)
    })
    return () => {
      cancelAnimationFrame(raf)
      obs?.disconnect()
    }
  }, [])

  return (
    <StaggerContext.Provider value={{ phase, gap }}>
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    </StaggerContext.Provider>
  )
}

export function StaggerItem({ children, index = 0, style, className }: { children: ReactNode; index?: number; style?: CSSProperties; className?: string }) {
  const ctx = useContext(StaggerContext)
  const phase = ctx?.phase ?? 'static'
  const delay = index * (ctx?.gap ?? 0)

  return (
    <div className={className} style={revealStyle(phase, 22, delay, style)}>
      {children}
    </div>
  )
}
