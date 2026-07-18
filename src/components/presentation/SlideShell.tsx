'use client'

// Shared layout shell for live presentation slide rendering.
//
// The host stage (`src/app/host/present/session/page.tsx`) previously
// hand-rolled a `<div className="flex flex-col h-full gap-4"><h2/><SlideImageFrame/><div className="flex-1">…</div></div>`
// skeleton in every `SlideContent` case. SlideShell centralizes that skeleton
// so heading sizing, spacing, the optional content image, and the optional
// audience-prompt line stay consistent across slide types.
//
// The shell is presentational only — it reads the slide's resolved text color
// via `getSlideTextColor` and uses container-query font sizing (the host stage
// wraps `SlideContent` in a `containerType: 'inline-size'` frame) so the
// heading scales with the projected frame, not the viewport.

import React from 'react'
import type { Slide } from '@/lib/presentation-types'
import { getSlideTextColor } from '@/lib/presentation-types'
import { SlideImageFrame } from '@/components/SlideImageFrame'

interface SlideShellProps {
  /** The slide being rendered. Used only to resolve text color + content image. */
  slide: Slide
  /** Optional heading override. Falls back to `slide.question`/`slide.title`/`slide.heading`. */
  heading?: string
  /** Placeholder shown (dimmed) when the heading is empty — mirrors the existing
   *  "Question text…" affordance in the host renderer. */
  headingPlaceholder?: string
  /** Body region. Receives the resolved text color via render-prop if needed. */
  children: React.ReactNode
  /** Optional audience-facing hint shown beneath the body (e.g. "Tap to place…"). */
  prompt?: React.ReactNode
  /** Hide the content-image frame even if `slide.contentImageUrl` is set. */
  hideContentImage?: boolean
  /** Extra className on the outer container. */
  className?: string
}

function resolveHeading(slide: Slide): string {
  const s = slide as unknown as Record<string, unknown>
  const candidates = [s.question, s.title, s.heading]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return ''
}

export function SlideShell({
  slide,
  heading,
  headingPlaceholder,
  children,
  prompt,
  hideContentImage,
  className = '',
}: SlideShellProps) {
  const textColor = getSlideTextColor(slide)
  const headingStyle: React.CSSProperties = {
    fontFamily: 'var(--font-heading)',
    color: textColor,
    fontWeight: 900,
  }
  const text = heading ?? resolveHeading(slide)
  const contentImageUrl = !hideContentImage
    ? (slide as Slide & { contentImageUrl?: string }).contentImageUrl
    : undefined

  return (
    <div className={`flex flex-col h-full min-h-0 gap-4 ${className}`}>
      {text || headingPlaceholder ? (
        <h2
          className="leading-tight flex-shrink-0 break-words"
          style={{ ...headingStyle, fontSize: 'clamp(20px, 3cqw, 40px)' }}
        >
          {text || <span className="opacity-30">{headingPlaceholder}</span>}
        </h2>
      ) : null}

      {contentImageUrl ? <SlideImageFrame url={contentImageUrl} /> : null}

      <div className="flex-1 min-h-0">{children}</div>

      {prompt ? (
        <div className="flex-shrink-0 text-center text-sm font-semibold" style={{ color: textColor, opacity: 0.7 }}>
          {prompt}
        </div>
      ) : null}
    </div>
  )
}

// Re-export for callers that want to read the resolved color alongside the shell.
export function useSlideTextColor(slide: Slide): string {
  return getSlideTextColor(slide)
}
