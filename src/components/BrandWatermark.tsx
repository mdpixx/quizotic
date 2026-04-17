'use client'

import { QuizoticLogo } from './QuizoticLogo'

interface Props {
  placement: 'host' | 'participant'
}

const HREF = 'https://quizotic.live/?utm_source=brand_watermark'

export function BrandWatermark({ placement }: Props) {
  const isHost = placement === 'host'

  const wrapperStyle: React.CSSProperties = isHost
    ? { position: 'fixed', bottom: 16, right: 16, pointerEvents: 'none', zIndex: 30 }
    : {
        position: 'fixed',
        bottom: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 30,
      }

  const pillStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: isHost ? '6px 10px' : '3px 8px',
    borderRadius: 9999,
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(15,27,61,0.12)',
    textDecoration: 'none',
    opacity: isHost ? 0.65 : 0.55,
    transition: 'opacity 120ms ease',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  }

  return (
    <div style={wrapperStyle} aria-hidden={!isHost}>
      <a
        href={HREF}
        target="_blank"
        rel="noopener noreferrer"
        style={pillStyle}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = '0.95'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = isHost ? '0.65' : '0.55'
        }}
        aria-label="Quizotic"
      >
        <QuizoticLogo
          variant="onLight"
          className={isHost ? 'text-sm' : 'text-xs'}
        />
        {isHost && (
          <span
            style={{
              fontSize: 10,
              color: '#4B5563',
              fontWeight: 500,
              letterSpacing: 0.3,
            }}
          >
            quizotic.live
          </span>
        )}
      </a>
    </div>
  )
}
