'use client'

// Participant × Question answer grid — rows are participants, columns are
// questions with a per-question accuracy chip in the header. Cells: ✓ correct,
// ✗ wrong, — unattempted, • answered (non-scored type). Wayground-style
// at-a-glance view of who missed what.

import { useEffect, useMemo, useState } from 'react'

type MatrixCell = 1 | 0 | 2 | null

interface MatrixQuestion {
  index: number
  label: string
  type: string
  isScored: boolean
}

interface MatrixParticipant {
  id: string
  name: string
  score: number
  correct: number
  answered: number
  accuracy: number | null
  cells: MatrixCell[]
  points: number[]
}

interface MatrixData {
  questions: MatrixQuestion[]
  participants: MatrixParticipant[]
  perQuestionAccuracy: (number | null)[]
}

type SortKey = 'score' | 'accuracy' | 'name'

function chipColors(pct: number | null): { bg: string; fg: string } {
  if (pct == null) return { bg: '#F3F4F6', fg: '#6B7280' }
  if (pct >= 70) return { bg: '#DCFCE7', fg: '#15803D' }
  if (pct >= 40) return { bg: '#FEF3C7', fg: '#A16207' }
  return { bg: '#FEE2E2', fg: '#B91C1C' }
}

function CellMark({ cell }: { cell: MatrixCell }) {
  if (cell === 1) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mx-auto" aria-label="Correct">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  if (cell === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" className="w-4 h-4 mx-auto" aria-label="Wrong">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    )
  }
  if (cell === 2) {
    return <span className="block w-2 h-2 rounded-full mx-auto" style={{ background: '#2563EB' }} aria-label="Answered" />
  }
  return <span className="block text-center" style={{ color: '#9CA3AF' }} aria-label="Unattempted">—</span>
}

export function ParticipantMatrix({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<MatrixData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('score')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/matrix`)
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed to load matrix (${res.status})`)
        if (!cancelled) {
          setData(json.data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load matrix')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [sessionId])

  const sorted = useMemo(() => {
    if (!data) return []
    const rows = [...data.participants]
    if (sortKey === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortKey === 'accuracy') rows.sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) || b.score - a.score)
    else rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    return rows
  }, [data, sortKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-line)', borderTopColor: 'var(--color-yellow)' }} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-4 py-3 rounded-[10px] text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{error}</div>
    )
  }
  if (!data || data.participants.length === 0 || data.questions.length === 0) {
    return (
      <div className="px-4 py-6 rounded-[12px] text-sm text-center" style={{ background: 'var(--color-paper-2)', border: '1px dashed var(--color-line)', color: 'var(--color-text-muted)' }}>
        No answer data recorded for this session.
      </div>
    )
  }

  const { questions, perQuestionAccuracy } = data

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>Sort by</span>
        {(['score', 'accuracy', 'name'] as const).map(k => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            className="chip"
            style={{
              background: sortKey === k ? 'var(--color-ink)' : '#fff',
              color: sortKey === k ? '#fff' : 'var(--color-text-muted)',
              cursor: 'pointer',
              border: sortKey === k ? 'none' : '1px solid var(--color-line)',
              textTransform: 'capitalize',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[12px]" style={{ border: '1px solid var(--color-line)' }}>
        <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: 'var(--color-paper-2)' }}>
              <th
                className="text-left px-3 py-2.5 font-bold text-[11px] uppercase tracking-[0.08em] whitespace-nowrap"
                style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--color-paper-2)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line)', borderRight: '1px solid var(--color-line)' }}
              >
                Participant
              </th>
              <th className="px-3 py-2.5 font-bold text-[11px] uppercase tracking-[0.08em] whitespace-nowrap text-right" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-line)' }}>
                Points
              </th>
              {questions.map((q, col) => {
                const acc = perQuestionAccuracy[col]
                const c = chipColors(acc)
                return (
                  <th key={q.index} className="px-1.5 py-2 text-center whitespace-nowrap" style={{ borderBottom: '1px solid var(--color-line)' }} title={q.label}>
                    <div className="font-bold text-[11px]" style={{ color: 'var(--color-ink)' }}>Q{q.index + 1}</div>
                    <div className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ background: c.bg, color: c.fg }}>
                      {acc != null ? `${acc}%` : '·'}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 41px', background: i % 2 === 1 ? 'var(--color-paper-2)' : '#fff' }}>
                <td
                  className="px-3 py-2 font-semibold whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis"
                  style={{ position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 1 ? 'var(--color-paper-2)' : '#fff', color: 'var(--color-ink)', borderRight: '1px solid var(--color-line)' }}
                  title={p.name}
                >
                  {p.name}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  <span className="font-bold" style={{ color: 'var(--color-ink)' }}>{p.score.toLocaleString('en-IN')}</span>
                  {p.accuracy != null && (
                    <span className="ml-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>({p.accuracy}%)</span>
                  )}
                </td>
                {p.cells.map((cell, col) => (
                  <td key={col} className="px-1.5 py-2 text-center">
                    <CellMark cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2.5 text-[11px] flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M20 6 9 17l-5-5" /></svg>
          Correct
        </span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" className="w-3 h-3"><path d="M18 6 6 18M6 6l12 12" /></svg>
          Wrong
        </span>
        <span className="flex items-center gap-1.5"><span style={{ color: '#9CA3AF' }}>—</span> Unattempted</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#2563EB' }} /> Answered (unscored)</span>
      </div>
    </div>
  )
}
