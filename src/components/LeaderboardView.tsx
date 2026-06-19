'use client'

// Shared animated leaderboard.
//
// Used by:
//   - Quiz-mode "Live Standings" sidebar between questions (variant='compact')
//   - Presentation-mode leaderboard slide fullscreen (variant='fullscreen')
//
// Rank reordering uses framer-motion's `layout` so rows slide between
// positions instead of jumping — the missing "dopamine hit" Kahoot used to
// have. Bar widths animate proportionally to the top score.

import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from './Avatar'

export interface LeaderboardRow {
  id: string
  name: string
  score: number
  archetype?: string
  teamColor?: string
  rank?: number
  previousRank?: number | null
  rankDelta?: number
  scoreDelta?: number
}

interface LeaderboardViewProps {
  rows: LeaderboardRow[]
  topN?: number
  variant: 'compact' | 'fullscreen'
  highlightId?: string
  heading?: string
}

// Olympic-style gradients for top 3 — mirror Podium.tsx palette so the
// leaderboard and the final podium feel visually related.
const TIER_GRADIENTS = [
  'linear-gradient(90deg, #FFE082 0%, #FFB300 65%, #E69500 100%)', // gold
  'linear-gradient(90deg, #E8EAF0 0%, #C0C5CE 65%, #8D95A3 100%)', // silver
  'linear-gradient(90deg, #F5C69A 0%, #C97B3F 65%, #8A4B1E 100%)', // bronze
] as const

const DEFAULT_GRADIENT = 'linear-gradient(90deg, #2D3A8C 0%, #0F1B3D 100%)'

const MEDAL_EMOJI = ['🥇', '🥈', '🥉'] as const

function pickGradient(rank: number, teamColor?: string): string {
  if (teamColor) return `linear-gradient(90deg, ${teamColor} 0%, ${teamColor}CC 100%)`
  if (rank < 3) return TIER_GRADIENTS[rank]
  return DEFAULT_GRADIENT
}

