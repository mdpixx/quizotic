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
    <div className="paper-grain min-h-full" style={{ background: 'var(--color-paper)' }}>
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[28px] font-black font-display leading-tight" style={{ color: 'var(--color-ink)' }}>
            Sessions
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            All your quiz and presentation sessions
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--color-ink)', icon: '⚡' },
          { label: 'Total Participants', value: totalParticipants, color: 'var(--color-accent-violet)', icon: '👥' },
          { label: 'Avg Quiz Score', value: avgScore != null ? `${avgScore}%` : '—', color: 'var(--color-secondary-dark)', icon: '🎯' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-[16px] p-4 border flex items-center gap-3"
            style={{ background: '#fff', borderColor: 'var(--color-line)' }}
          >
            <span className="text-2xl flex-shrink-0">{stat.icon}</span>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-black font-display leading-tight truncate" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search sessions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-yellow-200 flex-1 min-w-[180px] max-w-xs"
          style={{ borderColor: 'var(--color-line)', background: '#fff', color: 'var(--color-ink)' }}
        />
        <div className="flex gap-1.5">
          {(['all', 'quiz', 'presentation'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="chip capitalize"
              style={{
                background: filter === f ? 'var(--color-ink)' : 'var(--color-paper-2)',
                color: filter === f ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
                border: 'none',
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
        className="rounded-[16px] border overflow-hidden"
        style={{ background: '#fff', borderColor: 'var(--color-line)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-ink)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 text-3xl" style={{ background: 'var(--color-paper-2)' }}>⚡</div>
            <p className="text-base font-black font-display" style={{ color: 'var(--color-ink)' }}>
              {sessions.length === 0 ? 'No sessions yet' : 'No sessions match your filter'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
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
                  <tr style={{ background: 'var(--color-paper)' }}>
                    {['Session', 'Code', 'Date', 'Participants', 'Avg Score', 'Duration', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide font-display" style={{ color: 'var(--color-text-subtle)' }}>
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
                    const statusStyle = statusStyles[s.status] ?? { bg: 'var(--color-paper-2)', fg: 'var(--color-text-muted)' }
                    return (
                      <tr key={s.id} className="border-t transition-colors" style={{ borderColor: 'var(--color-line)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{s.type === 'quiz' ? '🧠' : '📽'}</span>
                            <div>
                              <p className="font-semibold text-sm truncate max-w-[200px]" style={{ color: 'var(--color-ink)' }}>{getTitle(s)}</p>
                              <span className="chip"
                                style={{ background: s.type === 'quiz' ? 'var(--color-paper-2)' : '#FFF5F5', color: s.type === 'quiz' ? 'var(--color-ink)' : '#EF4444', fontSize: '10px', padding: '3px 8px' }}>
                                {s.type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg font-display" style={{ background: 'var(--color-paper-2)', color: 'var(--color-ink)' }}>{s.code}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(s.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-bold font-display" style={{ color: 'var(--color-accent-violet)' }}>{s.participantCount ?? 0}</td>
                        <td className="px-4 py-3">
                          {avgS != null ? (
                            <span className="chip font-display"
                              style={{ background: avgS >= 70 ? '#DCFCE7' : avgS >= 50 ? '#FEF3C7' : '#FEE2E2', color: avgS >= 70 ? '#16A34A' : avgS >= 50 ? '#D97706' : '#DC2626', padding: '4px 9px' }}>
                              {avgS}%
                            </span>
                          ) : <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDuration(s.results?.duration)}</td>
                        <td className="px-4 py-3">
                          <span className="chip capitalize" style={{ background: statusStyle.bg, color: statusStyle.fg, padding: '4px 9px' }}>
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
                  const statusStyle = statusStyles[s.status] ?? { bg: 'var(--color-paper-2)', fg: 'var(--color-text-muted)' }
                  return {
                    id: s.id,
                    fields: [
                      {
                        label: 'Session',
                        value: <span>{s.type === 'quiz' ? '🧠' : '📽'} {getTitle(s)}</span>,
                        wide: true,
                      },
                      { label: 'Code', value: <span className="font-mono font-bold font-display">{s.code}</span> },
                      { label: 'Date', value: fmtDate(s.createdAt) },
                      { label: 'Players', value: <span style={{ color: 'var(--color-accent-violet)' }}>{s.participantCount ?? 0}</span> },
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
    </div>
  )
}
