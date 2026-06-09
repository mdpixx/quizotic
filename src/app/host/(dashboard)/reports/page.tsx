'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

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
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDuration(secs: number | null | undefined) {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Returns the session's average score as a 0–100 percentage, or null if unscoreable.
function getAvgScore(results: SessionRecord['results']): number | null {
  const lb = results?.leaderboard
  if (!lb || lb.length === 0) return null
  const maxScore = results?.maxScore
    ?? (results?.questionCount != null ? results.questionCount * 1000 : null)
  if (!maxScore || maxScore <= 0) return null
  const avgRaw = lb.reduce((s, p) => s + (p.score ?? 0), 0) / lb.length
  const pct = (avgRaw / maxScore) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

// Trigger a browser download from a Blob/URL response
async function downloadFromUrl(url: string, filename: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      let message = `Download failed (${res.status})`
      try {
        const body = await res.json()
        if (body?.error) message = body.error
      } catch {
        // Not JSON — fall through to default message
      }
      return { ok: false, error: message }
    }
    const blob = await res.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(objectUrl)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'quiz' | 'presentation'>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

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

  // Only ENDED sessions make sense for reports
  const endedSessions = sessions.filter(s => s.status === 'ended')
  const filtered = endedSessions.filter(s => filter === 'all' || s.type === filter)

  async function handleCsvDownload(session: SessionRecord) {
    setDownloadingId(session.id)
    setDownloadError(null)
    setDownloadSuccess(null)
    const title = session.results?.quizTitle ?? `Session-${session.code}`
    const cleanTitle = title.replace(/[^a-zA-Z0-9-]+/g, '_').slice(0, 40)
    const filename = `${cleanTitle}-${session.code}-${fmtDate(session.endedAt ?? session.createdAt).replace(/\s/g, '-')}.csv`
    const result = await downloadFromUrl(`/api/sessions/${session.id}/csv`, filename)
    setDownloadingId(null)
    if (result.ok) {
      setDownloadSuccess(`Downloaded ${cleanTitle}.csv`)
      setTimeout(() => setDownloadSuccess(null), 4000)
    } else {
      setDownloadError(result.error ?? 'Download failed')
    }
  }

  const totalParticipants = endedSessions.reduce((s, r) => s + (r.participantCount ?? 0), 0)
  const scoredSessions = endedSessions.filter(s => getAvgScore(s.results) !== null)
  const avgAcrossAll = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + (getAvgScore(s.results) ?? 0), 0) / scoredSessions.length)
    : null

  return (
    <div className="paper-grain min-h-full" style={{ background: 'var(--color-paper)' }}>
      <div className="p-6 md:p-8 max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[28px] font-black leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              Reports
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Download session data for any quiz or presentation you&apos;ve hosted.
            </p>
          </div>
          <span className="chip" style={{ background: '#FAF5FF', color: 'var(--color-accent-violet)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>
            {endedSessions.length} report{endedSessions.length === 1 ? '' : 's'} available
          </span>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="dash-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>Completed sessions</p>
            <p className="text-[26px] font-black leading-tight mt-1.5" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>{endedSessions.length}</p>
          </div>
          <div className="dash-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>Total participants</p>
            <p className="text-[26px] font-black leading-tight mt-1.5" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>{totalParticipants}</p>
          </div>
          <div className="dash-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>Avg quiz score</p>
            <p className="text-[26px] font-black leading-tight mt-1.5" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>{avgAcrossAll != null ? `${avgAcrossAll}%` : '—'}</p>
          </div>
        </div>

        {/* Pro hint */}
        <div className="mb-5 px-4 py-2.5 rounded-[12px] flex items-center gap-3 text-[13px]" style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span>CSV export is a <strong>Pro</strong> feature — free accounts see session summaries here; Pro accounts can download full data. Email info@quizotic.live to upgrade.</span>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          {[
            { label: 'What went well', desc: `${totalParticipants} participant${totalParticipants === 1 ? '' : 's'} reached across completed sessions.`, tone: '#16A34A' },
            { label: 'Who needs help', desc: avgAcrossAll != null && avgAcrossAll < 60 ? 'Average score is below 60%; export marks and follow up.' : 'Use CSV to spot repeat learners and low confidence answers.', tone: '#DC2626' },
            { label: 'What to teach next', desc: 'Open a weak topic in the builder and generate a short retrieval quiz.', tone: '#7C3AED', href: '/host/build?start=aitopic' },
            { label: 'Export marks', desc: 'Download CSV for a session, then push to Sheets/Classroom when integrations land.', tone: '#D97706' },
          ].map(item => {
            const body = (
              <div className="dash-card p-4 h-full">
                <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: item.tone }}>{item.label}</p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
              </div>
            )
            return item.href ? (
              <Link key={item.label} href={item.href} className="transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ textDecoration: 'none' }}>{body}</Link>
            ) : (
              <div key={item.label}>{body}</div>
            )
          })}
        </div>

        {/* Filter bar */}
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          {(['all', 'quiz', 'presentation'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="chip"
              style={{
                background: filter === f ? 'var(--color-ink)' : '#fff',
                color: filter === f ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
                border: filter === f ? 'none' : '1px solid var(--color-line)',
              }}
            >
              {f === 'all' ? 'All reports' : f === 'quiz' ? 'Quizzes' : 'Presentations'}
            </button>
          ))}
        </div>

        {/* Status banners */}
        {downloadError && (
          <div className="mb-4 px-4 py-3 rounded-[10px] text-sm font-medium flex items-center justify-between gap-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            <span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} className="text-[12px] underline decoration-dotted">dismiss</button>
          </div>
        )}
        {downloadSuccess && (
          <div className="mb-4 px-4 py-3 rounded-[10px] text-sm font-medium flex items-center gap-3" style={{ background: '#DCFCE7', color: '#15803D' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M20 6 9 17l-5-5"/></svg>
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Table of reports */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-[16px]" style={{ background: 'var(--color-paper-2)', border: '1px dashed #DDD4BC' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }}><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>
            </div>
            <p className="text-[16px] font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              {endedSessions.length === 0 ? 'No reports yet.' : 'No reports match that filter.'}
            </p>
            <p className="text-sm max-w-[40ch]" style={{ color: 'var(--color-text-muted)' }}>
              {endedSessions.length === 0 ? 'Reports are generated automatically when you complete a live session.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="rounded-[16px] overflow-hidden" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
            {/* Table header — desktop only */}
            <div className="hidden md:grid grid-cols-[1fr_100px_120px_90px_90px_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] border-b" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-line)', background: 'var(--color-paper)' }}>
              <div>Session</div>
              <div>Code</div>
              <div>Date</div>
              <div>Participants</div>
              <div>Avg score</div>
              <div className="text-right">Download</div>
            </div>

            {filtered.map((session, i) => {
              const avgScore = getAvgScore(session.results)
              const title = session.results?.quizTitle ?? (session.type === 'presentation' ? 'Presentation session' : `Session ${session.code}`)
              const isDownloading = downloadingId === session.id
              return (
                <div
                  key={session.id}
                  className={`md:grid md:grid-cols-[1fr_100px_120px_90px_90px_auto] gap-4 px-4 py-4 items-center ${i < filtered.length - 1 ? 'border-b' : ''}`}
                  style={{ borderColor: 'var(--color-line)' }}
                >
                  {/* Session — title + type chip */}
                  <div className="flex items-center gap-3 min-w-0 mb-3 md:mb-0">
                    <div className="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center" style={{ background: session.type === 'quiz' ? 'linear-gradient(135deg, #0F1B3D, #1B2A5E)' : 'linear-gradient(135deg, #0EA5E9, #0284C7)', color: '#fff' }}>
                      {session.type === 'quiz' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: '#0F1B3D' }}>{title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="chip" style={{ background: session.type === 'quiz' ? '#EFF6FF' : '#E0F2FE', color: session.type === 'quiz' ? '#1D4ED8' : '#0369A1' }}>
                          {session.type === 'quiz' ? 'Quiz' : 'Presentation'}
                        </span>
                        {session.results?.duration != null && (
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            {fmtDuration(session.results.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Code */}
                  <div className="hidden md:block font-mono text-[13px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    {session.code}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                    {fmtDate(session.endedAt ?? session.createdAt)}
                  </div>

                  {/* Participants */}
                  <div className="hidden md:block text-[13px] font-semibold" style={{ color: 'var(--color-accent-violet)' }}>
                    {session.participantCount ?? 0}
                  </div>

                  {/* Avg score */}
                  <div className="hidden md:block">
                    {avgScore != null ? (
                      <span className="chip" style={{ background: avgScore >= 70 ? '#DCFCE7' : avgScore >= 50 ? '#FEF3C7' : '#FEE2E2', color: avgScore >= 70 ? '#15803D' : avgScore >= 50 ? '#A16207' : '#B91C1C' }}>
                        {avgScore}%
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </div>

                  {/* Download */}
                  <div className="flex items-center gap-2 md:justify-end flex-shrink-0 md:col-start-6">
                    <button
                      onClick={() => handleCsvDownload(session)}
                      disabled={isDownloading}
                      className="btn-secondary"
                      style={{ padding: '7px 12px', fontSize: '12px' }}
                      title="Download full session data as CSV (Pro only)"
                    >
                      {isDownloading ? (
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                          CSV
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
