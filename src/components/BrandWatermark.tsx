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
    return (
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
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
            gap: 6,
            padding: '3px 10px',
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            opacity: 0.7,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            whiteSpace: 'nowrap',
          }}
        >
          <QuizoticLogo variant="onDark" className="text-xs" />
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
        <span style={{ fontSize: 10, color: '#4B5563', fontWeight: 500, letterSpacing: 0.3 }}>
          quizotic.live
        </span>
      </a>
    </div>
  )
}
