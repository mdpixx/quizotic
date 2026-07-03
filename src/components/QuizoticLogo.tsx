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
}

export function QuizoticLogo({
  variant = 'onDark',
  className = '',
  markSize = 32,
  showMark = false, // wordmark-only by default; the Q mark read as "Q Quizotic"
}: Props) {
  const isLight = variant === 'onLight'
  return (
    <span
      className={`inline-flex items-center font-black tracking-tight ${className}`}
      style={{
        color: isLight ? '#0F1B3D' : '#FFFFFF',
        fontFamily: 'var(--font-heading)',
        gap: showMark ? Math.max(6, Math.round(markSize * 0.25)) : 0,
      }}
      aria-label="Quizotic"
    >
      {showMark && <QuizoticMark size={markSize} decorative />}
      <span aria-hidden="true">Quizotic</span>
    </span>
  )
}
