'use client'

// Drop-in <img> replacement that renders a visible placeholder when the image
// fails to load — typically because the CDN host is blocked by a corporate
// firewall or DNS filter. Without this, PPTX-imported slides that use an
// unreachable host silently render as empty boxes, and users have no idea why.
//
// Use wherever user-uploaded or PPTX-rendered imagery is shown to either host
// or participant.

import { useState } from 'react'

interface SlideImageProps {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  loading?: 'lazy' | 'eager'
  fallbackText?: string
  tone?: 'light' | 'dark'
}

export function SlideImage({
  src,
  alt = '',
  className,
  style,
  loading,
  fallbackText,
  tone = 'light',
}: SlideImageProps) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    const bg = tone === 'dark' ? 'rgba(15,27,61,0.65)' : '#F1F5F9'
    const border = tone === 'dark' ? 'rgba(255,255,255,0.18)' : '#E2E8F0'
    const titleColor = tone === 'dark' ? '#FEE2E2' : '#B91C1C'
    const bodyColor = tone === 'dark' ? '#E2E8F0' : '#475569'
    return (
      <div
        className={className}
        style={{
          ...style,
          background: bg,
          border: `1px dashed ${border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          padding: '0.75rem',
          textAlign: 'center',
          minHeight: 80,
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden style={{ color: titleColor, opacity: 0.8 }}>
          <path
            d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 0v14h14V5H5Zm2.5 10.5 2.5-3 2 2.5 3-4.5 4 5H7.5Z"
            fill="currentColor"
          />
          <path d="M3 3l18 18" stroke={titleColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p style={{ color: titleColor, fontSize: 11, fontWeight: 700, margin: 0 }}>Image blocked</p>
        {fallbackText && (
          <p
            style={{
              color: bodyColor,
              fontSize: 11,
              lineHeight: 1.3,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {fallbackText}
          </p>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        console.error('[IMAGE_LOAD_FAIL]', src)
        setErrored(true)
      }}
    />
  )
}
