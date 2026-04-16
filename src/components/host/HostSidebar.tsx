'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/Avatar'

interface NavItem {
  label: string
  href: string
  icon: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/host', icon: '📊', exact: true },
  { label: 'Sessions', href: '/host/sessions', icon: '⚡' },
  { label: 'My Quizzes', href: '/host/quizzes', icon: '🧠' },
  { label: 'Presentations', href: '/host/presentations', icon: '📽' },
  { label: 'Participants', href: '/host/participants', icon: '👥' },
]

const SLIDES_GRADIENT = 'linear-gradient(135deg, #0EA5E9, #06B6D4)'

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group"
      style={{
        background: active ? 'rgba(245,230,66,0.15)' : 'transparent',
        color: active ? '#F5E642' : 'rgba(255,255,255,0.6)',
      }}
    >
      <span className="text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
      {active && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#F5E642' }} />
      )}
    </Link>
  )
}

interface HostSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { data: session } = useSession()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const user = session?.user
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => setIsAdmin(!!d.isAdmin))
      .catch(() => {})
  }, [session?.user])

  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Link href="/host" className="flex items-center gap-2.5 group" onClick={onNavClick}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: '#F5E642', color: '#0D0D0D' }}
          >
            Q
          </div>
          <span
            className="text-lg font-black tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}
          >
            Quizo<span style={{ color: '#F5E642' }}>tic</span>
            <span
              className="text-[9px] font-bold tracking-wide ml-0.5 animate-pulse"
              style={{ color: '#22C55E', verticalAlign: 'super' }}
            >
              .live
            </span>
          </span>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <Link
          href="/host/create"
          onClick={onNavClick}
          className="flex-1 text-center text-xs font-bold py-2 rounded-xl transition-all hover:scale-[1.02]"
          style={{ background: '#F5E642', color: '#0D0D0D' }}
        >
          + Quiz
        </Link>
        <Link
          href="/host/present/create"
          onClick={onNavClick}
          className="flex-1 text-center text-xs font-bold py-2 rounded-xl transition-all hover:scale-[1.02]"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          + Slides
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-1 pb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Main
        </p>
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavClick} />
        ))}

        <div className="pt-3 mt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Tools
          </p>
          <Link
            href="/host/billing"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <span className="text-base leading-none">💳</span>
            <span>Plan</span>
          </Link>
          <Link
            href="/join"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <span className="text-base leading-none">🎮</span>
            <span>Join a Game</span>
          </Link>
          {isAdmin && (
            <Link
              href="/host/admin"
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
              style={{ color: '#F5E642', background: 'rgba(245,230,66,0.1)' }}
            >
              <span className="text-base leading-none">🛡️</span>
              <span>Admin Panel</span>
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#F5E642', color: '#0D0D0D' }}>
                ADMIN
              </span>
            </Link>
          )}
        </div>
      </nav>

      {/* User profile */}
      {user && (
        <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-8 h-8 rounded-full flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Avatar archetype={user.name ?? user.email ?? 'user'} size={32} />
              )}
              <div className="flex-1 min-w-0 text-left">
                <p
                  className="text-sm font-bold truncate"
                  style={{ color: '#fff' }}
                >
                  {firstName}
                </p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {user.email}
                </p>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {userMenuOpen ? '▲' : '▼'}
              </span>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-xl shadow-lg border overflow-hidden"
                  style={{ background: '#fff', borderColor: '#E2E8F0' }}
                >
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <p className="text-xs font-bold truncate" style={{ color: '#0F1B3D' }}>
                      {user.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-red-50"
                    style={{ color: '#EF4444' }}
                  >
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </>
  )
}

export function HostSidebar({ mobileOpen, onMobileClose }: HostSidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside
        className="hidden md:flex w-60 flex-shrink-0 flex-col border-r"
        style={{
          background: '#0F1B3D',
          borderColor: 'rgba(255,255,255,0.08)',
          height: '100vh',
          position: 'sticky',
          top: 0,
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay — only when mobileOpen is true */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
            />
            {/* Sidebar panel */}
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:hidden"
              style={{ background: '#0F1B3D' }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Close button */}
              <button
                onClick={onMobileClose}
                className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <SidebarContent onNavClick={onMobileClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
