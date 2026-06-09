'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface QuizVsSlidesModalProps {
  open: boolean
  onClose: () => void
}

// Side-by-side comparison helper opened from the dashboard.
// Goal: a user who's unsure "Quiz or Slides?" can decide in 10 seconds.
export function QuizVsSlidesModal({ open, onClose }: QuizVsSlidesModalProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quiz vs Slides comparison"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,27,61,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid var(--color-line)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: 'var(--color-line)' }}>
          <div>
            <h2 className="text-[20px] font-black" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>
              Quiz or Slides — which should I use?
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Both go live in minutes. Pick based on what you want the audience to walk away with.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Comparison grid */}
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: 'var(--color-line)' }}>
          {/* Quiz column */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              </span>
              <h3 className="text-base font-black" style={{ color: 'var(--color-ink)' }}>Quiz</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#FEF3C7', color: '#92400E' }}>Scored</span>
            </div>

            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              A structured test. Participants answer timed questions, earn points, and climb a live leaderboard.
            </p>

            <ul className="space-y-1.5 text-[13px] mb-4" style={{ color: 'var(--color-ink)' }}>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Timed questions with correct answers</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Points, leaderboard, podium</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Bloom&apos;s taxonomy tagging</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Explanations shown after reveal</li>
            </ul>

            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Best for</p>
            <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Classroom tests · training checks · competitive rounds
            </p>

            <Link
              href="/host/build"
              onClick={onClose}
              className="btn-primary w-full justify-center"
              style={{ textDecoration: 'none' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              Create a Quiz
            </Link>
          </div>

          {/* Slides column */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold" style={{ background: '#E0F2FE', color: '#0369A1' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </span>
              <h3 className="text-base font-black" style={{ color: 'var(--color-ink)' }}>Slides</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#E0F2FE', color: '#0369A1' }}>Interactive</span>
            </div>

            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              An interactive presentation. Mix content slides with polls, word clouds, and reactions to hear from the room.
            </p>

            <ul className="space-y-1.5 text-[13px] mb-4" style={{ color: 'var(--color-ink)' }}>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Title · bullets · quotes · image · video</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Polls · word clouds · ratings · rankings</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>No scoring — focus is discussion</li>
              <li className="flex gap-2"><span style={{ color: 'var(--color-accent-green)' }}>✓</span>Import from PowerPoint in one click</li>
            </ul>

            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Best for</p>
            <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Workshops · all-hands · meetings · team discussions
            </p>

            <Link
              href="/host/present/create"
              onClick={onClose}
              className="btn-primary-teal w-full justify-center"
              style={{ textDecoration: 'none' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              Create Slides
            </Link>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 text-center text-[11px]" style={{ background: 'var(--color-paper)', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-line)' }}>
          Still not sure? Start a Quiz — you can always import slides into it later.
        </div>
      </div>
    </div>
  )
}
