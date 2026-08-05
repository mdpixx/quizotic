'use client'

// Outer composition for a slide: padding, host logo, layout columns, join rail.
//
// Why this is separate from <SlideShell>:
//
// The live stage (`host/present/session/page.tsx`) and the builder preview
// (`host/present/create/page.tsx`, the ~520-line `SlidePreview`) are two
// independently written renderers for the same 20 slide types. Teaching four
// layout variants to both would guarantee they drift. SlideFrame extracts only
// the OUTER composition — the part the layout actually changes — so both
// renderers keep their own per-type bodies and still agree on where those
// bodies sit on screen.
//
// Sizing note: the stage sets `container-type: inline-size`, under which `cqh`
// does not resolve. Every vertical measure here is therefore in `cqw`
// (on a 16:9 frame, 1cqh = 0.5625cqw).

import React from 'react'
import type { Slide } from '@/lib/presentation-types'
import { getSlideTextColor } from '@/lib/presentation-types'

export type SlideLayout = 'centre' | 'content-left' | 'content-right' | 'image-split'

export const SLIDE_LAYOUTS: readonly SlideLayout[] = [
  'centre',
  'content-left',
  'content-right',
  'image-split',
]

export const SLIDE_LAYOUT_META: Record<SlideLayout, { label: string; hint: string }> = {
  'centre': { label: 'Centre', hint: 'Question above the result, full width' },
  'content-left': { label: 'Content left', hint: 'Result left, media right' },
  'content-right': { label: 'Content right', hint: 'Media left, result right' },
  'image-split': { label: 'Image split', hint: 'Half media, half result' },
}

/**
 * Resolves a slide's layout, defaulting to `centre`.
 *
 * Every presentation created before this field existed has `layout:
 * undefined`, and must keep rendering exactly as it does today.
 */
export function getSlideLayout(slide: { layout?: SlideLayout } | undefined): SlideLayout {
  const value = slide?.layout
  return value && (SLIDE_LAYOUTS as readonly string[]).includes(value) ? value : 'centre'
}

/** Layouts that place media beside the content rather than inside it. */
export function layoutHasMediaColumn(layout: SlideLayout): boolean {
  return layout !== 'centre'
}

interface SlideFrameProps {
  slide: Slide
  /** Result/question body. Rendered by the caller's own per-type renderer. */
  children: React.ReactNode
  /** Media column for the non-centre layouts. Ignored when layout is `centre`. */
  media?: React.ReactNode
  /** Join column. Omit on content slides and in the builder preview. */
  rail?: React.ReactNode
  /** Host's logo, top-left. */
  logoUrl?: string
  /** Slide-position dots and counter, rendered above the content. */
  eyebrow?: React.ReactNode
  className?: string
}

const GRID_BY_LAYOUT: Record<Exclude<SlideLayout, 'centre'>, string> = {
  'content-left': '58fr 42fr',
  'content-right': '42fr 58fr',
  'image-split': '1fr 1fr',
}

export function SlideFrame({
  slide,
  children,
  media,
  rail,
  logoUrl,
  eyebrow,
  className = '',
}: SlideFrameProps) {
  const layout = getSlideLayout(slide as Slide & { layout?: SlideLayout })
  const textColor = getSlideTextColor(slide)

  // Content + media, arranged per layout. The rail is deliberately composed
  // OUTSIDE this grid so all four layouts work with and without it.
  let inner: React.ReactNode
  if (layout === 'centre' || !media) {
    inner = <div style={COLUMN}>{children}</div>
  } else {
    const contentFirst = layout !== 'content-right'
    const contentCol = (
      <div key="content" style={COLUMN}>
        {children}
      </div>
    )
    const mediaCol = (
      <div
        key="media"
        style={
          layout === 'image-split'
            ? // Bleeds to the slide edge — cancels the frame's own padding.
              { margin: '-3.4cqw -7cqw -3cqw 0', minWidth: 0, overflow: 'hidden' }
            : { padding: '1cqw 0', minWidth: 0, display: 'flex', alignItems: 'center' }
        }
      >
        {media}
      </div>
    )
    inner = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_BY_LAYOUT[layout],
          gap: '3cqw',
          height: '100%',
          minHeight: 0,
        }}
      >
        {contentFirst ? [contentCol, mediaCol] : [mediaCol, contentCol]}
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '3.4cqw 7cqw 3cqw',
        minHeight: 0,
      }}
    >
      {logoUrl ? (
        <div style={{ marginBottom: '1.6cqw', flexShrink: 0 }}>
          {/* Plain <img>: the host's logo is arbitrary and often transparent
              PNG; next/image would add nothing and costs a remote-pattern
              allowlist entry per storage host. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            style={{
              height: 'clamp(14px, 2.6cqw, 40px)',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      ) : null}

      {eyebrow ? <div style={{ flexShrink: 0, marginBottom: '1.6cqw' }}>{eyebrow}</div> : null}

      {rail ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) clamp(140px, 25cqw, 360px)',
            gap: '3.4cqw',
            flex: 1,
            minHeight: 0,
          }}
        >
          {inner}
          {rail}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, color: textColor }}>{inner}</div>
      )}
    </div>
  )
}

const COLUMN: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  height: '100%',
}
