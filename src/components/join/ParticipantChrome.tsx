'use client'

// Participant desktop/tablet chrome — the persistent HUD rails that frame the
// live-quiz stage on large screens (>=1024px). On phone (<768px) the existing
// single-column `.participant-topbar` (preserved verbatim as `<MobileTopBar>`)
// carries identity/score/timer; these rails are `hidden lg:flex` so the mobile
// experience is byte-for-byte unchanged.
//
// Layout (mirrors the host "Atrium" pattern in src/app/host/session/page.tsx):
//
//   ┌──────────────┬─────────────────────────┬──────────────┐
//   │  PlayerHUD   │      center stage       │   StageRail  │
//   │  (left)      │  (question/answer...)   │   (right)    │
//   └──────────────┴─────────────────────────┴──────────────┘
//
// The wrapper grid lives in src/app/join/page.tsx (`.participant-stage-grid`);
// these are purely presentational children. `CircularTimer` is imported
// statically here (it is already statically importable from the barrel) — the
// join page's own lazy copy is unaffected.

import { Avatar } from '@/components/Avatar'
import { CircularTimer } from '@/components/CircularTimer'

// ─── Shared types ────────────────────────────────────────────────────────
// Mirrors the local `LeaderboardEntry` interface in src/app/join/page.tsx.
// Kept as a structural type (not imported) so this file has no circular
// dependency back into the page.
export interface HUDLeaderboardEntry {
  name: string
  archetype: string
  score: number
  previousRank?: number | null
  rankDelta?: number
  scoreDelta?: number
}

export interface TeamInfo {
  index: number
  name: string
  color: string
}

type ConnectionState = 'connected' | 'reconnecting'

