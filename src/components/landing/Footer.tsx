'use client'

import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '#methodology', label: 'Methodology' },
  { href: '/auth/signin', label: 'Sign In' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

const COMPARE_LINKS = [
  { href: '/vs/slido', label: 'vs Slido' },
  { href: '/vs/mentimeter', label: 'vs Mentimeter' },
  { href: '/vs/kahoot', label: 'vs Kahoot' },
  { href: '/vs/quizizz', label: 'vs Quizizz' },
  { href: '/vs/ahaslides', label: 'vs AhaSlides' },
]

const RESOURCE_LINKS = [
  { href: '/learn', label: 'Learn' },
  { href: '/templates', label: 'Templates' },
  { href: '/alternatives/slido', label: 'Slido alternatives' },
  { href: '/alternatives/kahoot', label: 'Kahoot alternatives' },
  { href: '/alternatives/mentimeter', label: 'Mentimeter alternatives' },
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

        {/* Compare row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Compare
          </span>
          {COMPARE_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Resources row */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Resources
          </span>
          {RESOURCE_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
              {l.label}
            </Link>
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
