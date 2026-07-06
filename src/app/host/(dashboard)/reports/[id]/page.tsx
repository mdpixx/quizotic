'use client'

// Session report detail — the host's true-insight view for a single session:
// learning-insight cards (mastered / re-teach / misconceptions), aggregate
// confidence grid, score distribution, per-question accuracy scan, the full
// question-by-question breakdown (SessionReport), and the participant ×
// question answer matrix. CSV export is Pro-only; free hosts see a locked pill.

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ParticipantMatrix } from '@/components/results/ParticipantMatrix'
import { SessionReport } from '@/components/SessionReport'
import { downloadFromUrl } from '@/lib/download'
import type { QuestionStat } from '@/lib/quiz-types'

interface AttendeeRecord {
  joinedAt: string
  leftAt: string | null
  durationSec: number | null
}

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
    questionStats?: QuestionStat[]
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

// ── Aggregate confidence grid (summed across scored questions) ──────────────
// Same quadrant language as SessionReport: Mastery / Misconception / Lucky /
// Gap. The aggregate view answers "how solid is this class's knowledge?" at
// a glance before the host drills into per-question grids below.
const QUADRANTS = {
  sureCorrect: { label: 'Mastery', hint: 'Sure + correct', bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' },
  sureWrong: { label: 'Misconception', hint: 'Sure + wrong', bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' },
  unsureCorrect: { label: 'Lucky', hint: 'Unsure + correct', bg: '#FEFCE8', border: '#FDE68A', color: '#A16207' },
  unsureWrong: { label: 'Gap', hint: 'Unsure + wrong', bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280' },
} as const

type GridTotals = { sureCorrect: number; sureWrong: number; unsureCorrect: number; unsureWrong: number }

function sumConfidence(stats: QuestionStat[]): GridTotals | null {
  const total: GridTotals = { sureCorrect: 0, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 }
  let any = false
  for (const s of stats) {
    if (!s.confidenceGrid) continue
    any = true
    total.sureCorrect += s.confidenceGrid.sureCorrect ?? 0
    total.sureWrong += s.confidenceGrid.sureWrong ?? 0
    total.unsureCorrect += s.confidenceGrid.unsureCorrect ?? 0
    total.unsureWrong += s.confidenceGrid.unsureWrong ?? 0
  }
  return any ? total : null
}

function AggregateConfidenceGrid({ grid }: { grid: GridTotals }) {
  const total = grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong
  if (total === 0) return null
  return (
    <div className="dash-card p-4 md:p-5">
      <h2 className="font-display text-[16px] font-black" style={{ color: 'var(--color-ink)' }}>Confidence grid</h2>
      <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Every scored answer, split by how sure the participant felt. <strong>Misconceptions</strong> (confident but wrong) are the answers worth re-teaching first.
      </p>
      <div className="grid grid-cols-2 gap-2 max-w-[420px]">
        {(Object.keys(QUADRANTS) as Array<keyof typeof QUADRANTS>).map(k => {
          const q = QUADRANTS[k]
          const count = grid[k]
          const pct = Math.round((count / total) * 100)
          const warn = k === 'sureWrong' && count > 0
          return (
            <div key={k} className="rounded-[12px] p-3" style={{ background: q.bg, border: `1.5px solid ${warn ? '#FCA5A5' : q.border}` }}>
              <p className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: q.color }}>
                {q.label}{warn ? ' ⚠' : ''}
              </p>
              <p className="font-display text-[26px] font-black leading-tight mt-0.5" style={{ color: q.color }}>
                {count}
                <span className="text-[13px] font-bold ml-1.5">({pct}%)</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: q.color, opacity: 0.75 }}>{q.hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Score distribution (leaderboard bucketed into quintiles of max score) ───
function ScoreDistribution({ results }: { results: SessionDetail['results'] }) {
  const lb = results?.leaderboard ?? []
  const maxScore = results?.maxScore
    ?? (results?.questionCount != null ? results.questionCount * 1000 : null)
  if (lb.length === 0 || !maxScore || maxScore <= 0) return null

  const buckets = [0, 0, 0, 0, 0]
  for (const p of lb) {
    const pct = Math.max(0, Math.min(0.999, (p.score ?? 0) / maxScore))
    buckets[Math.floor(pct * 5)] += 1
  }
  const labels = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%']
  const colors = ['#DC2626', '#F97316', '#F59E0B', '#84CC16', '#16A34A']
  const maxBucket = Math.max(1, ...buckets)

  return (
    <div className="dash-card p-4 md:p-5">
      <h2 className="font-display text-[16px] font-black" style={{ color: 'var(--color-ink)' }}>Score distribution</h2>
      <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Where the room landed. A left-heavy chart means the material outran the class; right-heavy means they were ready for harder questions.
      </p>
      <div className="space-y-1.5">
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[11px] font-bold w-16 text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--color-paper-2)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((buckets[i] / maxBucket) * 100)}%`, background: colors[i], minWidth: buckets[i] > 0 ? 8 : 0 }}
              />
            </div>
            <span className="text-[12px] font-black w-8 tabular-nums" style={{ color: 'var(--color-ink)' }}>{buckets[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Per-question accuracy scan — one bar per scored question ────────────────
function AccuracyScan({ stats }: { stats: QuestionStat[] }) {
  const scored = stats.filter(s => !s.isLeaderboard && !s.isNonScored && s.correctPct != null)
  if (scored.length < 2) return null
  return (
    <div className="dash-card p-4 md:p-5">
      <h2 className="font-display text-[16px] font-black" style={{ color: 'var(--color-ink)' }}>Accuracy by question</h2>
      <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Short bars are your hardest questions — details for each are in the breakdown below.
      </p>
      <div className="flex items-end gap-2 h-28 overflow-x-auto pb-1">
        {scored.map(s => {
          const pct = s.correctPct ?? 0
          const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626'
          return (
            <div key={s.index} className="flex flex-col items-center gap-1 flex-shrink-0 w-9" title={`Q${s.index + 1}: ${pct}% correct — ${s.text}`}>
              <span className="text-[10px] font-black tabular-nums" style={{ color }}>{pct}%</span>
              <div className="w-5 rounded-t-md" style={{ height: `${Math.max(4, pct * 0.72)}px`, background: color }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Q{s.index + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([])
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
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
    // Hosts land here straight from the finale podium, and the end-of-session
    // results are persisted fire-and-forget — the row can lag the click by a
    // few seconds. Retry 404s briefly before declaring the session missing.
    async function loadSession() {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`/api/sessions/${id}`).catch(() => null)
        const json = await res?.json().catch(() => null)
        if (cancelled) return
        if (res?.ok && json?.success) {
          setSession(json.data)
          setLoading(false)
          // Attendance summary is secondary — load it after the main payload.
          fetch(`/api/sessions/${json.data.id}/attendees`)
            .then(r => r.json())
            .then(a => { if (!cancelled && a?.success) setAttendees(a.data ?? []) })
            .catch(() => {})
          return
        }
        if (res && res.status !== 404) {
          setError(json?.error ?? 'Failed to load session')
          setLoading(false)
          return
        }
        await new Promise(r => setTimeout(r, 1_500))
        if (cancelled) return
      }
      if (!cancelled) {
        setError('Session not found')
        setLoading(false)
      }
    }
    loadSession()
    fetch('/api/billing/status')
      .then(r => r.json())
      .then(d => { if (!cancelled && d.plan === 'pro') setPlan('pro') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  const title = session?.results?.quizTitle
    ?? (session?.type === 'presentation' ? 'Presentation session' : `Session ${session?.code ?? ''}`)
  const avgScore = getAvgScore(session?.results ?? null)
  const questionStats = (session?.results?.questionStats ?? []).filter(s => !s.isLeaderboard)
  const scoredStats = questionStats.filter(s => !s.isNonScored && s.correctPct != null)
  const mastered = scoredStats.filter(s => (s.correctPct ?? 0) >= 80)
  const needsReview = scoredStats.filter(s => (s.correctPct ?? 0) < 50)
  const misconceptionCount = scoredStats.reduce((n, s) => n + (s.confidenceGrid?.sureWrong ?? 0), 0)
  const confidenceTotals = sumConfidence(scoredStats)

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
              {plan === 'pro' ? (
                <button
                  onClick={handleCsvDownload}
                  disabled={downloading}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '12px' }}
                  title="Download full session data as CSV"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  {downloading ? 'Downloading…' : 'CSV'}
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] font-semibold cursor-not-allowed"
                  style={{ border: '1px solid var(--color-line)', color: 'var(--color-text-muted)', background: '#fff' }}
                  title="CSV export is a Pro feature — email info@quizotic.live to upgrade"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  CSV · Pro
                </span>
              )}
            </div>

            {downloadError && (
              <div className="mb-4 px-4 py-3 rounded-[10px] text-sm font-medium flex items-center justify-between gap-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                <span>{downloadError}</span>
                <button onClick={() => setDownloadError(null)} className="text-[12px] underline decoration-dotted">dismiss</button>
              </div>
            )}

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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

            {/* Learning-insight strip — the "so what" row */}
            {scoredStats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="dash-card p-4" style={{ borderLeft: '4px solid #16A34A' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: '#16A34A' }}>Mastered</p>
                  <p className="font-display text-[26px] font-black leading-tight mt-1" style={{ color: 'var(--color-ink)' }}>
                    {mastered.length}<span className="text-[13px] font-bold" style={{ color: 'var(--color-text-muted)' }}> / {scoredStats.length} questions</span>
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>≥80% of the room answered these correctly.</p>
                </div>
                <div className="dash-card p-4" style={{ borderLeft: '4px solid #DC2626' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: '#DC2626' }}>Needs re-teaching</p>
                  <p className="font-display text-[26px] font-black leading-tight mt-1" style={{ color: 'var(--color-ink)' }}>
                    {needsReview.length}<span className="text-[13px] font-bold" style={{ color: 'var(--color-text-muted)' }}> / {scoredStats.length} questions</span>
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {needsReview.length > 0
                      ? `Under 50% correct: ${needsReview.slice(0, 3).map(s => `Q${s.index + 1}`).join(', ')}${needsReview.length > 3 ? '…' : ''}`
                      : 'Nothing fell below 50% — solid session.'}
                  </p>
                </div>
                <div className="dash-card p-4" style={{ borderLeft: '4px solid #7C3AED' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.1em]" style={{ color: '#7C3AED' }}>Misconceptions</p>
                  <p className="font-display text-[26px] font-black leading-tight mt-1" style={{ color: 'var(--color-ink)' }}>
                    {misconceptionCount}<span className="text-[13px] font-bold" style={{ color: 'var(--color-text-muted)' }}> answers</span>
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Confident but wrong — these participants believe an incorrect fact.</p>
                </div>
              </div>
            )}

            {/* Visual analytics row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
              {confidenceTotals && <AggregateConfidenceGrid grid={confidenceTotals} />}
              <ScoreDistribution results={session.results} />
            </div>

            {questionStats.length > 0 && (
              <div className="mb-6">
                <AccuracyScan stats={questionStats} />
              </div>
            )}

            {/* Full question-by-question report — per-question confidence grids,
                Bloom's tags, poll/wordcloud/rating result views, explanations,
                and the printable report. CSV lives in the page header, so the
                embedded report only contributes its print/download button. */}
            {questionStats.length > 0 && (
              <div className="mb-6">
                <SessionReport
                  questionStats={questionStats}
                  quizTitle={title}
                  participantCount={session.participantCount ?? session.results?.leaderboard?.length ?? 0}
                  sessionDate={fmtDate(session.endedAt ?? session.createdAt)}
                  attendees={attendees}
                  plan={plan}
                />
              </div>
            )}

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
