'use client'

// Persistent join column on the right of every interactive slide.
//
// It replaces a 44px QR floating in the top-right corner over the content —
// unscannable past the front rows, and in the way of the result it overlapped.
// Reserving a column instead means late joiners can always get in, and the
// response counter has somewhere to live that isn't on top of the chart.
//
// Two rules the layout depends on:
//
//   * The QR fills the rail's content width. A reserved region left half-empty
//     is worse than no region at all.
//   * Progress is pinned to the bottom, so the column reads top-to-bottom as
//     "how to join" then "how many have" with no dead middle.
//
// All sizing is container-query based (`cqw`) because the stage sets
// `container-type: inline-size`, under which `cqh` does not resolve.

import React from 'react'
import QRCode from 'react-qr-code'
import { DUR, EASE, cssTransition } from '@/lib/motion'
import { useCountUp } from '@/hooks/useCountUp'

interface JoinRailProps {
  gameCode: string
  /** Responses received for the current slide. */
  responded: number
  /** Participants currently in the room — the denominator. */
  total: number
  /** Resolved text colour for the slide background. */
  textColor: string
  /** Accent used when every participant has responded. */
  accent: string
  /** Hide the progress block on slides that take no audience input. */
  showProgress?: boolean
  onQrClick?: () => void
}

/** `418302` → `418 302`. Grouping makes a 6-digit code readable across a room. */
export function formatGameCode(code: string): string {
  const digits = code.trim()
  if (digits.length !== 6) return digits
  return `${digits.slice(0, 3)} ${digits.slice(3)}`
}

export function joinUrl(gameCode: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin}/join?code=${gameCode}&mode=presenter`
}

export function ResponseProgress({
  responded,
  total,
  textColor,
  accent,
}: {
  responded: number
  total: number
  textColor: string
  accent: string
}) {
  const shown = useCountUp(responded)
  const complete = total > 0 && responded >= total
  const pct = total > 0 ? Math.min(100, (responded / total) * 100) : 0

  return (
    <div data-response-progress style={{ width: '100%', marginTop: 'auto' }}>
      <div
        style={{
          fontSize: 'clamp(8px, 1.25cqw, 17px)',
          fontWeight: 500,
          color: textColor,
          opacity: 0.7,
          marginBottom: '0.7cqw',
        }}
      >
        {complete ? (
          'All responded'
        ) : (
          <>
            <strong style={{ fontWeight: 700, opacity: 1, fontVariantNumeric: 'tabular-nums' }}>
              {shown}
            </strong>{' '}
            of {total} responded
          </>
        )}
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 999,
          background: textColor,
          opacity: 0.12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: complete ? accent : textColor,
            transition: `${cssTransition('width', 'base', 'out')}, ${cssTransition('background-color', 'slow', 'calm')}`,
          }}
        />
      </div>
    </div>
  )
}

export function JoinRail({
  gameCode,
  responded,
  total,
  textColor,
  accent,
  showProgress = true,
  onQrClick,
}: JoinRailProps) {
  return (
    <div
      style={{
        borderLeft: `1px solid ${textColor}1F`,
        paddingLeft: '2.2cqw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '1.1cqw',
        height: '100%',
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={onQrClick}
        title="Click to enlarge"
        style={{
          width: '100%',
          aspectRatio: '1',
          background: '#fff',
          borderRadius: '0.6cqw',
          padding: '0.5cqw',
          border: 'none',
          cursor: onQrClick ? 'pointer' : 'default',
          transition: cssTransition('transform', 'quick', 'out'),
        }}
      >
        <QRCode
          value={joinUrl(gameCode)}
          bgColor="#ffffff"
          fgColor="#0F1B3D"
          level="L"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </button>

      <div
        style={{
          fontSize: 'clamp(8px, 1.25cqw, 17px)',
          fontWeight: 500,
          color: textColor,
          opacity: 0.65,
        }}
      >
        quizotic.live/join
      </div>

      <div
        style={{
          fontSize: 'clamp(16px, 3.4cqw, 52px)',
          fontWeight: 700,
          color: textColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
          lineHeight: 1,
        }}
      >
        {formatGameCode(gameCode)}
      </div>

      {showProgress ? (
        <ResponseProgress
          responded={responded}
          total={total}
          textColor={textColor}
          accent={accent}
        />
      ) : null}
    </div>
  )
}

// Re-exported so callers can match the rail's own timing when they animate
// something alongside it (e.g. the stage fading the rail in on slide change).
export const RAIL_MOTION = { duration: DUR.base, ease: EASE.out }
