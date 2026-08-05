'use client'

// Distribution curve for `rating_scale` and `scale_100`.
//
// Both types used to render one large average and discard everything else. A
// room that answers all 3s and a room that splits 1/5 both average 3.0, and
// only the second is worth stopping the session to talk about — the display
// could not tell them apart.
//
// Two implementation notes that are load-bearing:
//
//   * The path is sampled at a FIXED point count (src/lib/density.ts), so
//     successive curves interpolate. That is what makes the ridge morph as
//     responses land instead of redrawing on every vote.
//   * The mean handle is an HTML pill positioned over the SVG, not a <circle>
//     inside it. The ridge needs preserveAspectRatio="none" to fill its frame,
//     and that same stretch turns anything else in the viewBox into an ellipse.

import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { kde, densityPath, mean, meanFraction } from '@/lib/density'
import { DUR, EASE, sec, cssTransition } from '@/lib/motion'

const VIEW_W = 400
const VIEW_H = 120

interface DensityRidgeProps {
  /** Raw responses. */
  values: number[]
  /** Inclusive scale bounds, e.g. [1, 5] or [0, 100]. */
  domain: [number, number]
  minLabel: string
  maxLabel: string
  /** Resolved text colour for the slide background. */
  textColor: string
  /** Curve colour. Defaults to the calm blue from RESULT_COLORS. */
  accent?: string
  /** Decimal places on the mean. Ratings read 3.4; 100-point scales read 62. */
  precision?: number
}

export function DensityRidge({
  values,
  domain,
  minLabel,
  maxLabel,
  textColor,
  accent = '#5B8FE0',
  precision = 1,
}: DensityRidgeProps) {
  const reduce = useReducedMotion()

  const { path, meanValue, meanAt } = useMemo(() => {
    const samples = kde(values, { domain })
    return {
      path: densityPath(samples, VIEW_W, VIEW_H),
      meanValue: mean(values),
      meanAt: meanFraction(values, domain),
    }
  }, [values, domain])

  const gradientId = React.useId()

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '1.2cqw' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity="0.30" />
              <stop offset="1" stopColor={accent} stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* Fill and stroke share the same `d`, so they morph together.
              `vector-effect` keeps the stroke even width despite the stretch. */}
          <motion.path
            d={path}
            fill={`url(#${gradientId})`}
            animate={{ d: path }}
            transition={reduce ? { duration: 0 } : { duration: sec(DUR.slow), ease: EASE.calm }}
          />
          <motion.path
            d={path}
            fill="none"
            stroke={accent}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            animate={{ d: path }}
            transition={reduce ? { duration: 0 } : { duration: sec(DUR.slow), ease: EASE.calm }}
          />
          <line
            x1="0"
            y1={VIEW_H}
            x2={VIEW_W}
            y2={VIEW_H}
            stroke={textColor}
            strokeOpacity={0.12}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {meanAt !== null && meanValue !== null ? (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: `${meanAt * 100}%`,
              transform: 'translate(-50%, 50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'clamp(24px, 3.4cqw, 46px)',
              aspectRatio: '1',
              borderRadius: '50%',
              background: accent,
              color: '#fff',
              fontWeight: 700,
              fontSize: 'clamp(9px, 1.3cqw, 17px)',
              fontVariantNumeric: 'tabular-nums',
              transition: reduce ? undefined : cssTransition('left', 'slow', 'spring'),
              pointerEvents: 'none',
            }}
          >
            {meanValue.toFixed(precision)}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'clamp(8px, 1.35cqw, 18px)', fontWeight: 500, color: textColor, opacity: 0.6 }}>
          {minLabel}
        </span>
        <span style={{ fontSize: 'clamp(8px, 1.35cqw, 18px)', fontWeight: 500, color: textColor, opacity: 0.6 }}>
          {maxLabel}
        </span>
      </div>

      <div style={{ textAlign: 'center', fontSize: 'clamp(8px, 1.15cqw, 15px)', fontWeight: 500, color: textColor, opacity: 0.55 }}>
        {values.length} {values.length === 1 ? 'response' : 'responses'}
      </div>
    </div>
  )
}
