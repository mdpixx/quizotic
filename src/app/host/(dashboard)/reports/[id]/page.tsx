'use client'

// Session report detail — Wayground-style drill-down for a single (live or
// async) session: summary cards + the participant × question answer matrix.

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ParticipantMatrix } from '@/components/results/ParticipantMatrix'
import { downloadFromUrl } from '@/lib/download'

interface SessionDetail {
  id: string
  code: string
  type: 'quiz' | 'presentation'
  status: string
  mode: string
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
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDuration(secs: number | null | undefined) {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function getAvgScore(results: SessionDetail['results']): number | null {
  const lb = results?.leaderboard
  if (!lb || lb.length === 0) return null
  const maxScore = results?.maxScore
    ?? (results?.questionCount != null ? results.questionCount * 1000 : null)
  if (!maxScore || maxScore <= 0) return null
  const avgRaw = lb.reduce((s, p) => s + (p.score ?? 0), 0) / lb.length
  return Math.max(0, Math.min(100, Math.round((avgRaw / maxScore) * 100)))
}

export default function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function handleCsvDownload() {
    if (!session) return
    setDownloading(true)
    setDownloadError(null)
    const cleanTitle = (session.results?.quizTitle ?? `Session-${session.code}`).replace(/[^a-zA-Z0-9-]+/g, '_').slice(0, 40)
    const result = await downloadFromUrl(`/api/sessions/${session.id}/csv`, `${cleanTitle}-${session.code}.csv`)
    setDownloading(false)
    if (!result.ok) setDownloadError(result.error ?? 'Download failed')
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/sessions/${id}`)
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to load session')
        if (!cancelled) setSession(json.data)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load session') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const title = session?.results?.quizTitle
    ?? (session?.type === 'presentation' ? 'Presentation session' : `Session ${session?.code ?? ''}`)
  const avgScore = getAvgScore(session?.results ?? null)

  return (
    <div className="paper-grain min-h-full" style={{ background: 'var(--color-paper)' }}>
      <div className="p-6 md:p-8 max-w-[1280px] mx-auto">
        <Link href="/host/reports" className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          All reports
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-line)', borderTopColor: 'var(--color-yellow)' }} />
          </div>
        ) : error || !session ? (
          <div className="px-4 py-3 rounded-[10px] text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            {error ?? 'Session not found.'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
              <div>
                <h1 className="font-display text-[26px] font-black leading-tight" style={{ color: 'var(--color-ink)' }}>{title}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="chip" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                    {session.mode === 'async' ? 'Self-paced' : 'Live'} {session.type}
                  </span>
                  <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Code {session.code}</span>
                  <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(session.endedAt ?? session.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={handleCsvDownload}
                disabled={downloading}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
                title="Download full session data as CSV (Pro only)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                {downloading ? 'Downloading…' : 'CSV'}
              </button>
            </div>

            {downloadError && (
              <div className="mb-4 px-4 py-3 rounded-[10px] text-sm font-medium flex items-center justify-between gap-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                <span>{downloadError}</span>
                <button onClick={() => setDownloadError(null)} className="text-[12px] underline decoration-dotted">dismiss</button>
              </div>
            )}

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Participants', value: String(session.participantCount ?? session.results?.leaderboard?.length ?? 0) },
                { label: 'Questions', value: session.results?.questionCount != null ? String(session.results.questionCount) : '—' },
                { label: 'Avg score', value: avgScore != null ? `${avgScore}%` : '—' },
                { label: 'Duration', value: fmtDuration(session.results?.duration) },
              ].map(card => (
                <div key={card.label} className="dash-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                  <p className="font-display text-[26px] font-black leading-tight mt-1.5" style={{ color: 'var(--color-ink)' }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Participant × question matrix */}
            <div className="dash-card p-4 md:p-5">
              <h2 className="font-display text-[16px] font-black mb-1" style={{ color: 'var(--color-ink)' }}>Question-by-question breakdown</h2>
              <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Every participant against every question — spot exactly who missed what.
              </p>
              <ParticipantMatrix sessionId={session.id} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
