type Variant = 'onLight' | 'onDark'

interface MarkProps {
  size?: number
  className?: string
  decorative?: boolean
  label?: string
}

export function QuizoticMark({
  size = 32,
  className = '',
  decorative = false,
  label = 'Quizotic',
}: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="15" fill="#FBD13B" />
      <rect
        x="14"
        y="14"
        width="36"
        height="36"
        rx="9"
        fill="#0F1B3D"
        transform="rotate(45 32 32)"
      />
      <circle cx="32" cy="32" r="10" fill="#FBD13B" />
      <path
        d="M38 38 49 49"
        fill="none"
        stroke="#FBD13B"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="3.8" fill="#0F1B3D" />
    </svg>
  )
}

interface Props {
  variant?: Variant
  className?: string
  markSize?: number
  showMark?: boolean
  /** Playful per-letter bounce (Baloo 2, each letter rotated, coral accent on
   * "z"). Used on the participant join screen. Renders the same "Quizotic"
   * wordmark with aria-label, just with a bouncy branding treatment. */
  playful?: boolean
  /** Native system typography for compact, high-legibility product surfaces. */
  crisp?: boolean
}

const QUIZOTIC = 'Quizotic'

export function QuizoticLogo({
  variant = 'onDark',
  className = '',
  markSize = 32,
  showMark = false, // wordmark-only by default; the Qmark read as "Q Quizotic"
  playful = false,
  crisp = false,
}: Props) {
  const isLight = variant === 'onLight'
  return (
    <span
      className={`inline-flex items-center font-black tracking-tight ${className}`}
      style={{
        color: isLight ? '#0F1B3D' : '#FFFFFF',
        fontFamily: crisp
          ? '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif'
          : playful ? 'var(--font-baloo), var(--font-heading)' : 'var(--font-heading)',
        gap: showMark ? Math.max(6, Math.round(markSize * 0.25)) : 0,
      }}
      aria-label="Quizotic"
    >
      {showMark && <QuizoticMark size={markSize} decorative />}
      {playful ? (
        // Bouncy branding variant: each letter is its own span, rotated slightly
        // alternating direction, with a coral accent on "z" (4th letter). The
        // outer span carries the aria-label so screen readers hear "Quizotic".
        <span aria-hidden="true" className="inline-flex items-baseline" style={{ letterSpacing: '-0.01em' }}>
          {QUIZOTIC.split('').map((ch, i) => (
            <span key={i} style={{
              display: 'inline-block',
              transformOrigin: '50% 80%',
              transform:
                i === 0 ? 'rotate(-4deg)'
                : i === 3 ? 'rotate(3deg)' // the "z" — also gets the accent color below
                : i % 2 === 1 ? 'rotate(2deg)'
                : 'rotate(-2deg)',
              color: i === 3 ? '#E07A5F' : undefined,
            }}>
              {ch}
            </span>
          ))}
        </span>
      ) : (
        <span aria-hidden="true">{QUIZOTIC}</span>
      )}
    </span>
  )
}