// ─── PlayerHUD (left rail) ───────────────────────────────────────────────
// Identity + score + streak + a mini top-5 leaderboard with the player's own
// row highlighted. The leaderboard is the one genuinely new piece of UX vs
// mobile (mobile never shows a leaderboard mid-question). It populates lazily:
// empty while the player hasn't locked in an answer (so it can't distract or
// spoil relative position during answering — see plan's "option c").
export function PlayerHUD({
  archetype,
  displayName,
  team,
  totalScore,
  streak,
  rank,
  rankDelta,
  leaderboard,
  lockedIn,
  className = '',
}: {
  archetype: string | null
  displayName: string
  team: TeamInfo | null
  totalScore: number
  streak: number
  rank: number | null
  rankDelta: number | null
  leaderboard: HUDLeaderboardEntry[]
  // Suppress the mini-leaderboard until the player has locked in an answer so
  // it can't pull attention away from the question or reveal relative position.
  lockedIn: boolean
  className?: string
}) {
  const top = leaderboard.slice(0, 5)
  // If the player is outside the top 5, splice their row in as the last entry
  // so they always see themselves.
  const selfInTop = top.some(e => e.name === displayName)
  const rows = selfInTop ? top : (top.length ? [...top] : []).concat(
    leaderboard.find(e => e.name === displayName) ? [leaderboard.find(e => e.name === displayName)!] : []
  ).slice(0, 6)

  return (
    <aside className={`participant-hud hidden lg:flex flex-col gap-4 p-5 ${className}`}>
      {/* Identity */}
      <div className="flex items-center gap-3">
        {archetype && <Avatar archetype={archetype} size={48} />}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#9CA3AF' }}>You</p>
          <p className="font-display font-black text-lg truncate" style={{ color: '#0F1B3D' }}>{archetype ?? '—'}</p>
        </div>
      </div>

      {/* Score + streak + team */}
      <div className="flex flex-wrap items-center gap-2">
        {totalScore > 0 && (
          <span className="font-display inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black"
            style={{ background: '#0F1B3D', color: '#FBD13B' }}>
            {totalScore.toLocaleString()}
          </span>
        )}
        {streak >= 2 && (
          <span className="font-display inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black"
            style={{
              background: streak >= 5 ? 'linear-gradient(135deg,#FBD13B,#FF8A47)' : 'rgba(251,209,59,0.14)',
              color: streak >= 5 ? '#0D0D0D' : '#B45309',
            }}>
            🔥{streak}
          </span>
        )}
        {team && (
          <span className="text-white text-[11px] rounded-full px-2.5 py-1 font-bold"
            style={{ background: team.color }}>{team.name}</span>
        )}
      </div>

      {/* Rank */}
      {rank !== null && (
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-black tabular-nums" style={{ color: '#0F1B3D' }}>
            #{rank}
          </span>
          {typeof rankDelta === 'number' && rankDelta !== 0 && (
            <span className="font-display text-xs font-black px-2 py-0.5 rounded-full"
              style={{
                color: rankDelta > 0 ? '#14532D' : '#7F1D1D',
                background: rankDelta > 0 ? '#BBF7D0' : '#FECACA',
              }}>
              {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
            </span>
          )}
        </div>
      )}

      {/* Mini leaderboard — only once the player has locked in an answer */}
      {lockedIn && rows.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#6B7280' }}>
            Standings
          </p>
          <ol className="space-y-1">
            {rows.map((e, i) => {
              const isSelf = e.name === displayName
              return (
                <li key={`${e.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: isSelf ? '#FFF8DB' : 'transparent',
                    border: isSelf ? '1px solid #FBD13B' : '1px solid transparent',
                  }}>
                  <span className="font-display w-5 text-center text-xs font-black tabular-nums"
                    style={{ color: isSelf ? '#0F1B3D' : '#9CA3AF' }}>{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold"
                    style={{ color: isSelf ? '#0F1B3D' : '#33405f' }}>{isSelf ? 'You' : e.name}</span>
                  <span className="font-display text-xs font-black tabular-nums" style={{ color: '#0F1B3D' }}>
                    {e.score.toLocaleString()}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </aside>
  )
}

// ─── StageRail (right rail) ──────────────────────────────────────────────
// Timer (larger than mobile), points badge, question tag, sound toggle, and a
// connection pill. Children let the caller slot in phase-specific extras (e.g.
// the streak badge + ResultBeat on the `answered` phase).
export function StageRail({
  timeLeft,
  total,
  points,
  questionNumber,
  questionTotal,
  isScored,
  soundMuted,
  onToggleSound,
  connectionState,
  children,
  className = '',
}: {
  timeLeft: number
  total: number
  points: number
  questionNumber: number
  questionTotal: number
  isScored: boolean
  soundMuted: boolean
  onToggleSound: () => void
  connectionState: ConnectionState
  children?: React.ReactNode
  className?: string
}) {
  return (
    <aside className={`participant-rail hidden lg:flex flex-col gap-4 p-5 ${className}`}>
      {/* Timer — bigger than the 80px mobile circle */}
      <div className="flex flex-col items-center">
        <CircularTimer timeLeft={timeLeft} total={total} size={128} />
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold mt-2" style={{ color: '#9CA3AF' }}>
          {timeLeft === 1 ? '1 second' : `${timeLeft} seconds`}
        </p>
      </div>

      {/* Progress */}
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#9CA3AF' }}>Question</p>
        <p className="font-display text-2xl font-black tabular-nums" style={{ color: '#0F1B3D' }}>
          {questionNumber}<span className="text-gray-400"> / {questionTotal}</span>
        </p>
      </div>

      {/* Points / participation */}
      {isScored ? (
        <div className="rounded-xl px-3 py-2 text-center" style={{ background: '#0F1B3D' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgba(251,209,59,0.7)' }}>Worth</p>
          <p className="font-display text-xl font-black" style={{ color: '#FBD13B' }}>{points.toLocaleString()}</p>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2 text-center" style={{ background: '#F3F4F6', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-bold" style={{ color: '#475569' }}>Participation</p>
        </div>
      )}

      {/* Sound + connection */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2">
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={soundMuted}
          title={soundMuted ? 'Sounds are muted' : 'Mute sounds'}
          className="w-10 h-10 rounded-full flex items-center justify-center text-base transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#FBD13B]"
          style={{ border: '1.5px solid #E5E7EB' }}
        >
          {soundMuted ? '🔇' : '🔊'}
        </button>
        {connectionState === 'reconnecting' && (
          <span className="text-[11px] font-bold text-red-500 animate-pulse">Reconnecting…</span>
        )}
      </div>

      {children}
    </aside>
  )
}

// ─── MobileTopBar ────────────────────────────────────────────────────────
// The existing `.participant-topbar` markup, lifted verbatim so mobile renders
// identically. Shown only on `< lg`; the desktop rails replace it. Lives here
// so the page stops duplicating the identity/score/streak/timer row — the same
// data drives both the mobile bar and the desktop HUD.
export function MobileTopBar({
  archetype,
  team,
  totalScore,
  streak,
  soundMuted,
  onToggleSound,
  timeLeft,
  total,
  className = '',
}: {
  archetype: string | null
  team: TeamInfo | null
  totalScore: number
  streak: number
  soundMuted: boolean
  onToggleSound: () => void
  timeLeft: number
  total: number
  className?: string
}) {
  return (
    <div className={`participant-topbar lg:hidden flex items-center justify-between gap-2 mb-3 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {archetype && <Avatar archetype={archetype} size={36} />}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-600 text-sm font-semibold truncate max-w-[7rem]">{archetype}</span>
          {team && (
            <span className="text-white text-[11px] rounded-full px-2 py-0.5 font-bold flex-shrink-0" style={{ background: team.color }}>{team.name}</span>
          )}
          {totalScore > 0 && (
            <span className="font-display inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black flex-shrink-0"
              style={{ background: '#0F1B3D', color: '#FBD13B' }}>
              {totalScore.toLocaleString()}
            </span>
          )}
          {streak >= 2 && (
            <span className="font-display inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black flex-shrink-0"
              style={{
                background: streak >= 5 ? 'linear-gradient(135deg,#FBD13B,#FF8A47)' : 'rgba(251,209,59,0.14)',
                color: streak >= 5 ? '#0D0D0D' : '#B45309',
              }}>
              🔥{streak}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={soundMuted}
          title={soundMuted ? 'Sounds are muted' : 'Mute sounds'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#FBD13B]"
          style={{ border: '1.5px solid #E5E7EB' }}
        >
          {soundMuted ? '🔇' : '🔊'}
        </button>
        <CircularTimer timeLeft={timeLeft} total={total} />
      </div>
    </div>
  )
}
