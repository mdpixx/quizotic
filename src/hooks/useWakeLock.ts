'use client'

import { useEffect, useRef } from 'react'

// Keeps the device screen awake for the duration that `active` is true, using
// the Screen Wake Lock API. Used on the participant join page so phones don't
// dim/lock mid-quiz while the participant waits for the next question.
//
// Browsers automatically release a wake lock the moment the tab becomes
// hidden (visibilitychange → hidden). When the user returns to the tab we
// re-acquire so the lock survives an app-switch round-trip.
//
// Silent on unsupported browsers (older iOS Safari < 16.4, Firefox iOS).
// Wrapped in try/catch so a NotAllowedError (e.g. low-power mode) never
// reaches the UI.

interface WakeLockSentinel {
  release: () => Promise<void>
  released: boolean
  addEventListener: (type: 'release', listener: () => void) => void
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>
  }
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const nav = navigator as Navigator & WakeLockNavigator
    if (!nav.wakeLock) return
    if (!active) return

    let cancelled = false

    async function acquire() {
      if (cancelled) return
      try {
        const sentinel = await nav.wakeLock!.request('screen')
        if (cancelled) {
          try { await sentinel.release() } catch {}
          return
        }
        sentinelRef.current = sentinel
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null
        })
      } catch {
        // Silently swallow — denied permission, low-power mode, etc.
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && active && !sentinelRef.current) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => {})
      }
    }
  }, [active])
}
