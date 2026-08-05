'use client'

// Composition picker for a single slide.
//
// The `layout` field and its renderer shipped with SlideFrame; this is the
// control that finally lets an author reach it. Until now every slide in a
// deck used the identical vertical stack, which is the main reason a Quizotic
// deck looks the same slide after slide next to a Mentimeter one.
//
// Each option draws its own miniature rather than carrying an icon font: the
// difference between these four IS spatial, so a diagram says it faster than
// a label, and a 4-rect SVG costs less than an icon set.

import React from 'react'
import { SLIDE_LAYOUTS, SLIDE_LAYOUT_META, getSlideLayout, type SlideLayout } from '@/components/presentation/SlideFrame'

const INK = '#0F1B3D'
const MUTED = '#CBD5E1'

/** Miniature of the layout: filled blocks are content, hatched are media. */
function LayoutGlyph({ layout, active }: { layout: SlideLayout; active: boolean }) {
  const fg = active ? INK : '#94A3B8'
  const bg = active ? '#93A5C9' : MUTED
  const r = 1.2

  // 32x20 viewBox — a 16:9-ish frame with a 2px inset.
  const blocks: Record<SlideLayout, React.ReactNode> = {
    'centre': (
      <>
        <rect x="3" y="4" width="20" height="2.6" rx={r} fill={fg} />
        <rect x="3" y="9" width="26" height="2.6" rx={r} fill={bg} />
        <rect x="3" y="13" width="26" height="2.6" rx={r} fill={bg} />
      </>
    ),
    'content-left': (
      <>
        <rect x="3" y="4" width="13" height="2.6" rx={r} fill={fg} />
        <rect x="3" y="9" width="15" height="2.6" rx={r} fill={bg} />
        <rect x="3" y="13" width="15" height="2.6" rx={r} fill={bg} />
        <rect x="20" y="4" width="9" height="11.6" rx={r} fill={bg} opacity={0.55} />
      </>
    ),
    'content-right': (
      <>
        <rect x="3" y="4" width="9" height="11.6" rx={r} fill={bg} opacity={0.55} />
        <rect x="16" y="4" width="13" height="2.6" rx={r} fill={fg} />
        <rect x="16" y="9" width="13" height="2.6" rx={r} fill={bg} />
        <rect x="16" y="13" width="13" height="2.6" rx={r} fill={bg} />
      </>
    ),
    'image-split': (
      <>
        <rect x="3" y="4" width="11" height="2.6" rx={r} fill={fg} />
        <rect x="3" y="9" width="11" height="2.6" rx={r} fill={bg} />
        <rect x="3" y="13" width="11" height="2.6" rx={r} fill={bg} />
        <rect x="17" y="2" width="13" height="16" rx={r} fill={bg} opacity={0.55} />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 32 20" width="100%" height="auto" style={{ display: 'block' }} aria-hidden>
      {blocks[layout]}
    </svg>
  )
}

interface SlideLayoutPickerProps {
  slide: { layout?: SlideLayout }
  onChange: (layout: SlideLayout) => void
  /** Shown when the slide has no media — the media column renders empty. */
  hasMedia?: boolean
}

export function SlideLayoutPicker({ slide, onChange, hasMedia = true }: SlideLayoutPickerProps) {
  const current = getSlideLayout(slide)

  return (
    <div className="border-t pt-4 space-y-2.5" style={{ borderColor: '#E2E8F0' }}>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Layout</label>
        <span className="text-[10px]" style={{ color: '#94A3B8' }}>{SLIDE_LAYOUT_META[current].hint}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SLIDE_LAYOUTS.map(layout => {
          const active = current === layout
          return (
            <button
              key={layout}
              type="button"
              onClick={() => onChange(layout)}
              title={`${SLIDE_LAYOUT_META[layout].label} — ${SLIDE_LAYOUT_META[layout].hint}`}
              aria-pressed={active}
              aria-label={SLIDE_LAYOUT_META[layout].label}
              className="rounded-lg px-2 py-2 transition-all"
              style={{
                border: `1.5px solid ${active ? INK : '#E2E8F0'}`,
                background: active ? '#F1F5FF' : '#fff',
              }}
            >
              <LayoutGlyph layout={layout} active={active} />
            </button>
          )
        })}
      </div>

      {/* An empty media column is a confusing thing to stare at in the preview,
          so say why it is empty rather than letting the author think the
          layout is broken. */}
      {!hasMedia && current !== 'centre' ? (
        <p className="text-[10px] leading-snug" style={{ color: '#94A3B8' }}>
          This layout reserves a media column. Add a slide image above to fill it.
        </p>
      ) : null}
    </div>
  )
}
