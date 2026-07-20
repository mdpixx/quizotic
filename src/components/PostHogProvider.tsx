'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import type { PostHog } from 'posthog-js'
import { setAnalyticsClient } from '@/lib/analytics'
import {
  clearPostHogToolbarState,
  preparePostHogDependencyScript,
} from '@/lib/posthog-toolbar-guard'
import { isNoiseError } from '@/lib/error-noise'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''
// Same-origin reverse proxy (see the /ingest rewrites in next.config.ts) so ad
// blockers can't strip analytics — requests look first-party. ui_host points at
// the real EU app so the toolbar and dashboard links still resolve correctly.
const POSTHOG_PROXY_HOST = '/ingest'
const POSTHOG_UI_HOST = 'https://eu.posthog.com'

// Participant surfaces run on classroom phones over 1–2 Mbps connections and
// exist to answer questions fast. They keep the custom funnel events (via
// lib/analytics) but skip the heavyweight extras: session recording is an
// extra ~100KB script plus a continuous upload stream per student, and DOM
// autocapture/surveys add beacon chatter with near-zero product insight for
// an anonymous quiz answerer. Host and marketing surfaces keep everything.
function isParticipantSurface(pathname: string): boolean {
  return (
    pathname === '/join' ||
    pathname.startsWith('/join/') ||
    pathname === '/play' ||
    pathname.startsWith('/play/') ||
    pathname.startsWith('/q/') ||
    pathname.startsWith('/r/') ||
    pathname === '/share-your-story'
  )
}

// posthog-js is loaded lazily (dynamic import on idle or first interaction)
// so analytics never sits in any page's initial bundle or competes with the
// quiz for first-paint bandwidth. Module-level promise: init exactly once.
let loadPromise: Promise<PostHog | null> | null = null
function loadPostHog(): Promise<PostHog | null> {
  if (loadPromise) return loadPromise
  loadPromise = import('posthog-js')
    .then(({ default: posthog }) => {
      return new Promise<PostHog | null>(resolve => {
        clearPostHogToolbarState()
        const participant = isParticipantSurface(window.location.pathname)
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_PROXY_HOST,
          ui_host: POSTHOG_UI_HOST,
          person_profiles: 'identified_only',
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: !participant,
          capture_dead_clicks: !participant,
          disable_session_recording: participant,
          disable_surveys: participant,
          // Capture unhandled errors/rejections into PostHog Error Tracking. The
          // exception-autocapture extension is lazy-loaded and only listens to
          // existing window error events — it never swallows or alters them, so the
          // user experience is unchanged. Added because `$exception` was silently at
          // zero, leaving real breakages (e.g. a dead signup path) invisible.
          capture_exceptions: true,
          // Drop known third-party browser noise (extensions, translation widgets)
          // before it reaches Error Tracking. See lib/error-noise.ts for why.
          before_send: (event) => {
            if (event && event.event === '$exception') {
              const list = event.properties?.['$exception_list']
              const blob = typeof list === 'string' ? list : JSON.stringify(list ?? '')
              if (isNoiseError(blob)) return null
            }
            return event
          },
          advanced_disable_feature_flags: true,
          prepare_external_dependency_script: preparePostHogDependencyScript,
          loaded: (ph) => {
            clearPostHogToolbarState()
            ph.debug(false)
            // Resolve the module singleton: the callback narrows to
            // PostHogInterface, but callers want the full PostHog client.
            resolve(posthog)
          },
        })
      })
    })
    .catch(() => null)
  return loadPromise
}

function PostHogIdentify({ client }: { client: PostHog | null }) {
  const { data: session } = useSession()
  const identified = useRef(false)

  useEffect(() => {
    if (!client) return
    if (session?.user?.email && !identified.current) {
      client.identify(session.user.email, {
        name: session.user.name ?? undefined,
        email: session.user.email,
      })
      identified.current = true
    } else if (!session?.user && identified.current) {
      client.reset()
      identified.current = false
    }
  }, [session, client])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null)

  useEffect(() => {
    if (!POSTHOG_KEY) return
    let cancelled = false
    const start = () => {
      void loadPostHog().then(ph => {
        if (!ph || cancelled) return
        setAnalyticsClient(ph)
        setClient(ph)
      })
    }
    // First interaction beats idle so early taps still enter the funnel
    // (pre-init events queue in lib/analytics either way); the idle timeout
    // caps the wait so passive visits still record their pageview.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleId = w.requestIdleCallback
      ? w.requestIdleCallback(start, { timeout: 4000 })
      : window.setTimeout(start, 2500)
    window.addEventListener('pointerdown', start, { once: true, capture: true })
    window.addEventListener('keydown', start, { once: true, capture: true })
    return () => {
      cancelled = true
      if (w.cancelIdleCallback) w.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      window.removeEventListener('pointerdown', start, { capture: true })
      window.removeEventListener('keydown', start, { capture: true })
    }
  }, [])

  return (
    <>
      <PostHogIdentify client={client} />
      {children}
    </>
  )
}
