'use client'

// RemoteLobby — pre-start lobby view.
//
// Shows the game code + connected player count (authoritative, from
// session_state.connectedCount) and a BIG thumb-reachable "Start quiz" button.
// Mirrors the projector lobby affordances: sound + music toggles live in the
// header row; "End session" sits behind a More menu so it is never tapped by
// accident.

import { useState } from 'react'

interface RemoteLobbyProps {
  gameCode: string
  connectedCount: number
  socketConnected: boolean
  busy: boolean
  onStart: () => void
  soundMuted: boolean
  onToggleSound: () => void
  onToggleMusic: () => void
  musicOn: boolean
  onEndSession: () => void
}

export function RemoteLobby({
  gameCode,
  connectedCount,
  socketConnected,
  busy,
  onStart,
  soundMuted,
  onToggleSound,
  onToggleMusic,
  musicOn,
  onEndSession,
}: RemoteLobbyProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const canStart = socketConnected && connectedCount > 0

  return (
    <div
      className="min-h-svh flex flex-col px-5"
      style={{
        background: 'var(--color-paper)',
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header className="flex items-center justify-between">
        <span
          className="text-[11px] font-black uppercase tracking-[0.16em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Lobby
        </span>
        <div className="flex items-center gap-2">
          <IconToggle active={!soundMuted} onClick={onToggleSound} label="Sound">
            <SpeakerIcon muted={soundMuted} />
          </IconToggle>
          <IconToggle active={musicOn} onClick={onToggleMusic} label="Music">
            <MusicIcon />
          </IconToggle>
          <IconToggle active={moreOpen} onClick={() => setMoreOpen(v => !v)} label="More">
            <DotsIcon />
          </IconToggle>
        </div>
      </header>

      {moreOpen && (
        <div
          className="mt-2 rounded-2xl p-2"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)' }}
        >
          <button
            onClick={() => { setMoreOpen(false); onEndSession() }}
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold"
            style={{ color: 'var(--color-danger)' }}
          >
            End session
          </button>
        </div>
      )}

      {!socketConnected && (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-sm font-bold text-center"
          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--color-danger)' }}
        >
          Reconnecting…
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center py-8">
        <div
          className="rounded-3xl p-7 text-center"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)' }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-[0.24em] mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Game code
          </p>
          <p
            className="font-display font-black leading-none select-all"
            style={{
              fontSize: 'clamp(44px, 14vw, 72px)',
              letterSpacing: '0.06em',
              color: 'var(--color-primary)',
            }}
          >
            {gameCode || '——'}
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Players join at quizotic.live/join
          </p>
        </div>

        <div
          className="mt-4 rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: 'var(--color-paper-2)' }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Players connected
          </span>
          <span
            className="font-display text-3xl font-black tabular-nums"
            style={{ color: 'var(--color-primary)' }}
          >
            {connectedCount}
          </span>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {connectedCount === 0
            ? 'Waiting for players to join…'
            : `Ready when you are — ${connectedCount} player${connectedCount === 1 ? '' : 's'} in.`}
        </p>
      </div>

      <button
        onClick={onStart}
        disabled={!canStart || busy}
        className="w-full rounded-2xl py-5 text-xl font-black font-display transition-all disabled:opacity-40"
        style={{
          background: 'var(--color-yellow)',
          color: 'var(--color-primary)',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 6px 0 var(--color-primary)',
        }}
      >
        {busy ? 'Starting…' : !socketConnected
          ? 'Reconnecting…'
          : connectedCount === 0
            ? 'Waiting for players…'
            : `▶ Start quiz (${connectedCount})`}
      </button>
    </div>
  )
}

// ── Small shared icon toggles ────────────────────────────────────────────────

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

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {muted ? <line x1="22" y1="9" x2="16" y2="15" /> : <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />}
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
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
