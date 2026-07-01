'use client'

// RemoteEnded — post-session final standings.
//
// Reuses the shared LeaderboardView (compact) to show the final podium list,
// plus "Start new" (back to pairing) and "End session" actions. The session is
// already over server-side; "End session" here is a safe no-op confirmation
// affordance in case the host wants to force-close from the phone.

import { LeaderboardView, type LeaderboardRow } from '@/components/LeaderboardView'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { useFeedback } from '@/components/FeedbackProvider'

interface TeamLeaderboardEntry {
  name: string
  color: string
  score: number
  members: number
}

interface RemoteEndedProps {
  rows: LeaderboardRow[]
  teamLeaderboard: TeamLeaderboardEntry[] | null
  busy: boolean
  onEndSession: () => void
}

export function RemoteEnded({
  rows,
  teamLeaderboard,
  busy,
  onEndSession,
}: RemoteEndedProps) {
  const { openFeedback } = useFeedback()
  const winner = rows[0]
  return (
    <div
      className="min-h-svh flex flex-col px-5"
      style={{
        background: 'var(--color-paper)',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header>
        <QuizoticLogo variant="onLight" className="text-lg" markSize={26} />
      </header>

      <div className="text-center mt-4">
        <p
          className="text-[11px] font-black uppercase tracking-[0.2em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Session complete
        </p>
        <h1
          className="font-display text-3xl font-black mt-1"
          style={{ color: 'var(--color-primary)' }}
        >
          {winner ? `Winner: ${winner.name}` : 'All done'}
        </h1>
        {winner && (
          <p className="font-display text-lg font-black mt-1" style={{ color: 'var(--color-yellow-dark)' }}>
            {winner.score.toLocaleString()} pts
          </p>
        )}
      </div>

      {teamLeaderboard && teamLeaderboard.length > 0 && (
        <div
          className="mt-4 rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-paper-2)' }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-[0.14em] mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Final team scores
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
            No scores were recorded for this session.
          </p>
        ) : (
          <LeaderboardView rows={rows} variant="compact" topN={10} heading="Final leaderboard" />
        )}
      </div>

      <button
        type="button"
        onClick={() => openFeedback('post-session')}
        className="mb-3 w-full rounded-2xl py-3 text-sm font-black font-display transition-all"
        style={{
          background: 'var(--color-paper-2)',
          color: 'var(--color-primary)',
          border: '2px dashed var(--color-line)',
        }}
      >
        How did that go? Tell us
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { if (typeof window !== 'undefined') window.location.assign('/host') }}
          className="rounded-2xl py-4 text-base font-black font-display transition-all"
          style={{
            background: 'var(--color-yellow)',
            color: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            boxShadow: '0 4px 0 var(--color-primary)',
          }}
        >
          Start new
        </button>
        <button
          onClick={onEndSession}
          disabled={busy}
          className="rounded-2xl py-4 text-base font-black font-display transition-all disabled:opacity-40"
          style={{
            background: 'var(--color-bg)',
            color: 'var(--color-danger)',
            border: '2px solid var(--color-line)',
          }}
        >
          {busy ? 'Closing…' : 'End session'}
        </button>
      </div>
    </div>
  )
}
