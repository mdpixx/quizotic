'use client'
import { useSyncExternalStore } from 'react'

const TABLET_BP = 1024  // lg — desktop starts here
const MOBILE_BP = 768   // md — tablet starts here

const MOBILE_QUERY = `(max-width: ${MOBILE_BP - 1}px)`
const TABLET_QUERY = `(min-width: ${MOBILE_BP}px) and (max-width: ${TABLET_BP - 1}px)`

// matchMedia is an external store; useSyncExternalStore subscribes without the
// setState-in-effect churn. Server snapshots mirror the old initial state
// (not mobile / desktop) so SSR output is unchanged.

function subscribeMedia(queries: string[], onChange: () => void): () => void {
  const mqls = queries.map(q => window.matchMedia(q))
  mqls.forEach(mql => mql.addEventListener('change', onChange))
  return () => mqls.forEach(mql => mql.removeEventListener('change', onChange))
}

const subscribeMobile = (onChange: () => void) => subscribeMedia([MOBILE_QUERY], onChange)
const subscribeViewport = (onChange: () => void) => subscribeMedia([MOBILE_QUERY, TABLET_QUERY], onChange)

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

function viewportSnapshot(): 'mobile' | 'tablet' | 'desktop' {
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile'
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet'
  return 'desktop'
}

export function useViewport(): 'mobile' | 'tablet' | 'desktop' {
  return useSyncExternalStore(subscribeViewport, viewportSnapshot, () => 'desktop')
}
