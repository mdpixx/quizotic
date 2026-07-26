'use client'

/**
 * QuizPreviewModal — side-by-side "what the room sees / what each phone sees"
 * preview of the quiz being built.
 *
 * Why this exists: until now the only way to see your own content was to launch
 * a real session and join it from a phone. PostHog bears that out — over the
 * last 90 days 16 live sessions (6 hosts) were started on single-question
 * quizzes against only 2 single-question saves, i.e. hosts were burning real
 * sessions purely to look at their slides. Those runs land in the session list,
 * the reports and the billing counters as though they were classes.
 *
 * Deliberately STATIC and LOCAL: no socket, no session row, no DB write, no
 * analytics event. What it is NOT allowed to be is inaccurate — a preview that
 * misrepresents the layout is worse than none, because hosts author against it.
 * So each pane renders the real surface at true device pixels inside a scaled
 * device frame (see preview/DeviceFrame.tsx) rather than a miniature lookalike:
 * the host pane reuses the live stage's own classes, <HostOptionTile> and
 * <HostWordCloud>; the phone pane reproduces the participant screen at 390×844,
 * where answers are a vertical stack of full-width bars.
 *
 * Live scores, the leaderboard and answer reveals are still not simulated — a
 * "Try it" demo run with bot participants is the natural follow-up, not this.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Question } from '@/lib/quiz-types'
import { PhoneShell, ProjectorShell } from './preview/DeviceFrame'
import { HostStagePreview } from './preview/HostStagePreview'
import { ParticipantPreview } from './preview/ParticipantPreview'

const NAVY = '#0F1B3D'

export interface QuizPreviewModalProps {
  questions: Question[]
  /** Question to open on — usually the one the host is editing. */
  initialIndex?: number
  /** Quiz title, shown in the host stage eyebrow like the live session does. */
  title?: string
  onClose: () => void
}

export function QuizPreviewModal({ questions, initialIndex = 0, title, onClose }: QuizPreviewModalProps) {
  const total = questions.length
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, total - 1)))

  const go = useCallback((delta: number) => {
    setIndex(i => Math.min(Math.max(0, i + delta), Math.max(0, total - 1)))
  }, [total])

  // Arrow keys step through questions; Escape closes. Matches the live host
  // stage's keyboard model so the preview trains the right muscle memory.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const question = questions[index]

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: 'rgba(15,27,61,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Quiz preview"
      onClick={onClose}
    >
      <div
        className="m-auto flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white"
        style={{ boxShadow: '0 24px 64px rgba(15,27,61,0.32)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#F1F3F5', background: '#FAFAFA' }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: NAVY }}>Preview</p>
          <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
            Nothing is recorded
          </span>

          <div className="flex-1" />

          {total > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous question"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="px-1 text-xs font-semibold tabular-nums" style={{ color: '#6B7280' }}>{index + 1} / {total}</span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={index >= total - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next question"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        {!question ? (
          <div className="flex flex-1 items-center justify-center p-10 text-center">
            <p className="text-sm" style={{ color: '#6B7280' }}>Add a question to preview it.</p>
          </div>
        ) : (
          /* Second track is `auto` so the phone keeps its own (fixed) width and
             the stage takes the rest — the two frames then stand at roughly the
             same height without either being letterboxed. */
          <div className="grid flex-1 gap-5 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <PreviewPane label="What the room sees" sublabel="Projector / shared screen">
              <ProjectorShell>
                <HostStagePreview questions={questions} index={index} title={title} />
              </ProjectorShell>
            </PreviewPane>
            <PreviewPane label="What each phone sees" sublabel="Participant device">
              <PhoneShell width={244}>
                <ParticipantPreview questions={questions} index={index} />
              </PhoneShell>
            </PreviewPane>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t px-4 py-2.5" style={{ borderColor: '#F1F3F5', background: '#FAFAFA' }}>
          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
            Both panes are the real screens at true size, shown the instant a question opens. Use &larr; &rarr; to step
            through questions. Live counts, scores, the leaderboard and answer reveals are not simulated here.
          </p>
        </div>
      </div>
    </div>
  )
}

function PreviewPane({ label, sublabel, children }: { label: string; sublabel: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex items-baseline gap-2">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: NAVY }}>{label}</p>
        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{sublabel}</p>
      </div>
      {children}
    </div>
  )
}