export function LeaderboardView({
  rows,
  topN = 10,
  variant,
  highlightId,
  heading,
}: LeaderboardViewProps) {
  const sorted = [...rows].sort((a, b) => b.score - a.score).slice(0, topN)
  const maxScore = sorted[0]?.score ?? 0

  if (sorted.length === 0) {
    return (
      <div
        className={
          variant === 'fullscreen'
            ? 'flex flex-col items-center justify-center h-full gap-3 text-center'
            : 'bg-white rounded-xl border border-gray-200 p-4 text-center'
        }
      >
        <p
          className={
            variant === 'fullscreen'
              ? 'text-2xl font-black opacity-60'
              : 'text-xs font-bold uppercase tracking-widest text-gray-400'
          }
          style={{ color: variant === 'fullscreen' ? '#FFFFFF' : undefined }}
        >
          Waiting for responses…
        </p>
      </div>
    )
  }

  if (variant === 'compact') {
    return <CompactLeaderboard rows={sorted} highlightId={highlightId} heading={heading} />
  }

  // Fullscreen variant — presentation leaderboard slide
  return (
    <div className="flex flex-col h-full w-full px-6 py-4 gap-4">
      <div className="flex items-baseline justify-between flex-shrink-0">
        <h2
          className="text-3xl md:text-4xl font-black"
          style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}
        >
          {heading ?? 'Leaderboard'}
        </h2>
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: '#94A3B8' }}
        >
          Top {Math.min(sorted.length, topN)}
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {sorted.map((row, i) => {
            const widthPct = maxScore > 0 ? Math.max(8, (row.score / maxScore) * 100) : 8
            const gradient = pickGradient(i, row.teamColor)
            const rank = row.rank ?? i + 1
            const rankDelta = row.rankDelta ?? 0
            const previousRank = row.previousRank ?? null
            const scoreDelta = row.scoreDelta ?? 0
            return (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
                className="flex items-center gap-3 relative"
              >
                <span
                  className="w-10 text-center text-2xl font-black tabular-nums flex-shrink-0"
                  style={{ color: '#0F1B3D' }}
                >
                  {i < 3 ? MEDAL_EMOJI[i] : `#${rank}`}
                </span>

                <div className="flex-1 relative h-16 md:h-[72px] rounded-xl overflow-hidden bg-gray-100">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-xl"
                    style={{ background: gradient }}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{
                      type: 'spring',
                      stiffness: 120,
                      damping: 24,
                      mass: 0.9,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center gap-3 px-3">
                    {row.archetype && (
                      <div className="w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden flex-shrink-0 bg-white/70">
                        <Avatar archetype={row.archetype} size={44} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span
                        className="block text-lg md:text-2xl font-black truncate"
                        style={{
                          color: i < 3 ? '#0F1B3D' : '#FFFFFF',
                          textShadow: i < 3 ? 'none' : '0 1px 2px rgba(0,0,0,0.25)',
                        }}
                      >
                        {row.name}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {previousRank !== null && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] md:text-xs font-black tabular-nums"
                            style={{
                              color: rankDelta > 0 ? '#14532D' : rankDelta < 0 ? '#7F1D1D' : '#334155',
                              background: rankDelta > 0 ? 'rgba(187,247,208,0.95)' : rankDelta < 0 ? 'rgba(254,202,202,0.95)' : 'rgba(255,255,255,0.75)',
                            }}
                          >
                            {rankDelta > 0 ? `UP ${rankDelta}` : rankDelta < 0 ? `DOWN ${Math.abs(rankDelta)}` : 'HELD'}
                          </span>
                        )}
                        {scoreDelta > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] md:text-xs font-black tabular-nums"
                            style={{ color: '#0F1B3D', background: 'rgba(251,209,59,0.92)' }}
                          >
                            +{scoreDelta.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <span
                  className="w-28 text-right text-xl md:text-3xl font-black tabular-nums flex-shrink-0"
                  style={{ color: '#0F1B3D' }}
                >
                  {row.score.toLocaleString()}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Compact variant — "airport flip-board" style ────────────────────────────
// Dark navy frame, metallic gold/silver/bronze tiles for top-3, avatars,
// smooth spring reorders, and ↑/↓ indicators when ranks change between
// questions. Used on the host sidebar between quiz questions.

interface CompactLeaderboardProps {
  rows: LeaderboardRow[]
  highlightId?: string
  heading?: string
}

// Soft metallic tile backgrounds — lighter than the Olympic podium
// gradients so white text on top 3 stays legible without shouting.
const COMPACT_TILE: Record<number, { bg: string; textColor: string; border: string }> = {
  0: { bg: 'linear-gradient(135deg, #FFE082 0%, #FFB300 60%, #E69500 100%)', textColor: '#3B1F00', border: 'rgba(255,255,255,0.5)' },
  1: { bg: 'linear-gradient(135deg, #F1F3F8 0%, #C9CED8 60%, #8D95A3 100%)', textColor: '#1F2937', border: 'rgba(255,255,255,0.5)' },
  2: { bg: 'linear-gradient(135deg, #F0B87F 0%, #C17A3A 60%, #8B5222 100%)', textColor: '#FFFFFF', border: 'rgba(255,255,255,0.35)' },
}

function CompactLeaderboard({ rows, highlightId, heading }: CompactLeaderboardProps) {
  return (
    <div
      className="rounded-2xl p-2 sm:p-3 overflow-hidden w-full"
      style={{
        background: 'linear-gradient(180deg, #0F1B3D 0%, #1B2A5E 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 24px rgba(15,27,61,0.25)',
      }}
    >
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {heading ?? 'Live Standings'}
        </p>
        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,209,59,0.15)', color: '#FBD13B' }}>
          Live
        </span>
      </div>
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => {
            const tile = COMPACT_TILE[i]
            const delta = row.rankDelta
            const isTop = i < 3
            return (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.7 }}
                className="relative flex items-center gap-3 rounded-xl"
                style={{
                  background: tile ? tile.bg : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${tile ? tile.border : 'rgba(255,255,255,0.08)'}`,
                  padding: '14px 16px',
                  outline: row.id === highlightId ? '2px solid #FBD13B' : 'none',
                  outlineOffset: -1,
                }}
              >
                <span
                  className="w-6 text-center text-lg font-black tabular-nums flex-shrink-0"
                  style={{ color: tile ? tile.textColor : 'rgba(255,255,255,0.7)' }}
                >
                  {i + 1}
                </span>
                {row.archetype && (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.5)' }}>
                    <Avatar archetype={row.archetype} size={40} />
                  </div>
                )}
                <span
                  className="flex-1 text-base font-bold truncate"
                  style={{
                    color: tile ? tile.textColor : '#fff',
                    textShadow: isTop ? 'none' : '0 1px 1px rgba(0,0,0,0.18)',
                  }}
                >
                  {row.name}
                </span>
                {delta !== undefined && delta !== 0 && (
                  <span
                    className="text-xs font-black tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: delta > 0 ? '#15803D' : '#B91C1C',
                      background: delta > 0 ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.14)',
                    }}
                    aria-label={delta > 0 ? `Up ${delta}` : `Down ${-delta}`}
                  >
                    {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                  </span>
                )}
                <span
                  className="text-base font-black tabular-nums flex-shrink-0"
                  style={{ color: tile ? tile.textColor : '#fff' }}
                >
                  {row.score.toLocaleString()}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
