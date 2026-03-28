'use client'

import Link from 'next/link'

export function StickyNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg"
      style={{ background: 'rgba(250,250,254,0.92)', borderBottom: '1px solid #E9E2FF' }}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 md:px-12 h-16">
        <Link href="/" className="flex items-center gap-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>★</span>
          </div>
          <span className="text-2xl font-black tracking-tight">
            Quizo<span style={{ color: '#7C3AED' }}>tic</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link href="#how-it-works" className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            How it works
          </Link>
          <Link href="/host/templates" className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            Templates
          </Link>
          <Link href="/host"
            className="ml-3 text-sm font-bold px-5 py-2 rounded-full transition-all hover:opacity-90 hover:scale-[1.03]"
            style={{
              fontFamily: 'var(--font-heading)',
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              color: '#fff',
            }}>
            host a quiz ✦
          </Link>
        </div>
      </div>
    </nav>
  )
}
