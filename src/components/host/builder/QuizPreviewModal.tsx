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
 * analytics event. It renders the same answer palette and layout language as
 * the live host stage and the participant phone so the preview is honest,
 * without paying the cost of simulating a session. A "Try it" demo run with bot
 * participants is the natural follow-up, not this.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Question } from '@/lib/quiz-types'
import { getOptionText, isScoredQuestion } from '@/lib/quiz-types'
import { ANSWER_COLORS, colorForIndex, tileStyle } from '@/lib/answer-colors'
import { formatTimer, getTypePill } from '@/lib/quiz-builder-logic'

const NAVY = '#0F1B3D'
const GOLD = '#FBD13B'

export interface QuizPreviewModalProps {
  questions: Question[]
  /** Question to open on — usually the one the host is editing. */
  initialIndex?: number
  onClose: () => void
}

export function QuizPreviewModal({ questions, initialIndex = 0, onClose }: QuizPreviewModalProps) {
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
        className="m-auto w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl bg-white overflow-hidden"
        style={{ boxShadow: '0 24px 64px rgba(15,27,61,0.32)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: '#F1F3F5', background: '#FAFAFA' }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: NAVY }}>Preview</p>
          <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
            Nothing is recorded
          </span>

          <div className="flex-1" />

          {total > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous question"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-xs font-semibold tabular-nums px-1" style={{ color: '#6B7280' }}>{index + 1} / {total}</span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={index >= total - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next question"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        {!question ? (
          <div className="flex-1 flex items-center justify-center p-10 text-center">
            <p className="text-sm" style={{ color: '#6B7280' }}>Add a question to preview it.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid gap-4 p-4 md:grid-cols-[1.6fr_1fr]">
            <PreviewPane label="What the room sees" sublabel="Projector / shared screen">
              <HostStagePreview question={question} index={index} total={total} />
            </PreviewPane>
            <PreviewPane label="What each phone sees" sublabel="Participant device">
              <PhoneFrame>
                <ParticipantPreview question={question} index={index} total={total} />
              </PhoneFrame>
            </PreviewPane>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 py-2.5 border-t" style={{ borderColor: '#F1F3F5', background: '#FAFAFA' }}>
          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
            Use &larr; &rarr; to step through questions. Live scores, the leaderboard and answer reveals are not simulated here.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function PreviewPane({ label, sublabel, children }: { label: string; sublabel: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex flex-col">
      <div className="flex items-baseline gap-2 mb-1.5">
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: NAVY }}>{label}</p>
        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{sublabel}</p>
      </div>
      {children}
    </div>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 280 }}>
      <div
        className="rounded-[28px] p-2 overflow-hidden"
        style={{ background: NAVY, boxShadow: '0 12px 32px rgba(15,27,61,0.22)' }}
      >
        <div className="rounded-[22px] overflow-hidden" style={{ background: '#F7F8FB', minHeight: 380 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Countdown pill. Renders the no-timer state explicitly rather than showing 0s. */
function TimerPill({ seconds, dark }: { seconds: number; dark?: boolean }) {
  if (seconds <= 0) {
    return (
      <span
        className="text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
        style={dark
          ? { background: 'rgba(255,255,255,0.12)', color: '#C7D2FE' }
          : { background: '#F3F4F6', color: '#475569', border: '1px solid #E2E8F0' }}
      >
        No timer
      </span>
    )
  }
  return (
    <span
      className="text-sm font-black px-2.5 py-1 rounded-md tabular-nums whitespace-nowrap"
      style={dark ? { background: GOLD, color: NAVY } : { background: NAVY, color: GOLD }}
    >
      {formatTimer(seconds)}
    </span>
  )
}

// ── Host stage ────────────────────────────────────────────────────────────────

function HostStagePreview({ question, index, total }: { question: Question; index: number; total: number }) {
  const pill = getTypePill(question.type)
  const options = question.options ?? []
  const scored = isScoredQuestion(question)

  return (
    <div className="rounded-2xl p-5 h-full flex flex-col" style={{ background: NAVY, minHeight: 380 }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8FA0C8' }}>
          Q{index + 1} / {total}
        </span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.1)', color: '#C7D2FE' }}>
          {pill.label}
        </span>
        <div className="flex-1" />
        {scored && (
          <span className="text-[11px] font-bold" style={{ color: '#8FA0C8' }}>{question.points} pts</span>
        )}
        <TimerPill seconds={question.timerSeconds} dark />
      </div>

      {question.type === 'case' && question.scenarioText && (
        <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #2D3A8C' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: GOLD }}>Scenario</p>
          <p className="text-sm leading-relaxed" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
          {question.supportingDetail && (
            <p className="mt-1.5 text-sm font-bold" style={{ color: GOLD }}>{question.supportingDetail}</p>
          )}
        </div>
      )}

      <p className="text-xl sm:text-2xl font-bold leading-snug mb-4 break-words" style={{ color: '#FFFFFF' }}>
        {question.text || <span style={{ color: '#64748B' }}>Untitled question</span>}
      </p>

      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.imageUrl} alt="" className="w-full rounded-xl mb-4 object-cover" style={{ maxHeight: 150 }} />
      )}

      <div className="flex-1" />

      {options.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt, i) => {
            const c = colorForIndex(i)
            return (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-w-0" style={tileStyle(c)}>
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-black"
                  style={{ background: 'rgba(255,255,255,0.9)', color: c.hexDark }}
                >
                  {ANSWER_COLORS[i % ANSWER_COLORS.length]!.letter}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {getOptionText(opt) || <span style={{ opacity: 0.7 }}>Empty option</span>}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl px-3 py-4 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-semibold" style={{ color: '#C7D2FE' }}>Responses appear here live</p>
        </div>
      )}
    </div>
  )
}

// ── Participant phone ─────────────────────────────────────────────────────────

function ParticipantPreview({ question, index, total }: { question: Question; index: number; total: number }) {
  const options = question.options ?? []
  const scored = isScoredQuestion(question)

  return (
    <div className="p-3 flex flex-col gap-2.5" style={{ minHeight: 380 }}>
      {/* Slim top bar — mirrors MobileTopBar */}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: NAVY }} />
        <span className="text-[10px] font-bold truncate" style={{ color: '#6B7280' }}>You</span>
        <div className="flex-1" />
        <TimerPill seconds={question.timerSeconds} />
      </div>

      {question.timerSeconds > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,27,61,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: '72%', background: NAVY }} />
        </div>
      )}

      {question.type === 'case' && question.scenarioText && (
        <div className="rounded-xl p-2.5" style={{ background: NAVY }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: GOLD }}>Scenario</p>
          <p className="text-[11px] leading-relaxed line-clamp-4" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
        </div>
      )}

      {/* Question card */}
      <div className="bg-white rounded-xl border border-t-4 p-3" style={{ borderColor: '#E5E7EB', borderTopColor: GOLD }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>Q{index + 1} / {total}</span>
          {scored ? (
            <span className="text-[11px] font-black" style={{ color: NAVY }}>{question.points} pts</span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#475569' }}>Participation</span>
          )}
        </div>
        <p className="text-[13px] font-medium leading-snug break-words" style={{ color: NAVY }}>
          {question.text || <span style={{ color: '#9CA3AF' }}>Untitled question</span>}
        </p>
      </div>

      {/* Answer tiles */}
      {options.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, i) => {
            const c = colorForIndex(i)
            return (
              <div key={i} className="rounded-xl px-2 py-3 flex flex-col items-center gap-1 min-w-0" style={tileStyle(c)}>
                <span className="text-[11px] font-black text-white">{ANSWER_COLORS[i % ANSWER_COLORS.length]!.letter}</span>
                <span className="text-[10px] font-bold text-white text-center leading-tight line-clamp-2 w-full px-0.5">
                  {getOptionText(opt)}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-3 py-6 text-center" style={{ borderColor: '#D1D5DB' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Type your answer</p>
        </div>
      )}
    </div>
  )
}
