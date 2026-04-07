'use client'

import { useEffect, useState } from 'react'
import type { QuestionStat } from '@/lib/quiz-types'

interface ReflectionInsightsProps {
  gameCode: string
  questionStats: QuestionStat[]
}

interface InsightsData {
  count: number
  confDist: { low: number; medium: number; high: number }
  topQuestions: { index: number; mentions: number }[]
  revisitNotes: { participantName: string; note: string }[]
}

export function ReflectionInsights({ gameCode, questionStats }: ReflectionInsightsProps) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!gameCode) return

    async function fetch_() {
      try {
        const res = await fetch(`/api/sessions/reflect?gameCode=${gameCode}`)
        const json = await res.json()
        if (json.success) setData(json.data)
      } finally {
        setLoading(false)
      }
    }

    fetch_()
    // Poll every 15 seconds while the panel is mounted
    const interval = setInterval(fetch_, 15000)
    return () => clearInterval(interval)
  }, [gameCode])

  if (loading) {
    return (
      <div className="rounded-2xl border p-5 mt-4" style={{ borderColor: '#E9D5FF', background: '#FAF5FF' }}>
        <p className="text-sm text-center" style={{ color: '#9333EA' }}>Loading reflections…</p>
      </div>
    )
  }

  const count = data?.count ?? 0

  return (
    <div className="rounded-2xl border p-5 mt-4" style={{ borderColor: '#E9D5FF', background: '#FAF5FF' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
            🪞 Reflection Insights
          </p>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {count === 0 ? 'No reflections yet' : `${count} participant${count === 1 ? '' : 's'} reflected`}
          </p>
        </div>
        <span className="text-2xl font-black" style={{ color: '#9333EA', fontFamily: 'var(--font-heading)' }}>{count}</span>
      </div>

      {count === 0 && (
        <p className="text-xs text-center py-2" style={{ color: '#94A3B8' }}>
          Participants will see a reflection prompt after the quiz ends.
        </p>
      )}

      {count > 0 && data && (
        <div className="space-y-4">
          {/* Confidence distribution */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#1E1B4B' }}>Confidence Distribution</p>
            <div className="flex gap-2">
              {([
                { key: 'high' as const, label: 'Got it', color: '#16A34A', bg: '#F0FDF4' },
                { key: 'medium' as const, label: 'Mostly', color: '#D97706', bg: '#FFFBEB' },
                { key: 'low' as const, label: 'Confused', color: '#DC2626', bg: '#FEF2F2' },
              ]).map(c => (
                <div key={c.key} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: c.bg }}>
                  <p className="text-lg font-black" style={{ color: c.color }}>{data.confDist[c.key]}</p>
                  <p className="text-[10px] font-semibold" style={{ color: c.color }}>{c.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top questions that confused people */}
          {data.topQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#1E1B4B' }}>Questions that stood out</p>
              <div className="space-y-2">
                {data.topQuestions.map(tq => {
                  const stat = questionStats[tq.index]
                  return (
                    <div key={tq.index} className="bg-white rounded-xl px-4 py-3 border" style={{ borderColor: '#E9D5FF' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold" style={{ color: '#9333EA' }}>Q{tq.index + 1}</p>
                          <p className="text-xs truncate" style={{ color: '#374151' }}>
                            {stat?.text ?? '—'}
                          </p>
                        </div>
                        <span className="text-xs font-black flex-shrink-0 px-2 py-1 rounded-full" style={{ background: '#FAF5FF', color: '#9333EA' }}>
                          {tq.mentions} ×
                        </span>
                      </div>
                      {stat && (
                        <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                          Class avg: {stat.correctPct}% correct
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Revisit notes */}
          {data.revisitNotes.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#1E1B4B' }}>What participants want to revisit</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {data.revisitNotes.map((n, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2 border" style={{ borderColor: '#E9D5FF' }}>
                    <p className="text-[10px] font-bold mb-0.5" style={{ color: '#9333EA' }}>{n.participantName}</p>
                    <p className="text-xs" style={{ color: '#374151' }}>{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
