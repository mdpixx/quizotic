'use client'

// RemoteStandings — between-questions standings screen.
//
// Reuses the shared LeaderboardView (compact variant) so the phone shows the
// same rank tiles as the projector sidebar, then a BIG "Next question" primary.
// If the server decides this was the last question it will emit session_ended
// and the parent flips the view to RemoteEnded automatically.

import { LeaderboardView, type LeaderboardRow } from '@/components/LeaderboardView'

interface TeamLeaderboardEntry {
  name: string
  color: string
  score: number
  members: number
}

interface RemoteStandingsProps {
  rows: LeaderboardRow[]
  teamLeaderboard: TeamLeaderboardEntry[] | null
  standingsRecommended: boolean
  busy: boolean
  onNext: () => void
  soundMuted: boolean
  onToggleSound: () => void
}

export function RemoteStandings({
  rows,
  teamLeaderboard,
  busy,
  onNext,
  soundMuted,
  onToggleSound,
}: RemoteStandingsProps) {
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
          Live standings
        </span>
        <button
          onClick={onToggleSound}
          aria-label={soundMuted ? 'Unmute' : 'Mute'}
          aria-pressed={!soundMuted}
          className="h-11 w-11 rounded-full flex items-center justify-center"
          style={{
            background: soundMuted ? 'var(--color-bg)' : 'var(--color-yellow)',
            border: `1px solid ${soundMuted ? 'var(--color-line)' : 'var(--color-yellow-dark)'}`,
            color: 'var(--color-primary)',
          }}
        >
          <SpeakerIcon muted={soundMuted} />
        </button>
      </header>

      {teamLeaderboard && teamLeaderboard.length > 0 && (
        <div
          className="mt-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-paper-2)' }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-[0.14em] mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Teams
          </p>
          <div className="space-y-1.5">
            {teamLeaderboard.map(t => (
              <div key={t.name} className="flex items-center justify-between">
                <span
                  className="text-xs font-black px-2.5 py-1 rounded-full text-white"
                  style={{ background: t.color }}
                >
                  {t.name}
                </span>
                <span
                  className="font-display font-black tabular-nums"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4">
        {rows.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            Standings will appear here after a scored question.
          </p>
        ) : (
          <LeaderboardView rows={rows} variant="compact" topN={8} />
        )}
      </div>

      <button
        onClick={onNext}
        disabled={busy}
        className="w-full rounded-2xl py-5 text-xl font-black font-display transition-all disabled:opacity-40"
        style={{
          background: 'var(--color-yellow)',
          color: 'var(--color-primary)',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 6px 0 var(--color-primary)',
        }}
      >
        {busy ? 'Loading…' : 'Next question'}
      </button>
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
