'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/Avatar'
import { QuizoticLogo } from '@/components/QuizoticLogo'

// Lucide-style SVG icons — consistent 1.8 stroke, no emoji inside product
const ICON = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <rect x="3" y="3" width="7" height="7" rx="1.2"/>
      <rect x="14" y="3" width="7" height="7" rx="1.2"/>
      <rect x="14" y="14" width="7" height="7" rx="1.2"/>
      <rect x="3" y="14" width="7" height="7" rx="1.2"/>
    </svg>
  ),
  quizzes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M9 11H5a2 2 0 0 0-2 2v7h14v-7a2 2 0 0 0-2-2h-4"/>
      <path d="M9 11V6a3 3 0 0 1 6 0v5"/>
    </svg>
  ),
  scheduled: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6.5"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <circle cx="18" cy="18" r="4"/>
      <path d="M18 16.5V18l1 1"/>
    </svg>
  ),
  presentations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <path d="M22 4 12 14.01l-3-3"/>
    </svg>
  ),
  participants: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M3 3v18h18"/>
      <path d="M7 12l4-4 4 4 5-5"/>
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
    </svg>
  ),
  join: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  quickstart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
}

interface NavItem {
  label: string
  href: string
  icon: ReactNode
  exact?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/host', icon: ICON.dashboard, exact: true },
  { label: 'My Quizzes', href: '/host/quizzes', icon: ICON.quizzes },
  { label: 'Scheduled', href: '/host/scheduled', icon: ICON.scheduled },
  { label: 'Presentations', href: '/host/presentations', icon: ICON.presentations },
  { label: 'Sessions', href: '/host/sessions', icon: ICON.sessions },
  { label: 'Participants', href: '/host/participants', icon: ICON.participants },
  { label: 'Reports', href: '/host/reports', icon: ICON.reports },
]

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all"
      style={{
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
      }}
    >
      {/* Yellow vertical indicator bar (mockup signature) */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm"
          style={{ background: '#F5E642' }}
        />
      )}
      <span style={{ color: active ? '#F5E642' : 'rgba(255,255,255,0.6)', display: 'inline-flex' }}>
        {item.icon}
      </span>
      <span>{item.label}</span>
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
          <QuizoticLogo variant="onDark" className="text-lg" markSize={32} />
        </Link>
      </div>

      {/* Create buttons — quiz builder and presentation */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
        <Link
          href="/host/build"
          onClick={onNavClick}
          className="btn-primary w-full justify-center"
          style={{ padding: '8px 10px', fontSize: '12px', textDecoration: 'none' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3 h-3"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Create quiz
        </Link>
        <Link
          href="/host/present/create"
          onClick={onNavClick}
          className="btn-primary-teal w-full justify-center"
          style={{ padding: '8px 10px', fontSize: '12px', textDecoration: 'none' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3 h-3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
          Presentation
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
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Tools
          </p>
          <a
            href="/welcome.html"
            target="_blank"
            rel="noopener"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all hover:bg-white/[0.04]"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-flex' }}>{ICON.quickstart}</span>
            <span>Quick Start</span>
          </a>
          <Link
            href="/host/billing"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all hover:bg-white/[0.04]"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-flex' }}>{ICON.plan}</span>
            <span>Plan</span>
          </Link>
          <Link
            href="/join"
            onClick={onNavClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all hover:bg-white/[0.04]"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-flex' }}>{ICON.join}</span>
            <span>Join a Game</span>
          </Link>
          {isAdmin && (
            <Link
              href="/host/admin"
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all mt-1"
              style={{ color: '#F5E642', background: 'rgba(245,230,66,0.1)' }}
            >
              <span style={{ color: '#F5E642', display: 'inline-flex' }}>{ICON.admin}</span>
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
