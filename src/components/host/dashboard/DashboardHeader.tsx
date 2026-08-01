'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useFeedback } from '@/components/FeedbackProvider'

import styles from './DashboardCommandCenter.module.css'

const Icon = {
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" strokeLinecap="round"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 5 11 7-11 7V5Z" strokeLinejoin="round"/></svg>,
  feature: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M9 18h6M10 22h4M8.2 14.8A7 7 0 1 1 15.8 14.8c-.9.7-1.3 1.4-1.3 2.2h-5c0-.8-.4-1.5-1.3-2.2Z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  quiz: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h5M8 16h7" strokeLinecap="round"/></svg>,
  presentation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 4h16v12H4zM9 20l3-4 3 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

export const CREATE_MENU_ITEMS = [
  { label: 'Quiz', description: 'Build a scored activity', href: '/host/build', icon: 'quiz' },
  { label: 'Presentation', description: 'Teach with interactive slides', href: '/host/present/create', icon: 'presentation' },
] as const

export function DashboardHeader({ scheduleCount }: { scheduleCount: number }) {
  const { openFeedback } = useFeedback()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const scheduleLabel = scheduleCount > 0
    ? `Scheduled sessions, ${scheduleCount} active`
    : 'Scheduled sessions'

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarIdentity}>
        <strong>Teaching command center</strong>
        <span>Decide what deserves your attention next</span>
      </div>
      <div className={styles.topbarActions}>
        <form className={styles.search} role="search" action="/host/sessions">
          {Icon.search}
          <label className={styles.srOnly} htmlFor="dashboard-search">Search your work</label>
          <input id="dashboard-search" name="query" placeholder="Search quizzes and sessions…" autoComplete="off" />
        </form>
        <button
          className={`${styles.button} ${styles.featureButton}`}
          type="button"
          aria-label="Request a feature"
          title="Request a feature"
          onClick={() => openFeedback('dashboard-feature-request', 'feature')}
        >
          {Icon.feature}
          <span className={styles.featureButtonLabel}>Request feature</span>
        </button>
        <Link className={styles.iconButton} href="/host/scheduled" aria-label={scheduleLabel} title="Scheduled sessions">
          {Icon.calendar}
          {scheduleCount > 0 && <span className={styles.scheduleBadge} aria-hidden>{scheduleCount > 9 ? '9+' : scheduleCount}</span>}
        </Link>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            ref={buttonRef}
            className={styles.button}
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen(open => !open)}
          >
            Create {Icon.chevron}
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              {CREATE_MENU_ITEMS.map(item => (
                <Link key={item.href} href={item.href} role="menuitem" onClick={() => setMenuOpen(false)}>
                  <span className={styles.menuIcon}>{Icon[item.icon]}</span>
                  <span className={styles.menuCopy}><strong>{item.label}</strong><span>{item.description}</span></span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link className={`${styles.button} ${styles.primaryButton}`} href="/host/quizzes">
          {Icon.play} Start a session
        </Link>
      </div>
    </header>
  )
}
