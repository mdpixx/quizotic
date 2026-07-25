'use client'

// Fires the top-of-funnel event for the testimonial page.
//
// /share-your-story is invite-gated: without a valid cookie token the visitor
// gets a rejection card instead of the form. Previously nothing on this page
// was instrumented, so 12 visits and 0 submissions was unexplainable — we
// could not tell whether people saw the form and left, or were turned away by
// an invalid or expired link. `state` is the discriminator that answers it.

import { useEffect, useRef } from 'react'
import { captureRaw } from '@/lib/analytics'

export function TestimonialPageView({ state }: { state: 'active' | 'invalid' | 'expired' | 'submitted' }) {
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    captureRaw('testimonial_page_viewed', { state })
  }, [state])
  return null
}
