'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Participant {
  name: string
  archetype: string | undefined
  sessions: number
  avgScore: number | null
  lastSeen: string
  scores: number[]
}

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>

  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const range = max - min || 1
  const w = 48
  const h = 20

  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w
    const y = h - ((s - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  const trend = scores[scores.length - 1] - scores[0]
  const color = trend > 0 ? '#16A34A' : trend < 0 ? '#DC2626' : '#94A3B8'

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
  const bg = score >= 70 ? '#DCFCE7' : score >= 50 ? '#FEF3C7' : '#FEE2E2'
  const color = score >= 70 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: bg, color }}>
      {score}%
    </span>
  )
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'sessions' | 'score' | 'name'>('sessions')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/participants')
      if (res.ok) {
        const json = await res.json()
        setParticipants(json.participants ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = participants
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'sessions') return b.sessions - a.sessions
      if (sort === 'score') return (b.avgScore ?? -1) - (a.avgScore ?? -1)
      return a.name.localeCompare(b.name)
    })

  const totalUnique = participants.length
  const avgSessions = participants.length > 0
    ? (participants.reduce((s, p) => s + p.sessions, 0) / participants.length).toFixed(1)
    : '0'
  const topParticipant = participants[0]

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Participants
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
            Unique participants across all your quiz sessions
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Unique Participants', value: totalUnique, color: '#7C3AED', icon: '👥' },
          { label: 'Avg Sessions Each', value: avgSessions, color: '#0F1B3D', icon: '⚡' },
          { label: 'Most Active', value: topParticipant?.name?.split(' ')[0] ?? '—', color: '#F59E0B', icon: '🏆' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-4 border flex items-center gap-3"
            style={{ background: '#fff', borderColor: '#E2E8F0' }}
          >
            <span className="text-2xl flex-shrink-0">{stat.icon}</span>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-black leading-tight truncate"
                style={{ color: stat.color, fontFamily: 'var(--font-heading)' }}>
                {stat.value}
              </p>
              <p className="text-xs font-semibold truncate" style={{ color: '#64748B' }}>{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search participants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-yellow-200 flex-1 min-w-[180px] max-w-xs"
          style={{ borderColor: '#E2E8F0', background: '#fff', color: '#0F1B3D' }}
        />
        <div className="flex gap-1.5">
          {([['sessions', 'Most Active'], ['score', 'Top Score'], ['name', 'A–Z']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSort(val)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: sort === val ? '#0F1B3D' : '#F3F4F6', color: sort === val ? '#fff' : '#0F1B3D' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border overflow-hidden"
        style={{ background: '#fff', borderColor: '#E2E8F0' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-base font-bold" style={{ color: '#0F1B3D' }}>
              {participants.length === 0 ? 'No participants yet' : 'No participants match your search'}
            </p>
            <p className="text-sm mt-1 max-w-xs" style={{ color: '#9CA3AF' }}>
              {participants.length === 0
                ? 'Participant data will appear here after you run quiz sessions'
                : 'Try a different search term'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Participant', 'Sessions Attended', 'Avg Score', 'Score Trend', 'Last Seen'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide"
                      style={{ color: '#94A3B8' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50/40 transition-colors"
                    style={{ borderColor: '#F1F5F9' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                          style={{ background: '#F3F4F6', color: '#0F1B3D' }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#0F1B3D' }}>{p.name}</p>
                          {p.archetype && (
                            <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{p.archetype}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: '#7C3AED' }}>{p.sessions}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: Math.min(p.sessions, 5) }).map((_, j) => (
                            <div key={j} className="w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />
                          ))}
                          {p.sessions > 5 && <span className="text-[10px]" style={{ color: '#94A3B8' }}>+{p.sessions - 5}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={p.avgScore} />
                    </td>
                    <td className="px-4 py-3">
                      <Sparkline scores={p.scores} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                      {new Date(p.lastSeen).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {participants.length > 0 && (
        <p className="text-xs mt-3 text-center" style={{ color: '#CBD5E1' }}>
          Showing {filtered.length} of {participants.length} unique participants (identified by display name)
        </p>
      )}
    </div>
  )
}
