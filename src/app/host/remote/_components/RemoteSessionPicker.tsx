'use client'

// RemoteSessionPicker — the phone-remote entry screen (account-based, no PIN).
//
// The phone is already signed into the host's account (the socket carries the
// auth cookie). On mount the parent calls host.listMySessions(); we render the
// live sessions owned by THIS account so the host taps one to take control.
// Identity is the gate — a participant signed into a different account (or not
// signed in) sees nothing here and the server rejects host_join_remote. There
// is no PIN to type and none is shown on the projector.

import type { ReactNode } from 'react'
import type { MySessionSummary } from '@/lib/hooks/useHostSocket'

interface RemoteSessionPickerProps {
  /** null = not fetched yet; [] = fetched, none live. */
  sessions: MySessionSummary[] | null
  loading: boolean
  connected: boolean
  error: string | null
  onPick: (gameCode: string) => void
  onRefresh: () => void
  logo: ReactNode
}

const PHASE_LABEL: Record<MySessionSummary['phase'], string> = {
  lobby: 'In lobby',
  active: 'Live now',
  ended: 'Ended',
}

export function RemoteSessionPicker({
  sessions,
  loading,
  connected,
  error,
  onPick,
  onRefresh,
  logo,
}: RemoteSessionPickerProps) {
  const hasSessions = !!sessions && sessions.length > 0

  return (
    <div
      className="min-h-svh flex flex-col px-5"
      style={{
        background: 'var(--color-paper)',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header className="flex items-center justify-between pt-2">
        {logo}
        <span
          className="text-[11px] font-black uppercase tracking-[0.14em]"
          style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}
        >
          {connected ? '● Online' : '○ Connecting'}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="text-center mb-7">
          <h1 className="font-display text-3xl font-black leading-tight" style={{ color: 'var(--color-primary)' }}>
            Use as remote
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Pick the live session to drive from this phone. You&rsquo;re signed in as the host — no code needed.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-6">
            <p className="font-display text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Finding your live session…
            </p>
          </div>
        )}

        {/* Session list */}
        {!loading && hasSessions && (
          <ul className="space-y-3">
            {sessions!.map(s => (
              <li key={s.gameCode}>
                <button
                  onClick={() => onPick(s.gameCode)}
                  className="w-full rounded-2xl px-5 py-4 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99]"
                  style={{
                    background: 'var(--color-bg)',
                    border: '2px solid var(--color-primary)',
                    boxShadow: '0 4px 0 var(--color-primary)',
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-black truncate" style={{ color: 'var(--color-primary)' }}>
                      {s.title}
                    </span>
                    <span className="block text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {PHASE_LABEL[s.phase]} · {s.playerCount} player{s.playerCount === 1 ? '' : 's'} · {s.gameCode}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-sm font-black" style={{ color: 'var(--color-yellow-dark)' }}>
                    Control →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {!loading && sessions !== null && !hasSessions && (
          <div
            className="rounded-2xl px-5 py-6 text-center"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)' }}
          >
            <p className="font-display text-base font-black" style={{ color: 'var(--color-primary)' }}>
              No live session yet
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Start hosting a quiz from your computer, then refresh here.
            </p>
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-sm font-bold"
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && (
          <button
            onClick={onRefresh}
            className="mt-5 w-full rounded-2xl py-3.5 text-base font-black font-display transition-all"
            style={{
              background: hasSessions ? 'transparent' : 'var(--color-yellow)',
              color: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
              boxShadow: hasSessions ? 'none' : '0 4px 0 var(--color-primary)',
            }}
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  )
}
