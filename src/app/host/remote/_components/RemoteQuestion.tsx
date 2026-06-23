'use client'

// RemoteQuestion — the live-question control surface.
//
// Renders a thumb-friendly readout of live answering ({answered}/{connected}
// + per-option distribution bars) and a BIG primary action whose label mirrors
// the projector via getPostQuestionAction:
//   waiting   → "Reveal answer"   (ends the question)
//   reveal    → "Reveal answer"   (still ends, then server marks ended)
//   standings → "View standings"
//   next      → "Next question"
//   end       → "End quiz"
//
// The primary button is gated by a per-action `busy` string set by the parent
// so a phone tap + a projector tap cannot double-advance the session.

import { useMemo, useState } from 'react'
import type { PostQuestionAction } from '@/lib/host-stage'
import { ANSWER_COLORS, ANSWER_LETTERS } from '@/lib/answer-colors'
import { LeaderboardView, type LeaderboardRow } from '@/components/LeaderboardView'

interface TeamLeaderboardEntry {
  name: string
  color: string
  score: number
  members: number
}

interface RemoteQuestionProps {
  phase: 'question'
  questionIndex: number | null
  questionEnded: boolean
  action: PostQuestionAction
  answerCount: number
  connectedCount: number
  optionCounts: number[]
  explanation: string | null
  paused: boolean
  socketConnected: boolean
  busy: string | null
  onReveal: () => void
  onNext: () => void
  onStandings: () => void
  onEndSession: () => void
  onPauseToggle: () => void
  soundMuted: boolean
  onToggleSound: () => void
  onToggleMusic: () => void
  musicOn: boolean
  onToggleMirror: () => void
  mirrorOn: boolean
  standingsRows: LeaderboardRow[]
  teamLeaderboard: TeamLeaderboardEntry[] | null
  standingsRecommended: boolean
}

