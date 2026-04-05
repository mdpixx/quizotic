'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ background: '#1B2559' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo + tagline */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black text-white" style={{ background: 'var(--brand-gradient)' }}>Q</div>
              <span className="text-lg font-black tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                Quizo<span style={{ color: '#6B8AFF' }}>tic</span>
              </span>
            </Link>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Live quizzes & interactive presentations for everyone.
            </p>
            <a href="mailto:info@quizotic.live" className="text-sm mt-1 inline-block transition-colors hover:text-white" style={{ color: '#94A3B8' }}>
              info@quizotic.live
            </a>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              { label: 'Host Dashboard', href: '/host' },
              { label: 'Join a Quiz', href: '/join' },
              { label: 'Templates', href: '/host/templates' },
              { label: 'Presentations', href: '/host/present/create' },
            ].map(link => (
              <Link key={link.label} href={link.href}
                className="text-sm font-medium transition-colors hover:text-white"
                style={{ color: '#94A3B8' }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
          <p className="text-xs" style={{ color: '#64748B' }}>
            &copy; {new Date().getFullYear()} Quizotic. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: '#64748B' }}>
            quizotic.live
          </p>
        </div>
      </div>
    </footer>
  )
}
