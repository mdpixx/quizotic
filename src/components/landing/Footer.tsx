'use client'

import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#methodology', label: 'Methodology' },
  { href: '#slide-types', label: 'Slide Types' },
  { href: '#dashboard', label: 'Dashboard' },
  { href: '/auth/signin', label: 'Sign In' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function Footer() {
  return (
    <footer style={{ background: '#0F1B3D', borderTop: '2px solid #F5E642', padding: '48px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* Wordmark */}
        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 24, color: '#F5E642' }}>
          Quizotic
          <span style={{ fontWeight: 500, fontSize: 16, color: 'rgba(245,230,66,0.6)', marginLeft: 2 }}>.live</span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          {FOOTER_LINKS.map(l => (
            l.href.startsWith('#')
              ? <a key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = '#F5E642'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.65)'}>{l.label}</a>
              : <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </div>

        {/* Science line */}
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 600, lineHeight: 1.6 }}>
          Built on Bloom&apos;s Taxonomy, Confidence Grid &amp; Spaced Retrieval — peer-reviewed learning science.
        </p>

        {/* Copyright */}
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          © 2025 Quizotic · quizotic.live
        </p>
      </div>
    </footer>
  )
}
