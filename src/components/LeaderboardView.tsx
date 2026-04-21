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
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          {heading ?? 'Live Standings'}
        </p>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {sorted.map((row, i) => (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.6 }}
                className="flex items-center gap-3 rounded-md"
                style={{
                  background: row.id === highlightId ? '#FFF7D6' : undefined,
                  padding: row.id === highlightId ? '4px 6px' : undefined,
                }}
              >
                <span
                  className="w-6 text-center text-sm font-black tabular-nums"
                  style={{ color: '#0F1B3D' }}
                >
                  {i + 1}
                </span>
                <span
                  className="flex-1 text-sm font-semibold truncate"
                  style={{ color: '#0F1B3D' }}
                >
                  {row.name}
                </span>
                <span
                  className="text-sm font-black tabular-nums"
                  style={{ color: '#0F1B3D' }}
                >
                  {row.score.toLocaleString()}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    )
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
                  {i < 3 ? MEDAL_EMOJI[i] : `#${i + 1}`}
                </span>

                <div className="flex-1 relative h-12 md:h-14 rounded-xl overflow-hidden bg-gray-100">
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
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/70">
                        <Avatar archetype={row.archetype} size={36} />
                      </div>
                    )}
                    <span
                      className="flex-1 text-base md:text-lg font-black truncate"
                      style={{
                        color: i < 3 ? '#0F1B3D' : '#FFFFFF',
                        textShadow: i < 3 ? 'none' : '0 1px 2px rgba(0,0,0,0.25)',
                      }}
                    >
                      {row.name}
                    </span>
                  </div>
                </div>

                <span
                  className="w-24 text-right text-xl md:text-2xl font-black tabular-nums flex-shrink-0"
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
