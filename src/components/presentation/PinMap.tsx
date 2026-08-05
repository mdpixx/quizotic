'use client'

// Shared pin/point visualization for the `grid_2x2` and `pinpoint` slide types.
//
// Both types aggregate participant responses into `pins: {x,y}[]` (percent
// coordinates, 0–100). Previously the host renderer (`session/page.tsx`)
// inlined the dot layer for each type and colored dots by array index
// (`VOTER_COLORS[i % len]`), which meant colors reshuffled every time a new
// pin arrived. Participant results screens showed only a numeric count.
//
// PinMap unifies the two: a `grid` variant draws the 2×2 crosshair + axis
// labels; an `image` variant overlays pins on the authored image. Pin color is
// stable per rounded coordinate (a hash) so a participant's dot doesn't change
// hue as others join. The same component powers the host stage, the participant
// results screen, and (read-only) the participant input preview.

import React from 'react'
import { relaxPins, driftFor } from '@/lib/pin-layout'
import { staggerDelay } from '@/lib/motion'

// Palette for pins. Matches the host's VOTER_COLORS family but extended.
const PIN_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4',
  '#8B5CF6', '#EF4444', '#84CC16', '#0EA5E9', '#F97316',
]

// Dots arrive on a spring, then drift continuously so the chart looks alive
// rather than like a screenshot of itself.
//
// Three separate transforms would fight over one `transform` property, so each
// gets its own layer: the outer element positions, the middle drifts, the
// inner scales in. The drift is a CSS keyframe with a per-dot duration and a
// negative delay — never requestAnimationFrame. Two hundred dots on a JS loop
// drops frames on the sort of laptop that is usually driving a projector.
const PIN_MOTION_CSS = `
@keyframes qz-pin-in {
  0%   { opacity: 0; transform: scale(0) }
  60%  { opacity: 1; transform: scale(1.15) }
  100% { opacity: .92; transform: scale(1) }
}
@keyframes qz-pin-drift {
  0%   { transform: translate(0, 0) }
  25%  { transform: translate(var(--qz-dx), var(--qz-dy)) }
  50%  { transform: translate(calc(var(--qz-dx) * -0.6), calc(var(--qz-dy) * 0.8)) }
  75%  { transform: translate(calc(var(--qz-dx) * 0.4), calc(var(--qz-dy) * -0.7)) }
  100% { transform: translate(0, 0) }
}
.qz-pin-drift { animation: qz-pin-drift var(--qz-dur) cubic-bezier(0.65,0,0.35,1) var(--qz-delay) infinite; }
.qz-pin-in { animation: qz-pin-in 320ms cubic-bezier(0.34,1.56,0.64,1) var(--qz-in-delay) both; }
@media (prefers-reduced-motion: reduce) {
  .qz-pin-drift { animation: none }
  .qz-pin-in { animation: none; opacity: .92; transform: scale(1) }
}
`

// Deterministic color from a pin coordinate so the same response keeps its
// color across re-renders. Rounds to 2% buckets so nearby taps don't jitter.
export function pinColor(pin: { x: number; y: number }): string {
  const bx = Math.round(pin.x / 2)
  const by = Math.round(pin.y / 2)
  const h = (bx * 73856093) ^ (by * 19349663)
  const idx = Math.abs(h) % PIN_PALETTE.length
  return PIN_PALETTE[idx]
}

export interface Pin {
  x: number
  y: number
}

