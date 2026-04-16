'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '#methodology', label: 'Methodology' },
    { href: '#slide-types', label: 'Slide Types' },
    { href: '#dashboard', label: 'Dashboard' },
  ]

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#0F1B3D',
        boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.3)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 64 }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 22, color: '#F5E642', letterSpacing: '-0.5px' }}>
              Quizotic
            </span>
            <span style={{ fontWeight: 500, fontSize: 15, color: 'rgba(245,230,66,0.6)', marginLeft: 3 }}>
              .live
            </span>
          </Link>

          {/* Nav links desktop */}
          <div className="nav-links" style={{ display: 'flex', gap: 4, marginLeft: 40, flex: 1 }}>
            {links.map(l => (
              <a key={l.href} href={l.href} className="nav-link"
                style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.75)', textDecoration: 'none', padding: '6px 14px', borderRadius: 20 }}>
                {l.label}
              </a>
            ))}
          </div>

          {/* Right button desktop */}
          <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/auth/signin" className="nav-start"
              style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontSize: 14, fontWeight: 700, color: '#0D0D0D', textDecoration: 'none', padding: '8px 20px', borderRadius: 10, background: '#F5E642', border: '2px solid #0D0D0D', boxShadow: '3px 3px 0 #0D0D0D' }}>
              Start Free →
            </Link>
          </div>

          {/* Hamburger mobile */}
          <button onClick={() => setMenuOpen(v => !v)} className="nav-hamburger" aria-label="Toggle menu"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginLeft: 'auto', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div style={{
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
        background: '#0F1B3D', borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: menuOpen ? '16px 24px 24px' : '0 24px',
        display: 'flex', flexDirection: 'column', gap: 4,
        overflow: 'hidden', maxHeight: menuOpen ? 400 : 0,
        transition: 'max-height 0.3s ease, padding 0.3s ease',
      }}>
        {links.map(l => (
          <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
            style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {l.label}
          </a>
        ))}
        <Link href="/auth/signin" onClick={() => setMenuOpen(false)}
          style={{ marginTop: 8, display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontSize: 16, fontWeight: 700, color: '#0D0D0D', textDecoration: 'none', padding: '12px 24px', borderRadius: 10, background: '#F5E642', border: '2px solid #0D0D0D', boxShadow: '3px 3px 0 #0D0D0D', textAlign: 'center' }}>
          Start Free →
        </Link>
      </div>

      <style>{`
        .nav-link:hover { color: #fff !important; background: rgba(255,255,255,0.08); }
        .nav-start:hover { transform: translate(2px,2px); box-shadow: 1px 1px 0 #0D0D0D !important; }
        .nav-start { transition: transform 0.15s, box-shadow 0.15s; }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-right { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
