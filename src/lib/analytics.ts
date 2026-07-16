'use client'

// Thin wrapper over posthog-js for custom product events. Autocapture answers
// "where do people click"; these named events answer the product questions —
// which features get used, where sessions die, what converts.
//
// Safe to call anywhere client-side: no-ops when PostHog isn't configured and
// never throws into the calling flow.
//
// posthog-js is deliberately NOT imported here: this facade sits in the
// import graph of every page (including the participant page, which has a
// hard low-bandwidth budget for 1–2 Mbps classroom connections), and a
// static import would drag ~50KB gz of analytics into every initial bundle.
// PostHogProvider lazy-loads the client on idle/first-interaction and hands
// it over via setAnalyticsClient; events fired before that are queued and
// drained on arrival — strictly better than the old behavior, which silently
// dropped pre-init captures.

import type { PostHog } from 'posthog-js'

const ENABLED = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY

let client: PostHog | null = null
const preInitQueue: Array<{ event: string; props?: Record<string, string | number | boolean | null> }> = []

/** Wired up once by PostHogProvider after the lazily-loaded client is ready. */
export function setAnalyticsClient(ph: PostHog): void {
  client = ph
  for (const { event, props } of preInitQueue.splice(0)) {
    try {
      ph.capture(event, props)
    } catch {
      // Analytics must never break a user flow.
    }
  }
}

/**
 * Low-level capture for the few surfaces with bespoke event names (share CTA
 * etc.). Product code should prefer track() and the ProductEvent union.
 */
export function captureRaw(event: string, props?: Record<string, string | number | boolean | null>): void {
  if (!ENABLED) return
  try {
    if (client) client.capture(event, props)
    else if (preInitQueue.length < 100) preInitQueue.push({ event, props })
  } catch {
    // Analytics must never break a user flow.
  }
}

export type ProductEvent =
  | 'quiz_saved'
  | 'quiz_created'
  | 'ai_generate_applied'
  | 'live_session_started'
  | 'live_session_completed'
  | 'selfpaced_share_opened'
  | 'presentation_session_started'
  | 'feedback_submitted'
  // Activation funnel: onboard_started → onboard_completed → quiz_created → live_session_started
  | 'onboard_started'
  | 'onboard_completed'
  | 'profile_completed'
  | 'landing_join_code_used'
  | 'demo_session_started'
  | 'quiz_scheduled'
  // Participant funnel (the live & self-paced player journey on /join and /q).
  // join → joined → answered → finished, plus join_failed for the bounce reason.
  | 'participant_joined'
  | 'participant_join_failed'
  | 'participant_answered'
  | 'participant_finished'
  | 'selfpaced_started'
  | 'selfpaced_completed'
  // Quiz sharing (share-a-copy links between teachers)
  | 'quiz_share_link_created'
  | 'quiz_share_link_revoked'
  | 'quiz_imported'

export function track(event: ProductEvent, props?: Record<string, string | number | boolean | null>): void {
  captureRaw(event, props)
}
