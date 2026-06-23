'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Avatar } from './Avatar'
import { QuizoticLogo } from './QuizoticLogo'

export function HostNav() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const user = session?.user
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <nav className="sticky top-0 z-50 border-b safe-top" style={{
      background: 'rgba(15,27,61,0.95)',
      backdropFilter: 'blur(16px) saturate(1.4)',
      borderColor: 'rgba(255,255,255,0.08)',
    }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-14">
        {/* Logo → dashboard */}
        <Link href="/host" className="flex items-center gap-2 group font-display" aria-label="Quizotic home">
          <QuizoticLogo variant="onDark" className="text-lg" markSize={28} />
        </Link>

        {/* Center nav links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/host"
            aria-label="Dashboard"
            className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/[0.06]"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Dashboard
          </Link>
          <Link
            href="/host/billing"
            aria-label="Plan"
            className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/[0.06]"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Plan
          </Link>
          <Link
            href="/join"
            aria-label="Join quiz"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
            style={{ color: 'var(--color-yellow)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-yellow)' }} aria-hidden />
            Join Quiz
          </Link>
        </div>

        {/* Right side — user greeting + avatar */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Greeting — desktop only */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Hi,</span>
              <span className="text-[13px] font-bold font-display" style={{ color: '#fff' }}>{firstName}</span>
              <motion.span
                className="text-base"
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                style={{ display: 'inline-block', originX: 0.7, originY: 0.7 }}
              >
                👋
              </motion.span>
            </div>

            {/* Avatar + dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 rounded-full p-0.5 transition-all hover:ring-2 focus:outline-none focus-visible:ring-2"
                style={{ background: 'rgba(255,255,255,0.1)', '--tw-ring-color': 'rgba(251,209,59,0.45)' } as React.CSSProperties}
              >
                {user.image ? (
                  <img src={user.image} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <Avatar archetype={user.name ?? user.email ?? 'user'} size={32} />
                )}
              </button>

              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg border overflow-hidden"
                  style={{ background: 'var(--color-paper)', borderColor: 'var(--color-line)' }}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-line)' }}>
                    <p className="text-sm font-bold font-display truncate" style={{ color: 'var(--color-ink)' }}>{user.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user.email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link href="/host" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-paper-2)]"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      Dashboard
                    </Link>
                    <Link href="/host/billing" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-paper-2)]"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      Plan
                    </Link>
                    <Link href="/join" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-paper-2)]"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      Join Quiz
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t py-1" style={{ borderColor: 'var(--color-line)' }}>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-4 py-2 text-sm font-semibold transition-colors hover:bg-red-50"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
