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
      <circle
        cx="31"
        cy="29"
        r="15"
        fill="none"
        stroke="#0F1B3D"
        strokeWidth="9"
      />
      <path
        d="M39 38 49 48"
        fill="none"
        stroke="#0F1B3D"
        strokeWidth="9"
        strokeLinecap="round"
      />
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
  showMark = true,
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
