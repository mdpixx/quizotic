'use client'

// The in-app half of the lifecycle system. Design spec §4.
//
// Reporting 'shown' is not analytics. The worker only emails a nudge whose
// shownAt is still null after 48 hours, so this fetch is the mechanism by
// which somebody already in the product does not also get mailed about it.
// If this component silently fails to report, people who are actively using
// Quizotic start receiving onboarding email — which is the single most
// irritating outcome the whole design is arranged to prevent.
//
// It therefore renders nothing and does nothing on any error. A nudge is the
// least important thing on the dashboard; it must never be able to break it.

import { useCallback, useEffect, useState } from 'react'
import { track } from '@/lib/analytics'

interface Nudge {
  id: string
  campaignKey: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  seen: boolean
}

export function NudgeCard() {
  const [nudge, setNudge] = useState<Nudge | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/lifecycle/nudge')
        if (!res.ok) return
        const data = (await res.json()) as { nudge: Nudge | null }
        if (cancelled || !data.nudge) return

        setNudge(data.nudge)

        // Report immediately on render, not on interaction. The point is that
        // they had the chance to see it — whether they engage is a separate
        // question, answered by 'acted' and 'dismissed'.
        if (!data.nudge.seen) {
          void transition(data.nudge.id, 'shown')
          track('nudge_shown', { campaignKey: data.nudge.campaignKey })
        }
      } catch {
        // Offline or a failing endpoint. Render nothing.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const resolve = useCallback(
    (action: 'acted' | 'dismissed') => {
      if (!nudge) return
      void transition(nudge.id, action)
      track(action === 'acted' ? 'nudge_acted' : 'nudge_dismissed', {
        campaignKey: nudge.campaignKey,
      })
      // Hide immediately rather than waiting on the request. The state change
      // is best-effort; the user's intent is not.
      setNudge(null)
    },
    [nudge],
  )

  if (!nudge) return null

  return (
    <div
      className="rounded-2xl border p-4 h-full"
      style={{ background: '#FFFDF0', borderColor: '#F1E9A8' }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>
          {nudge.title}
        </p>
        <button
          onClick={() => resolve('dismissed')}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
          style={{ color: '#94A3B8' }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
        {nudge.body}
      </p>
      <div className="flex items-center gap-3 mt-3">
        <a
          href={nudge.ctaHref}
          onClick={() => resolve('acted')}
          className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90"
          style={{ background: '#0F1B3D', color: '#fff' }}
        >
          {nudge.ctaLabel}
        </a>
        <button
          onClick={() => resolve('dismissed')}
          className="text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#94A3B8' }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}

async function transition(id: string, action: 'shown' | 'acted' | 'dismissed') {
  try {
    await fetch('/api/lifecycle/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
  } catch {
    // Best-effort. A missed 'acted' costs nothing — the nudge closes on the
    // next tick when the user's tier moves. A missed 'shown' is worse, but
    // retrying here would mean a request loop on a broken endpoint.
  }
}