export function RemoteQuestion(props: RemoteQuestionProps) {
  const {
    questionIndex,
    questionEnded,
    action,
    answerCount,
    connectedCount,
    optionCounts,
    explanation,
    paused,
    socketConnected,
    busy,
    onReveal,
    onNext,
    onStandings,
    onEndSession,
    onPauseToggle,
    soundMuted,
    onToggleSound,
    onToggleMusic,
    musicOn,
    onToggleMirror,
    mirrorOn,
    standingsRows,
    standingsRecommended,
  } = props

  const [moreOpen, setMoreOpen] = useState(false)
  const [standingsOpen, setStandingsOpen] = useState(false)

  const total = connectedCount
  const pct = total > 0 ? Math.min(100, Math.round((answerCount / total) * 100)) : 0

  const primary = useMemo<{ label: string; onClick: () => void; busyKey: string | null; tone: 'gold' | 'navy' | 'danger' }>(() => {
    switch (action) {
      case 'standings':
        return { label: 'View standings', onClick: onStandings, busyKey: 'standings', tone: 'navy' }
      case 'next':
        return { label: 'Next question', onClick: onNext, busyKey: 'next', tone: 'gold' }
      case 'end':
        return { label: 'End quiz', onClick: onEndSession, busyKey: 'end', tone: 'danger' }
      case 'reveal':
      case 'waiting':
      default:
        return { label: questionEnded ? 'Reveal answer' : 'Reveal answer', onClick: onReveal, busyKey: 'reveal', tone: 'gold' }
    }
  }, [action, questionEnded, onStandings, onNext, onEndSession, onReveal])

  const primaryBusy = primary.busyKey !== null && busy === primary.busyKey
  const anyBusy = busy !== null

  return (
    <div
      className="min-h-svh flex flex-col px-5"
      style={{
        background: 'var(--color-paper)',
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-xl font-black tabular-nums"
            style={{ color: 'var(--color-primary)' }}
          >
            Q{(questionIndex ?? 0) + 1}
          </span>
          <span
            className="text-[11px] font-black uppercase tracking-[0.14em] px-2 py-1 rounded-full"
            style={{
              background: paused ? 'var(--color-attention)' : 'var(--color-paper-2)',
              color: paused ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {paused ? 'Paused' : questionEnded ? 'Live' : 'Live'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IconToggle active={!soundMuted} onClick={onToggleSound} label="Sound">
            <SpeakerIcon muted={soundMuted} />
          </IconToggle>
          <IconToggle active={moreOpen} onClick={() => setMoreOpen(v => !v)} label="More">
            <DotsIcon />
          </IconToggle>
        </div>
      </header>

      {!socketConnected && (
        <div
          className="mt-2 rounded-xl px-4 py-2 text-sm font-bold text-center"
          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--color-danger)' }}
        >
          Reconnecting…
        </div>
      )}

      {moreOpen && (
        <div
          className="mt-2 rounded-2xl p-2 space-y-1"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)' }}
        >
          <MoreRow label="Music" active={musicOn} onClick={() => { onToggleMusic() }} />
          <MoreRow label="Mirror to phones" active={mirrorOn} onClick={onToggleMirror} />
          <button
            onClick={() => { setStandingsOpen(true); setMoreOpen(false) }}
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold"
            style={{ color: 'var(--color-primary)' }}
          >
            Peek standings
          </button>
          <button
            onClick={() => { setMoreOpen(false); onEndSession() }}
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold"
            style={{ color: 'var(--color-danger)' }}
          >
            End session
          </button>
        </div>
      )}

      {/* ── Live readout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center py-6">
        <div
          className="rounded-3xl p-6 text-center"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)' }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-[0.2em] mb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Answered
          </p>
          <p
            className="font-display font-black tabular-nums leading-none"
            style={{ fontSize: 'clamp(40px, 14vw, 64px)', color: 'var(--color-primary)' }}
          >
            {answerCount}
            <span style={{ color: 'var(--color-text-muted)' }}>/{total}</span>
          </p>
          {/* progress bar */}
          <div
            className="mt-4 h-3 rounded-full overflow-hidden"
            style={{ background: 'var(--color-paper-2)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'var(--color-yellow)' }}
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {total === 0
              ? 'Waiting for players…'
              : `${pct}% of connected players`}
          </p>
        </div>

        {/* per-option distribution */}
        {optionCounts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p
              className="text-[11px] font-black uppercase tracking-[0.16em] px-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Distribution
            </p>
            {optionCounts.map((count, i) => {
              const max = Math.max(1, ...optionCounts)
              const width = Math.round((count / max) * 100)
              const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
              const sharePct =
                answerCount > 0 ? Math.round((count / answerCount) * 100) : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: color.hex }}
                  >
                    {ANSWER_LETTERS[i % ANSWER_LETTERS.length]}
                  </span>
                  <div
                    className="flex-1 h-7 rounded-lg overflow-hidden flex items-center"
                    style={{ background: 'var(--color-paper-2)' }}
                  >
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{ width: `${width}%`, background: color.hex, minWidth: count > 0 ? 8 : 0 }}
                    />
                  </div>
                  <span
                    className="w-12 text-right text-sm font-black tabular-nums"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {count}
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {' '}{sharePct}%
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* explanation, once revealed */}
        {questionEnded && explanation && (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid var(--color-success)', color: 'var(--color-primary)' }}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--color-success)' }}>
              Explanation
            </p>
            <p>{explanation}</p>
          </div>
        )}

        {standingsRecommended && action !== 'standings' && (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm font-bold text-center"
            style={{ background: 'var(--color-paper-2)', color: 'var(--color-primary)' }}
          >
            Big rank changes — show the standings.
          </div>
        )}
      </div>

      {/* ── Secondary thumb row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <SecondaryButton onClick={onPauseToggle} label={paused ? 'Resume' : 'Pause'}>
          <PauseIcon paused={paused} />
        </SecondaryButton>
        <SecondaryButton onClick={() => setStandingsOpen(true)} label="Standings">
          <TrophyIcon />
        </SecondaryButton>
        <SecondaryButton onClick={onToggleSound} label={soundMuted ? 'Unmute' : 'Mute'}>
          <SpeakerIcon muted={soundMuted} />
        </SecondaryButton>
      </div>

      {/* ── Sticky primary action ──────────────────────────────────────── */}
      <button
        onClick={primary.onClick}
        disabled={primaryBusy || (anyBusy && primary.busyKey !== busy)}
        className="w-full rounded-2xl py-5 text-xl font-black font-display transition-all disabled:opacity-40"
        style={primaryStyle(primary.tone)}
      >
        {primaryBusy ? 'Working…' : primary.label}
      </button>

      {/* ── Standings peek sheet ───────────────────────────────────────── */}
      {standingsOpen && (
        <Sheet title="Standings" onClose={() => setStandingsOpen(false)}>
          {standingsRows.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No standings yet — they appear after a scored question ends.
            </p>
          ) : (
            <LeaderboardView rows={standingsRows} variant="compact" topN={8} />
          )}
        </Sheet>
      )}
    </div>
  )
}

function primaryStyle(tone: 'gold' | 'navy' | 'danger'): React.CSSProperties {
  if (tone === 'navy') {
    return {
      background: 'var(--color-primary)',
      color: 'var(--color-yellow)',
      border: '2px solid var(--color-primary)',
      boxShadow: '0 6px 0 var(--color-primary-dark)',
    }
  }
  if (tone === 'danger') {
    return {
      background: 'var(--color-danger)',
      color: '#fff',
      border: '2px solid var(--color-danger)',
      boxShadow: '0 6px 0 #991B1B',
    }
  }
  return {
    background: 'var(--color-yellow)',
    color: 'var(--color-primary)',
    border: '2px solid var(--color-primary)',
    boxShadow: '0 6px 0 var(--color-primary)',
  }
}

// ── Shared subcomponents (kept local; no new deps) ───────────────────────────

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="h-11 w-11 rounded-full flex items-center justify-center transition-all"
      style={{
        background: active ? 'var(--color-yellow)' : 'var(--color-bg)',
        border: `1px solid ${active ? 'var(--color-yellow-dark)' : 'var(--color-line)'}`,
        color: 'var(--color-primary)',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 transition-all"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-primary)',
        minHeight: 64,
      }}
    >
      {children}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  )
}

function MoreRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-xl px-4 py-3"
      style={{ color: 'var(--color-primary)' }}
    >
      <span className="text-sm font-bold">{label}</span>
      <span
        className="text-xs font-black px-2 py-1 rounded-full"
        style={{
          background: active ? 'var(--color-success)' : 'var(--color-paper-2)',
          color: active ? '#fff' : 'var(--color-text-muted)',
        }}
      >
        {active ? 'On' : 'Off'}
      </span>
    </button>
  )
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(15,27,61,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
        style={{
          background: 'var(--color-paper)',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="font-display text-lg font-black"
            style={{ color: 'var(--color-primary)' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-paper-2)', color: 'var(--color-primary)' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {muted ? <line x1="22" y1="9" x2="16" y2="15" /> : <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />}
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function PauseIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
      <path d="M17 5h3v2a4 4 0 01-4 4M7 5H4v2a4 4 0 004 4" />
    </svg>
  )
}
