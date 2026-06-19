'use client'

import posthog from 'posthog-js'
import { NavChevron } from '@/components/ui/NavButton'

// Convert a participant into a host at the ideal moment — right after they've
// finished and enjoyed a quiz. Lands them in the builder (post-signin).
// intent=signup → correct first-timer framing ("Create your account / Start hosting free")
// callbackUrl → lands them in the builder, not the generic dashboard
const CREATE_URL =
  '/auth/signin?intent=signup&callbackUrl=%2Fhost%2Fbuild&utm_source=participant&utm_medium=quiz-end&utm_campaign=create-cta'

interface Props {
  /** Where the CTA was shown, for conversion analytics. */
  context?: 'quiz-ended' | 'selfpaced-done'
  /** Override the wrapper classes (e.g. margin) for the host layout. */
  className?: string
}

export function CreateYourOwnCTA({ context = 'quiz-ended', className = 'mt-6' }: Props) {
  const handleClick = () => {
    try {
      posthog.capture?.('participant_create_cta_click', { context })
    } catch {
      // Non-blocking — never let analytics break navigation.
    }
  }

  return (
    <div
      className={`rounded-2xl p-5 text-center w-full ${className}`}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(15,27,61,0.04)' }}
    >
      <p className="font-black text-base mb-1" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
        Liked this quiz?
      </p>
      <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
        Make your own — free, no app needed.
      </p>
      <a
        href={CREATE_URL}
        onClick={handleClick}
        className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-black text-base transition-all hover:opacity-90"
        style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
      >
        Create your own
        <NavChevron direction="forward" className="w-5 h-5" />
      </a>
      <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
        Free · ready in 10 minutes
      </p>
    </div>
  )
}
