'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Avatar } from './Avatar'

interface PodiumEntry {
  name: string
  archetype?: string
  score: number
}

interface PodiumProps {
  leaderboard: PodiumEntry[]
  sessionMode: string
  highlightName?: string
}

const PODIUM_CONFIG = [
  { place: 2, height: 140, color: '#C0C0C0', label: '2nd', delay: '0.3s' },
  { place: 1, height: 180, color: '#F5E642', label: '1st', delay: '0.6s' },
  { place: 3, height: 100, color: '#CD7F32', label: '3rd', delay: '0s' },
]

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const m = window.matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
function getReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

export function Podium({ leaderboard, sessionMode, highlightName }: PodiumProps) {
  const reduced = usePrefersReducedMotion()
  const [rawPhase, setPhase] = useState<'bars' | 'confetti' | 'rest'>('bars')
  // Derived: reduced-motion users always see the final 'rest' state.
  const phase: 'bars' | 'confetti' | 'rest' = reduced ? 'rest' : rawPhase
  const isCompetitive = sessionMode === 'competitive'
  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  useEffect(() => {
    if (reduced) return
    const t1 = setTimeout(() => setPhase('confetti'), 2000)
    const t2 = setTimeout(() => setPhase('rest'), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [reduced])

  const skip = () => setPhase('rest')

  // Reorder for display: [2nd, 1st, 3rd]
  const ordered = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
      ? [top3[1], top3[0]]
      : [top3[0]]

  const configForCount = top3.length >= 3
    ? PODIUM_CONFIG
    : top3.length === 2
      ? [PODIUM_CONFIG[0], PODIUM_CONFIG[1]]
      : [PODIUM_CONFIG[1]]

  return (
    <div className="space-y-6 relative">
      {/* Skip intro animation — visible during bars/confetti phases only */}
      {phase !== 'rest' && (
        <button
          type="button"
          onClick={skip}
          className="absolute top-0 right-0 z-10 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#1E1B4B', border: '1px solid #E5E7EB' }}
          aria-label="Skip podium animation"
        >
          Skip →
        </button>
      )}
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 relative" style={{ minHeight: 280 }}>
        {ordered.map((entry, i) => {
          if (!entry) return null
          const cfg = configForCount[i]
          const isWinner = cfg.place === 1
          const isHighlighted = highlightName && entry.name === highlightName

          return (
            <div key={entry.name} className="flex flex-col items-center gap-2 relative" style={{ width: top3.length === 1 ? 160 : 120 }}>
              {/* Crown for winner */}
              {isWinner && phase !== 'bars' && (
                <div style={{ animation: 'crownBounce 0.6s ease-out forwards', fontSize: '2rem' }}>
                  👑
                </div>
              )}

              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-1" style={{
                animation: `fadeSlideUp 0.5s ease-out ${cfg.delay} both`,
              }}>
                <div className={`rounded-full overflow-hidden ${isHighlighted ? 'ring-3' : ''}`} style={isHighlighted ? { '--tw-ring-color': '#F5E642' } as React.CSSProperties : undefined}>
                  <Avatar archetype={entry.archetype ?? entry.name} size={isWinner ? 64 : 52} />
                </div>
                <div className="flex flex-col items-center w-full">
                  <span className="text-sm font-bold text-center truncate w-full" style={{ color: '#1E1B4B' }}>
                    {entry.name || entry.archetype}
                  </span>
                  {entry.name && entry.archetype && (
                    <span className="text-xs text-gray-500 mt-0.5 truncate w-full text-center">{entry.archetype}</span>
                  )}
                </div>
                {isCompetitive && (
                  <p className="text-xs font-black tabular-nums" style={{ color: cfg.color === '#F5E642' ? '#92400E' : '#6B7280' }}>
                    {entry.score.toLocaleString()} pts
                  </p>
                )}
              </div>

              {/* Bar */}
              <div className="w-full rounded-t-xl flex items-end justify-center pb-2 relative overflow-hidden"
                style={{
                  height: 0,
                  background: cfg.color,
                  animation: `growBar 0.8s ease-out ${cfg.delay} forwards`,
                  // @ts-expect-error CSS custom property
                  '--bar-height': `${cfg.height}px`,
                }}>
                <span className="text-2xl font-black" style={{ color: 'rgba(0,0,0,0.25)' }}>
                  {cfg.label}
                </span>
              </div>

              {/* Winner confetti */}
              {isWinner && phase !== 'bars' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ width: 200, height: 200 }}>
                  {Array.from({ length: 24 }).map((_, j) => (
                    <div key={j} className="absolute w-2 h-2 rounded-sm"
                      style={{
                        left: `${20 + Math.random() * 60}%`,
                        top: '50%',
                        background: ['#0F1B3D', '#F5E642', '#FF8A47', '#16A34A', '#2D3A8C'][j % 5],
                        animation: `podiumConfetti ${0.8 + Math.random() * 0.6}s ease-out ${Math.random() * 0.3}s forwards`,
                      }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="space-y-2" style={{
          opacity: phase === 'rest' ? 1 : 0,
          transform: phase === 'rest' ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.5s ease-out',
        }}>
          {rest.map((entry, i) => {
            const isHighlighted = highlightName && entry.name === highlightName
            return (
              <div key={entry.name}
                className={`flex items-center gap-3 rounded-xl p-3 ${isHighlighted ? 'ring-2' : ''}`}
                style={{ background: '#fff', border: '1px solid #E5E7EB', ...(isHighlighted ? { '--tw-ring-color': '#F5E642' } : {}) } as React.CSSProperties}>
                <span className="text-sm font-black w-6 text-center" style={{ color: '#9CA3AF' }}>{i + 4}</span>
                <Avatar archetype={entry.archetype ?? entry.name} size={36} />
                <span className="flex-1 font-semibold text-sm" style={{ color: '#1E1B4B' }}>{entry.name}</span>
                {isCompetitive && (
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#6B7280' }}>{entry.score.toLocaleString()}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes growBar {
          0% { height: 0; }
          100% { height: var(--bar-height); }
        }
        @keyframes crownBounce {
          0% { transform: scale(0) rotate(-20deg); }
          60% { transform: scale(1.3) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes podiumConfetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-120px) rotate(720deg); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
