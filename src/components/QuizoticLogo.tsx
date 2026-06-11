type Variant = 'onLight' | 'onDark'

interface Props {
  variant?: Variant
  className?: string
  showDomain?: boolean
}

export function QuizoticLogo({ variant = 'onDark', className = '', showDomain = false }: Props) {
  const isLight = variant === 'onLight'
  const quizoColor = isLight ? '#0F1B3D' : '#FFFFFF'
  const ticColor = isLight ? '#0F1B3D' : '#F5E642'
  const accentUnderline = isLight ? '#F5E642' : 'transparent'
  const dotLiveColor = isLight ? '#6B7280' : 'rgba(255,255,255,0.55)'
  return (
    <span
      className={`inline-flex items-baseline font-black tracking-tight ${className}`}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      <span style={{ color: quizoColor }}>Quizo</span>
      <span
        style={{
          color: ticColor,
          borderBottom: `3px solid ${accentUnderline}`,
          paddingBottom: '2px',
        }}
      >
        tic
      </span>
      {showDomain && (
        <span style={{ color: dotLiveColor, fontWeight: 700 }}>.live</span>
      )}
    </span>
  )
}
