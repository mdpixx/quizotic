'use client'

// Thin wrapper over posthog-js for custom product events. Autocapture answers
// "where do people click"; these named events answer the product questions —
// which features get used, where sessions die, what converts.
//
// Safe to call anywhere client-side: no-ops when PostHog isn't configured and
// never throws into the calling flow.

import posthog from 'posthog-js'

const ENABLED = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY

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

export function track(event: ProductEvent, props?: Record<string, string | number | boolean | null>): void {
  if (!ENABLED) return
  try {
    posthog.capture(event, props)
  } catch {
    // Analytics must never break a user flow.
  }
}
