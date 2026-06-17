'use client'

import React from 'react'

type Direction = 'back' | 'forward'
type Variant = 'pill' | 'circle'
type Tone = 'light' | 'dark'

interface NavButtonProps {
  direction: Direction
  /** `pill` shows an arrow + label (use where width allows); `circle` is a compact 44px round icon button. */
  variant?: Variant
  /** Pill label. Defaults to "Back" / "Next". Ignored for `circle`. */
  label?: string
  /** `dark` for use on dark/coloured backgrounds (presentation, lobby). */
  tone?: Tone
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
  className?: string
  ariaLabel?: string
}

const BRAND_NAVY = '#0F1B3D'

// Chevron paths sized for a 20×20 viewBox.
const CHEVRON: Record<Direction, string> = {
  back: 'M13 16l-6-6 6-6',
  forward: 'M7 4l6 6-6 6',
}

/** Standalone chevron icon — reuse on action buttons that need a crisp arrow
 * (e.g. "Next Question →") instead of a bare `→` text glyph. */
export function NavChevron({ direction, className = 'w-4 h-4' }: { direction: Direction; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d={CHEVRON[direction]}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Chevron({ direction, className }: { direction: Direction; className: string }) {
  return <NavChevron direction={direction} className={className} />
}

/**
 * Canonical back/forward navigation button. Replaces ad-hoc character-arrow
 * buttons (`←`, `›`) across host builder, live controls, presentation and
 * self-paced participant flows so navigation looks consistent on web + mobile.
 */
export function NavButton({
  direction,
  variant = 'pill',
  label,
  tone = 'light',
  onClick,
  disabled = false,
  type = 'button',
  title,
  className = '',
  ariaLabel,
}: NavButtonProps) {
  const text = label ?? (direction === 'back' ? 'Back' : 'Next')
  const isDark = tone === 'dark'
  const fg = isDark ? '#FFFFFF' : BRAND_NAVY
  const border = isDark ? 'rgba(255,255,255,0.45)' : '#D1D5DB'

  const baseStyle: React.CSSProperties = {
    color: fg,
    border: `1.5px solid ${border}`,
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }

  if (variant === 'circle') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title ?? text}
        aria-label={ariaLabel ?? text}
        className={`inline-flex items-center justify-center rounded-full transition-all hover:scale-[1.04] active:scale-95 ${className}`}
        style={{ ...baseStyle, width: 44, height: 44 }}
      >
        <Chevron direction={direction} className="w-5 h-5" />
      </button>
    )
  }

  // pill
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? text}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 ${className}`}
      style={{ ...baseStyle, minHeight: 44, padding: '0 18px' }}
    >
      {direction === 'back' && <Chevron direction="back" className="w-4 h-4" />}
      <span>{text}</span>
      {direction === 'forward' && <Chevron direction="forward" className="w-4 h-4" />}
    </button>
  )
}
