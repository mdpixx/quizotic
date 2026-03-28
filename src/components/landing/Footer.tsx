'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ background: '#0D0B1E' }}
      className="border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}
          className="text-xl font-black">
          Quizo<span style={{ color: '#A78BFA' }}>tic</span>
        </div>

        <div className="flex flex-wrap gap-5 justify-center">
          {['Features', 'Pricing', 'For Teams', 'Blog', 'Privacy', 'Terms'].map(item => (
            <Link key={item} href="#"
              className="text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#A78BFA')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
              {item}
            </Link>
          ))}
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          &copy; {new Date().getFullYear()} Quizotic
        </p>
      </div>
    </footer>
  )
}
