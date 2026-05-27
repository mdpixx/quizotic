'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DataCardList } from '@/components/ui/DataCardList'

interface SessionRecord {
  id: string
  code: string
  type: 'quiz' | 'presentation'
  status: string
  participantCount: number | null
  results: {
    quizTitle?: string
    leaderboard?: { name: string; score: number }[]
    duration?: number
    questionCount?: number
    maxScore?: number
  } | null
  createdAt: string
  endedAt: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDuration(secs: number | null | undefined) {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Returns the session's average score as a 0–100 percentage, or null if unscoreable.
// `results.score` is a raw Kahoot-style point total (up to ~1000 per scoreable question).
// We normalize by `maxScore` (new) or fall back to `questionCount * 1000` for legacy rows.
function getAvgScore(results: SessionRecord['results']): number | null {
  const lb = results?.leaderboard
  if (!lb || lb.length === 0) return null
  const maxScore = results?.maxScore
    ?? (results?.questionCount != null ? results.questionCount * 1000 : null)
  if (!maxScore || maxScore <= 0) return null
  const avgRaw = lb.reduce((s, p) => s + (p.score ?? 0), 0) / lb.length
  const pct = (avgRaw / maxScore) * 100
  // Clamp to [0, 100] in case legacy data has custom point weights we can't detect
  return Math.max(0, Math.min(100, Math.round(pct)))
}

function getTitle(session: SessionRecord): string {
  return session.results?.quizTitle ?? `${session.type === 'quiz' ? 'Quiz' : 'Presentation'} Session`
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'quiz' | 'presentation'>('all')
  const [search, setSearch] = useState('')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const json = await res.json()
        setSessions(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const filtered = sessions.filter(s => {
    if (filter !== 'all' && s.type !== filter) return false
    if (search) {
      const title = getTitle(s).toLowerCase()
      if (!title.includes(search.toLowerCase()) && !s.code.includes(search)) return false
    }
    return true
  })

  const totalParticipants = sessions.reduce((sum, s) => sum + (s.participantCount ?? 0), 0)
  const quizSessions = sessions.filter(s => s.type === 'quiz')
  const avgScore = (() => {
    const scored = quizSessions.filter(s => getAvgScore(s.results) !== null)
    if (!scored.length) return null
    return Math.round(scored.reduce((sum, s) => sum + (getAvgScore(s.results) ?? 0), 0) / scored.length)
  })()

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Sessions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
            All your quiz and presentation sessions
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: sessions.length, color: '#0F1B3D', icon: '⚡' },
          { label: 'Total Participants', value: totalParticipants, color: '#7C3AED', icon: '👥' },
          { label: 'Avg Quiz Score', value: avgScore != null ? `${avgScore}%` : '—', color: '#F59E0B', icon: '🎯' },
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
              <p className="text-xl sm:text-2xl font-black leading-tight truncate" style={{ color: stat.color, fontFamily: 'var(--font-heading)' }}>
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
          placeholder="Search sessions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-yellow-200 flex-1 min-w-[180px] max-w-xs"
          style={{ borderColor: '#E2E8F0', background: '#fff', color: '#0F1B3D' }}
        />
        <div className="flex gap-1.5">
          {(['all', 'quiz', 'presentation'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg capitalize transition-all"
              style={{
                background: filter === f ? '#0F1B3D' : '#F3F4F6',
                color: filter === f ? '#fff' : '#0F1B3D',
              }}
            >
              {f === 'all' ? 'All' : f === 'quiz' ? '🧠 Quizzes' : '📽 Presentations'}
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
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <p className="text-base font-bold" style={{ color: '#0F1B3D' }}>
              {sessions.length === 0 ? 'No sessions yet' : 'No sessions match your filter'}
            </p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              {sessions.length === 0
                ? 'Host a quiz or presentation to see it here'
                : 'Try adjusting your search or filter'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Session', 'Code', 'Date', 'Participants', 'Avg Score', 'Duration', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const avgS = getAvgScore(s.results)
                    const statusStyles: Record<string, { bg: string; fg: string }> = {
                      ended: { bg: '#F0FDF4', fg: '#16A34A' },
                      active: { bg: '#DBEAFE', fg: '#2563EB' },
                      lobby: { bg: '#FEF3C7', fg: '#D97706' },
                      abandoned: { bg: '#FEE2E2', fg: '#DC2626' },
                    }
                    const statusStyle = statusStyles[s.status] ?? { bg: '#F1F5F9', fg: '#64748B' }
                    return (
                      <tr key={s.id} className="border-t hover:bg-gray-50/40 transition-colors" style={{ borderColor: '#F1F5F9' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{s.type === 'quiz' ? '🧠' : '📽'}</span>
                            <div>
                              <p className="font-semibold text-sm truncate max-w-[200px]" style={{ color: '#0F1B3D' }}>{getTitle(s)}</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: s.type === 'quiz' ? '#F3F4F6' : '#FFF5F5', color: s.type === 'quiz' ? '#0F1B3D' : '#EF4444' }}>
                                {s.type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg" style={{ background: '#F1F5F9', color: '#0F1B3D' }}>{s.code}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{fmtDate(s.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: '#7C3AED' }}>{s.participantCount ?? 0}</td>
                        <td className="px-4 py-3">
                          {avgS != null ? (
                            <span className="text-xs font-bold px-2 py-1 rounded-lg"
                              style={{ background: avgS >= 70 ? '#DCFCE7' : avgS >= 50 ? '#FEF3C7' : '#FEE2E2', color: avgS >= 70 ? '#16A34A' : avgS >= 50 ? '#D97706' : '#DC2626' }}>
                              {avgS}%
                            </span>
                          ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{fmtDuration(s.results?.duration)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-1 rounded-full capitalize" style={{ background: statusStyle.bg, color: statusStyle.fg }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden">
              <DataCardList
                emptyState="No sessions found."
                items={filtered.map(s => {
                  const avgS = getAvgScore(s.results)
                  const statusStyles: Record<string, { bg: string; fg: string }> = {
                    ended: { bg: '#F0FDF4', fg: '#16A34A' },
                    active: { bg: '#DBEAFE', fg: '#2563EB' },
                    lobby: { bg: '#FEF3C7', fg: '#D97706' },
                    abandoned: { bg: '#FEE2E2', fg: '#DC2626' },
                  }
                  const statusStyle = statusStyles[s.status] ?? { bg: '#F1F5F9', fg: '#64748B' }
                  return {
                    id: s.id,
                    fields: [
                      {
                        label: 'Session',
                        value: <span>{s.type === 'quiz' ? '🧠' : '📽'} {getTitle(s)}</span>,
                        wide: true,
                      },
                      { label: 'Code', value: <span className="font-mono font-bold">{s.code}</span> },
                      { label: 'Date', value: fmtDate(s.createdAt) },
                      { label: 'Players', value: <span style={{ color: '#7C3AED' }}>{s.participantCount ?? 0}</span> },
                      {
                        label: 'Avg Score',
                        value: avgS != null
                          ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: avgS >= 70 ? '#DCFCE7' : avgS >= 50 ? '#FEF3C7' : '#FEE2E2', color: avgS >= 70 ? '#16A34A' : avgS >= 50 ? '#D97706' : '#DC2626' }}>{avgS}%</span>
                          : '—',
                      },
                      {
                        label: 'Status',
                        value: <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: statusStyle.bg, color: statusStyle.fg }}>{s.status}</span>,
                      },
                    ],
                  }
                })}
              />
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
