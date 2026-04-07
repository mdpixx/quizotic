'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'Product', href: '#showcase' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
  ]

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(255,251,245,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px) saturate(1.4)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(67,97,238,0.08)' : '1px solid transparent',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
            style={{ background: 'var(--brand-gradient)' }}
          >
            Q
          </div>
          <span
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}
          >
            Quizo<span style={{ color: '#4361EE' }}>tic</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-semibold transition-colors hover:text-[#4361EE]"
              style={{ color: '#4A5568' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/join"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:bg-blue-50"
            style={{ color: '#4361EE', border: '1.5px solid #4361EE' }}
          >
            Join with Code
          </Link>
          <Link
            href="/host"
            className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{ background: 'var(--brand-gradient)', fontFamily: 'var(--font-heading)' }}
          >
            Host Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5"
          aria-label="Toggle menu"
        >
          <span className={`w-5 h-0.5 bg-gray-700 transition-transform ${mobileOpen ? 'rotate-45 translate-y-1' : ''}`} />
          <span className={`w-5 h-0.5 bg-gray-700 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-gray-700 transition-transform ${mobileOpen ? '-rotate-45 -translate-y-1' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden"
            style={{ background: 'rgba(255,251,245,0.98)', backdropFilter: 'blur(16px)' }}
          >
            <div className="px-6 py-4 space-y-3 border-t" style={{ borderColor: 'rgba(67,97,238,0.08)' }}>
              {navLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-base font-semibold py-2"
                  style={{ color: '#1B2559' }}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex gap-3 pt-2">
                <Link href="/join" className="flex-1 text-center text-sm font-bold py-2.5 rounded-xl"
                  style={{ color: '#4361EE', border: '1.5px solid #4361EE' }}>
                  Join
                </Link>
                <Link href="/host" className="flex-1 text-center text-sm font-bold py-2.5 rounded-xl text-white"
                  style={{ background: 'var(--brand-gradient)' }}>
                  Host Free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
