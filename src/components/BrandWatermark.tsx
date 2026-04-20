'use client'

import { QuizoticLogo } from './QuizoticLogo'

interface Props {
  placement: 'host' | 'participant'
}

const HREF = 'https://quizotic.live/?utm_source=brand_watermark'

export function BrandWatermark({ placement }: Props) {
  const isHost = placement === 'host'

  // Participant: non-clickable mark pinned to the top so accidental taps
  // don't leave the session. Host: interactive pill at bottom-right (unchanged).
  if (!isHost) {
    // Pinned to the bottom-center on the participant screen so it never
    // overlaps the "Quiz Over!" heading or active question text. Brand-yellow
    // pill with dark navy text — white was unreadable on yellow.
    return (
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        <div
          style={{
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px 12px',
            borderRadius: 9999,
            background: '#F5E642',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 0.3,
            color: '#0F1B3D',
            lineHeight: 1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}
        >
          Quizotic
        </div>
      </div>
    )
  }

  const wrapperStyle: React.CSSProperties = { position: 'fixed', bottom: 16, right: 16, pointerEvents: 'none', zIndex: 30 }
  const pillStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 9999,
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(15,27,61,0.12)',
    textDecoration: 'none',
    opacity: 0.65,
    transition: 'opacity 120ms ease',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  }

  return (
    <div style={wrapperStyle}>
      <a
        href={HREF}
        target="_blank"
        rel="noopener noreferrer"
        style={pillStyle}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.95' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.65' }}
        aria-label="Quizotic"
      >
        <QuizoticLogo variant="onLight" className="text-sm" />
      </a>
    </div>
  )
}