interface PinMapProps {
  pins: Pin[]
  variant: 'grid' | 'image'
  /** Required for `image` variant; ignored for `grid`. */
  imageUrl?: string
  /** Axis labels (grid variant). */
  xLabel?: string
  yLabel?: string
  xMin?: string
  xMax?: string
  yMin?: string
  yMax?: string
  /** Text color for labels. Callers resolve this from the slide's bg. */
  labelColor?: string
  /** Visual emphasis for the host stage (larger dots, stronger crosshair). */
  size?: 'sm' | 'md' | 'lg'
  /** Render only the inner plot (no axis labels) — used when the caller
   *  composes its own axes. Defaults false. */
  bare?: boolean
  /**
   * Which axis bounds the square grid.
   *
   * `width` (default) is right on a phone, where the column is narrow and
   * vertical space is cheap. `height` is right on a projected 16:9 frame,
   * where the short axis is vertical — sizing from width there leaves the grid
   * either overflowing or marooned in whitespace.
   */
  fit?: 'width' | 'height'
  className?: string
  style?: React.CSSProperties
}

const DOT_PX: Record<NonNullable<PinMapProps['size']>, number> = {
  sm: 8,
  md: 11,
  lg: 14,
}

export function PinMap({
  pins,
  variant,
  imageUrl,
  xLabel,
  yLabel,
  xMin,
  xMax,
  yMin,
  yMax,
  labelColor = '#0F1B3D',
  size = 'md',
  bare = false,
  fit = 'width',
  className = '',
  style,
}: PinMapProps) {
  const dot = DOT_PX[size]
  const isGrid = variant === 'grid'
  const fitHeight = isGrid && fit === 'height'

  // Relaxation is O(n² × passes), so memoise on the pin array rather than
  // recomputing on every parent render (the host stage re-renders on each
  // incoming vote).
  const laidOut = React.useMemo(
    () => relaxPins(pins).map((placed, i) => ({ pin: pins[i], placed })),
    [pins],
  )

  const plot = (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        aspectRatio: isGrid ? '1' : '4 / 3',
        // Height-fit lets the square take the frame's short axis; the browser
        // derives width from the aspect ratio. `flex: none` is required — as a
        // flex item the default `flex-shrink: 1` overrides the aspect-derived
        // width and collapses the square into a vertical strip.
        ...(fitHeight ? { height: '100%', width: 'auto', flex: 'none' } : { width: '100%' }),
        background: isGrid ? 'rgba(255,255,255,0.6)' : (imageUrl ? '#000' : '#F3F4F6'),
        border: `1.5px solid ${isGrid ? 'rgba(15,27,61,0.18)' : 'rgba(15,27,61,0.12)'}`,
        ...style,
      }}
    >
      {isGrid ? (
        <>
          {/* Quadrant tints to make the 2×2 read clearly. */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            <div style={{ background: 'rgba(99,102,241,0.06)' }} />
            <div style={{ background: 'rgba(236,72,153,0.06)' }} />
            <div style={{ background: 'rgba(16,185,129,0.06)' }} />
            <div style={{ background: 'rgba(245,158,11,0.06)' }} />
          </div>
          {/* Crosshair axes — thicker than the old 1px hairlines. */}
          <div className="absolute left-1/2 top-0 bottom-0" style={{ width: 2, transform: 'translateX(-50%)', background: 'rgba(15,27,61,0.22)' }} />
          <div className="absolute top-1/2 left-0 right-0" style={{ height: 2, transform: 'translateY(-50%)', background: 'rgba(15,27,61,0.22)' }} />
          {/* Center marker */}
          <div className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: 'rgba(15,27,61,0.35)' }} />
        </>
      ) : imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
          <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
            No background image — edit the slide to upload one
          </p>
        </div>
      )}

      {/* Pins. Laid out through relaxPins so a clustered room stays countable —
          without it six taps in one spot render as two dots. Colour and drift
          both key off the ORIGINAL coordinate, so a dot keeps its identity as
          more responses arrive and shift the layout around it. */}
      <style>{PIN_MOTION_CSS}</style>
      {laidOut.map(({ pin, placed }, i) => {
        const drift = driftFor(pin)
        return (
          <div
            key={`${pin.x}-${pin.y}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${placed.x}%`, top: `${placed.y}%`, width: dot, height: dot }}
          >
            <div
              className="qz-pin-drift"
              style={{
                width: '100%',
                height: '100%',
                ['--qz-dx' as string]: `${drift.dx}px`,
                ['--qz-dy' as string]: `${drift.dy}px`,
                ['--qz-dur' as string]: `${drift.duration}s`,
                ['--qz-delay' as string]: `${drift.delay}s`,
              }}
            >
              <div
                className="qz-pin-in rounded-full"
                style={{
                  width: '100%',
                  height: '100%',
                  background: pinColor(pin),
                  border: `${Math.max(1, Math.round(dot / 6))}px solid rgba(255,255,255,0.85)`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  ['--qz-in-delay' as string]: `${staggerDelay(i)}ms`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )

  if (bare) {
    return <div className={className}>{plot}</div>
  }

  if (isGrid && fitHeight) {
    // Labels sit INSIDE the plot, along its edges.
    //
    // Outside-the-plot labels need a wrapper whose width matches the square,
    // and that width is derived from the square's own height via aspect-ratio
    // — a circular dependency the browser resolves as zero, which bunched the
    // x-axis labels into the corner. Inside the plot there is a real box to
    // align against, and it is also where Mentimeter puts them.
    const label = (text: string, style: React.CSSProperties) => (
      <span
        style={{
          position: 'absolute',
          color: labelColor,
          opacity: 0.6,
          fontSize: 'clamp(8px, 1.15cqw, 16px)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          ...style,
        }}
      >
        {text}
      </span>
    )
    return (
      <div className={`flex ${className}`} style={{ height: '100%', minHeight: 0, flex: 'none' }}>
        <div style={{ position: 'relative', height: '100%', flex: 'none' }}>
          {plot}
          {/* Conventional axis placement: the y scale runs up the left edge,
              the x scale along the bottom. The y minimum is lifted clear of
              the x row so the shared bottom-left corner never collides. */}
          {label(yMax || 'High', { top: '2%', left: '2%' })}
          {label(yMin || 'Low', { bottom: '9%', left: '2%' })}
          {label(xMin || 'Low', { bottom: '2%', left: '2%' })}
          {label(xMax || 'High', { bottom: '2%', right: '2%' })}
          {yLabel
            ? label(yLabel, {
                top: '50%',
                left: '2%',
                transform: 'translateY(-50%) rotate(180deg)',
                writingMode: 'vertical-rl',
                opacity: 0.4,
              })
            : null}
          {xLabel
            ? label(xLabel, { bottom: '2%', left: '50%', transform: 'translateX(-50%)', opacity: 0.4 })
            : null}
        </div>
      </div>
    )
  }

  if (isGrid) {
    return (
      <div className={`relative flex ${className}`}>
        {/* Y-axis label column */}
        <div className="flex flex-col justify-between items-center py-1 mr-2" style={{ width: 22 }}>
          <span className="text-[10px] font-bold" style={{ color: labelColor, opacity: 0.65 }}>{yMax || 'High'}</span>
          {yLabel ? (
            <span className="text-[10px] font-bold rotate-180" style={{ color: labelColor, opacity: 0.65, writingMode: 'vertical-rl' as const }}>
              {yLabel}
            </span>
          ) : <span />}
          <span className="text-[10px] font-bold" style={{ color: labelColor, opacity: 0.65 }}>{yMin || 'Low'}</span>
        </div>
        <div className="flex-1 min-w-0">
          {plot}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-bold" style={{ color: labelColor, opacity: 0.65 }}>{xMin || 'Low'}</span>
            {xLabel ? <span className="text-[10px] font-bold" style={{ color: labelColor, opacity: 0.65 }}>{xLabel}</span> : <span />}
            <span className="text-[10px] font-bold" style={{ color: labelColor, opacity: 0.65 }}>{xMax || 'High'}</span>
          </div>
        </div>
      </div>
    )
  }

  // image variant — no axis labels
  return <div className={className}>{plot}</div>
}
