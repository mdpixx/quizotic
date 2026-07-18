'use client'

// Presentational spinning wheel (Wheel of Names).
//
// Pure SVG driven by a single `rotation` prop — no animation or randomization
// logic lives here. The host (authoritative) computes the winner + target
// rotation on the server, broadcasts it, and both the host and every
// participant phone animate `rotation` → `targetRotation` identically via a
// CSS transition on the rotating group. This mirrors the AhaSlides model:
// only the host spins, but everyone sees the same wheel spin live and the
// same winner revealed.
//
// Slices are equal-sized and recomputed when `names.length` changes. Each
// name is drawn ON its slice (rotated text along the radius), not below the
// wheel — the previous editor preview drew names as loose chips beneath a
// `conic-gradient`, which is the bug this replaces.

import React from 'react'

// Palette cycled across slices. Kept vivid on a light card so slices read
// distinctly even on a projected stage. The default slide bg for `wheel` is
// `#FEF3C7` (amber-50), so a colorful wheel pops against it.
export const WHEEL_PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#EF4444', // red
  '#84CC16', // lime
  '#0EA5E9', // sky
  '#F97316', // orange
  '#14B8A6', // teal
  '#A855F7', // purple
]

interface SpinWheelProps {
  /** Names to render as slices. Empty/blank entries are dropped by the caller. */
  names: string[]
  /** Current rotation in degrees. Caller animates this (CSS transition). */
  rotation: number
  /** When true, the slice under the pointer is highlighted (winner reveal). */
  winnerIndex?: number
  /** Optional inline style passthrough on the root wrapper. */
  style?: React.CSSProperties
  /** Optional className passthrough on the root wrapper. */
  className?: string
  /** Optional ms for the spin transition. Caller controls when it animates by
   *  bumping `rotation`; passing duration here keeps the transition consistent
   *  across host + participant. */
  spinDurationMs?: number
  /** Disable the transition (e.g. instant snap-back between spins). */
  noTransition?: boolean
  /** Size in px of the square wheel. Defaults to fill the parent via 100%. */
  size?: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // SVG angles are clockwise from +x; pointer sits at top (−y). The slices are
  // drawn starting at the top so slice 0 is under the pointer at rotation 0.
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, endDeg)
  const end = polarToCartesian(cx, cy, r, startDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export function SpinWheel({
  names,
  rotation,
  winnerIndex,
  style,
  className,
  spinDurationMs = 5200,
  noTransition = false,
  size,
}: SpinWheelProps) {
  const n = Math.max(names.length, 1)
  const sliceAngle = 360 / n
  const viewBox = 200
  const cx = viewBox / 2
  const cy = viewBox / 2
  const r = 96 // leaves room for labels + outer ring within the 200² viewBox
  const labelR = r * 0.62 // text sits along the radius, inside the slice

  const transition = noTransition
    ? 'none'
    : `transform ${spinDurationMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`

  return (
    <div
      className={className}
      style={{
        width: size ? `${size}px` : '100%',
        maxWidth: '100%',
        aspectRatio: '1',
        position: 'relative',
        ...style,
      }}
    >
      {/* Fixed pointer at the top — stays put while the wheel rotates. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          width: 0,
          height: 0,
          borderLeft: '11px solid transparent',
          borderRight: '11px solid transparent',
          borderTop: '20px solid #fff',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
        }}
      />

      <svg
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
      >
        {/* Rotating group. Caller bumps `rotation`; CSS transition animates it. */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition,
          }}
        >
          {names.map((name, i) => {
            const start = i * sliceAngle
            const end = (i + 1) * sliceAngle
            const color = WHEEL_PALETTE[i % WHEEL_PALETTE.length]
            const isWinner = winnerIndex === i
            // Label oriented along the radius through the slice midpoint.
            const midAngle = start + sliceAngle / 2
            const labelPos = polarToCartesian(cx, cy, labelR, midAngle)
            return (
              <g key={`${name}-${i}`}>
                <path
                  d={arcPath(cx, cy, r, start, end)}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={isWinner ? 2.5 : 1.25}
                  style={isWinner ? { filter: 'url(#wheelWinnerGlow)' } : undefined}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#fff"
                  fontSize={Math.max(7, Math.min(13, 90 / Math.max(n, 4)))}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${midAngle} ${labelPos.x} ${labelPos.y})`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)', pointerEvents: 'none' }}
                >
                  {truncate(name, n)}
                </text>
              </g>
            )
          })}

          {/* Outer ring + hub. */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={2.5} />
          <circle cx={cx} cy={cy} r={14} fill="#fff" stroke="rgba(15,27,61,0.15)" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={5} fill="#0F1B3D" />
        </g>

        {/* Glow filter for the winning slice. */}
        <defs>
          <filter id="wheelWinnerGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  )
}

// Keep long names from overflowing thin slices: show fewer chars as the wheel
// fills up. Ellipsis is added when truncated.
function truncate(name: string, sliceCount: number): string {
  const max = sliceCount <= 4 ? 18 : sliceCount <= 8 ? 12 : sliceCount <= 16 ? 8 : 5
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1) + '…'
}

/**
 * Compute the target rotation (degrees) so the pointer lands on `winnerIndex`
 * after `fullTurns` full revolutions. The pointer is fixed at the top (0deg);
 * slice i occupies [i*sliceAngle, (i+1)*sliceAngle) measured clockwise from
 * the top at rotation 0, so its midpoint sits at (i+0.5)*sliceAngle.
 *
 * Because the wheel rotates clockwise (positive degrees), to bring a slice
 * midpoint under the top pointer we rotate by `fullTurns*360 + (360 - mid)`.
 * Returned value is normalized to [0, 360) plus the full turns so the CSS
 * transition always travels forward.
 */
export function computeSpinRotation(winnerIndex: number, sliceCount: number, fullTurns = 6): number {
  if (sliceCount <= 0) return 0
  const sliceAngle = 360 / sliceCount
  const mid = (winnerIndex + 0.5) * sliceAngle
  // Add a small random jitter inside the slice (±35% of sliceAngle) so the
  // pointer doesn't always land dead-center — feels more natural.
  const jitter = (Math.random() - 0.5) * sliceAngle * 0.7
  const target = (360 - (mid + jitter) + 360) % 360
  return fullTurns * 360 + target
}
