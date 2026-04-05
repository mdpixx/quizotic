'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Avatar } from './Avatar'

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
    <nav className="sticky top-0 z-50 border-b" style={{
      background: 'rgba(255,251,245,0.92)',
      backdropFilter: 'blur(16px) saturate(1.4)',
      borderColor: 'rgba(67,97,238,0.08)',
    }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-14">
        {/* Logo → dashboard */}
        <Link href="/host" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white font-black text-xs"
            style={{ background: 'var(--brand-gradient)' }}
          >
            Q
          </div>
          <span className="text-lg font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Quizo<span style={{ color: '#4361EE' }}>tic</span><span className="text-[10px] font-bold tracking-wide ml-0.5" style={{ color: '#9CA3AF', verticalAlign: 'super' }}>.live</span>
          </span>
        </Link>

        {/* Center nav links — desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/host" className="text-sm font-semibold transition-colors hover:text-[#4361EE]" style={{ color: '#4A5568' }}>
            Dashboard
          </Link>
          <Link href="/host/billing" className="text-sm font-semibold transition-colors hover:text-[#4361EE]" style={{ color: '#4A5568' }}>
            Pricing
          </Link>
          <Link href="/join" className="text-sm font-semibold transition-colors hover:text-[#4361EE]" style={{ color: '#4A5568' }}>
            Join Quiz
          </Link>
        </div>

        {/* Right side — user greeting + avatar */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Greeting — desktop only */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: '#4A5568' }}>Hi,</span>
              <span className="text-sm font-bold" style={{ color: '#1B2559' }}>{firstName}</span>
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
                className="flex items-center gap-1.5 rounded-full p-0.5 transition-all hover:ring-2 hover:ring-blue-200"
                style={{ background: '#F0F4FF' }}
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
                  style={{ background: '#fff', borderColor: '#E2E8F0' }}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <p className="text-sm font-bold truncate" style={{ color: '#1B2559' }}>{user.name}</p>
                    <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{user.email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link href="/host" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-50"
                      style={{ color: '#4A5568' }}>
                      Dashboard
                    </Link>
                    <Link href="/host/billing" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-50"
                      style={{ color: '#4A5568' }}>
                      Pricing
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t py-1" style={{ borderColor: '#F1F5F9' }}>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition-colors hover:bg-red-50"
                      style={{ color: '#EF4444' }}
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
