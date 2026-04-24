'use client'

// Sticky glass-style header shown on every post-session screen so the host
// always has an obvious way back to /host without scrolling past the report.
// Shared between quiz sessions and presentation sessions.

interface PostSessionHeaderProps {
  title?: string
  subtitle?: string
  onBack: () => void
  dimmed?: boolean
}

export function PostSessionHeader({ title, subtitle, onBack, dimmed = false }: PostSessionHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.62))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(15,27,61,0.08)',
        opacity: dimmed ? 0 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'opacity 220ms ease-out',
      }}
    >
      <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
          style={{ background: '#0F1B3D', color: '#fff' }}
          aria-label="Back to Library"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Library
        </button>
        {title && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black truncate" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
              {title}
            </p>
            {subtitle && (
              <p className="text-[11px] truncate" style={{ color: '#6B7280' }}>{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
