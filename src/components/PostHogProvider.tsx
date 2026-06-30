'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
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

if (typeof window !== 'undefined' && POSTHOG_KEY) {
  clearPostHogToolbarState()

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_PROXY_HOST,
    ui_host: POSTHOG_UI_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
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
    },
  })
}

function PostHogIdentify() {
  const { data: session } = useSession()
  const ph = usePostHog()
  const identified = useRef(false)

  useEffect(() => {
    if (!ph) return
    if (session?.user?.email && !identified.current) {
      ph.identify(session.user.email, {
        name: session.user.name ?? undefined,
        email: session.user.email,
      })
      identified.current = true
    } else if (!session?.user && identified.current) {
      ph.reset()
      identified.current = false
    }
  }, [session, ph])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  )
}
