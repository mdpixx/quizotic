'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { QuizVsSlidesModal } from '@/components/host/QuizVsSlidesModal'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  summary: { totalSessions: number; totalParticipants: number; avgScore: number | null; completionRate: number | null; presentationCount: number; presentationSessionCount: number }
  trend: Array<{ date: string; sessions: number; participants: number; avgScore: number | null }>
  recentSessions: Array<{ id: string; type: string; title: string; date: string; participants: number; avgScore: number | null; completionPct: number | null; duration: number | null; status: string }>
  confidenceGrid: { sureCorrect: number; sureWrong: number; unsureCorrect: number; unsureWrong: number }
  topQuizzes: Array<{ id: string; title: string; sessions: number; avgScore: number | null; participants: number }>
  topParticipants: Array<{ name: string; archetype?: string; sessions: number; avgScore: number; scoreChange: number | null; scores: number[]; atRisk: boolean }>
  bloomsCoverage: Array<{ level: string; count: number }>
  engagementTrend: Array<{ date: string; label: string; completionPct: number; confidencePct: number | null }>
  recentQuestionDifficulty: { sessionTitle: string; questions: Array<{ index: number; text: string; correctPct: number; bloomsLevel: string | null }> } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDuration = (s: number | null) => { if (!s) return '—'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s % 60}s` : `${s}s` }
const scoreColor = (s: number) => s >= 70 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'
const scoreBg = (s: number) => s >= 70 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2'
const diffColor = (pct: number) => pct >= 80 ? '#16A34A' : pct >= 60 ? '#65A30D' : pct >= 40 ? '#D97706' : '#DC2626'

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const max = Math.max(...scores), min = Math.min(...scores), range = max - min || 1
  const W = 52, H = 20
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * W},${H - ((s - min) / range) * H}`).join(' ')
  const trend = scores[scores.length - 1] - scores[0]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={trend >= 0 ? '#16A34A' : '#DC2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Score change badge ────────────────────────────────────────────────────────
function ScoreChange({ change }: { change: number | null }) {
  if (change === null) return null
  if (Math.abs(change) < 1) return <span className="text-xs font-bold" style={{ color: '#94A3B8' }}>→ stable</span>
  const up = change > 0
  return (
    <span className="text-xs font-bold" style={{ color: up ? '#16A34A' : '#DC2626' }}>
      {up ? '↑' : '↓'} {up ? '+' : ''}{Math.round(change)}
    </span>
  )
}

// ── Avatar circle ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#0F1B3D', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9']
function AvatarCircle({ name, index }: { name: string; index: number }) {
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
      {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{text}</p>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ background: '#fff', borderColor: '#E2E8F0' }}>
      {children}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 shadow-lg border text-xs" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
      <p className="font-bold mb-1" style={{ color: '#0F1B3D' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'completionPct' ? 'Completion' : p.name === 'confidencePct' ? 'Confidence' : p.name}: <strong>{p.value}{typeof p.value === 'number' ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function HostDashboard() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'back'
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(90)
  const [bloomsView, setBloomsView] = useState<'bar' | 'radar'>('bar')
  const [compareOpen, setCompareOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?range=${range}`)
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [range])

  useEffect(() => { fetchData() }, [fetchData])

  const s = data?.summary
  const grid = data?.confidenceGrid ?? { sureCorrect: 0, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 }
  const atRiskParticipants = data?.topParticipants.filter(p => p.atRisk) ?? []
  const bloomsTotal = data?.bloomsCoverage.reduce((sum, b) => sum + b.count, 0) ?? 0
  const recommended = bloomsTotal > 0 ? Math.round(bloomsTotal / 6) : 4

  // Radar data needs a numeric `fullMark` for recharts
  const radarData = (data?.bloomsCoverage ?? []).map(b => ({
    level: b.level, count: b.count, recommended,
  }))

  // Question difficulty smart alert
  const hardQuestions = (data?.recentQuestionDifficulty?.questions ?? []).filter(q => q.correctPct < 50)

  // ── Loading state — prevents dashboard flash with zero figures ─────────────
  if (loading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center" style={{ maxWidth: 1280, margin: '0 auto', minHeight: 400 }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-3" style={{ border: '3px solid #E2E8F0', borderTopColor: '#F5E642' }} />
          <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ── Empty-state onboarding for new users ──────────────────────────────────
  if (data && data.summary.totalSessions === 0) {
    return (
      <div className="p-6 md:p-8" style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-8 pb-4">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl md:text-4xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Welcome to Quizotic!
          </h1>
          <p className="text-base md:text-lg max-w-lg mx-auto" style={{ color: '#64748B' }}>
            Let&apos;s get you started with your first live session. Pick one to begin.
          </p>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="mt-3 text-sm underline decoration-dotted hover:decoration-solid font-semibold"
            style={{ color: '#0F1B3D' }}
          >
            Quiz or Slides &mdash; what&apos;s the difference?
          </button>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8 mb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Link href="/host/create" className="block rounded-2xl border p-6 transition-all hover:scale-[1.01] hover:shadow-lg h-full" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: '#F3F4F6' }}>🧠</div>
              <h2 className="text-xl font-black mb-1" style={{ color: '#0F1B3D' }}>Create a Quiz</h2>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#92400E' }}>Scored · timed · leaderboard</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>
                A structured test. Participants answer timed questions, earn points, and compete on a live leaderboard. Bloom&apos;s tagging included.
              </p>
              <span className="btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                Create Quiz
              </span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Link href="/host/present/create" className="block rounded-2xl border p-6 transition-all hover:scale-[1.01] hover:shadow-lg h-full" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: '#E0F2FE' }}>📽</div>
              <h2 className="text-xl font-black mb-1" style={{ color: '#0F1B3D' }}>Create Slides</h2>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#0369A1' }}>Interactive · polls · no scoring</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>
                An interactive deck. Mix content slides with polls, word clouds, ratings, and reactions. <strong>You can also import a PowerPoint file.</strong>
              </p>
              <span className="btn-primary-teal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                Create Slides
              </span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Link href="/host/templates" className="block rounded-2xl border p-6 transition-all hover:scale-[1.01] hover:shadow-lg h-full" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: '#FEF3C7' }}>📚</div>
              <h2 className="text-xl font-black mb-2" style={{ color: '#0F1B3D' }}>Browse Templates</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>
                Start from a pre-built quiz by subject and audience. One click loads it into the editor — edit to fit your content.
              </p>
              <span className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #EA580C, #DC2626)' }}>
                Browse Templates
              </span>
            </Link>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border p-6" style={{ background: '#FAFBFF', borderColor: '#E2E8F0' }}>
          <h3 className="text-base font-black mb-4 text-center" style={{ color: '#0F1B3D' }}>3 Steps to Go Live</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Create', desc: 'Build a quiz or presentation with your content', icon: '✏️' },
              { step: '2', title: 'Host Live', desc: 'Start a session and share the join code with your audience', icon: '📡' },
              { step: '3', title: 'Review', desc: 'See scores, engagement, and insights in your analytics dashboard', icon: '📊' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center p-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white mb-3" style={{ background: '#0F1B3D' }}>
                  {s.step}
                </div>
                <p className="text-sm font-black mb-1" style={{ color: '#0F1B3D' }}>{s.title}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-center text-xs mt-6" style={{ color: '#9CA3AF' }}>
          Your analytics dashboard will appear here once you run your first session.
        </p>

        <QuizVsSlidesModal open={compareOpen} onClose={() => setCompareOpen(false)} />
      </div>
    )
  }

  // Hero: relative time for last session (e.g. "2h ago")
  const lastSession = data?.recentSessions?.[0]
  const lastSessionWhen = (() => {
    if (!lastSession?.date) return ''
    const diffMs = Date.now() - new Date(lastSession.date).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return fmtDate(lastSession.date)
  })()

  return (
    <div className="paper-grain" style={{ background: 'var(--color-paper)', minHeight: '100%' }}>
    <div className="p-6 md:p-8" style={{ maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header — "Welcome back" + search + Create quiz ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[28px] font-black leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Welcome {firstName === 'back' ? 'back' : `back, ${firstName}`}.
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>A calm look at your sessions, participants, and learning outcomes.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative hidden md:block">
            <input
              placeholder="Search quizzes, sessions…"
              className="h-10 pl-9 pr-4 text-[13px] rounded-[10px] w-[260px] outline-none focus:ring-2 focus:ring-yellow-200"
              style={{ background: '#fff', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (v) window.location.href = `/host/sessions?q=${encodeURIComponent(v)}`
                }
              }}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute top-[13px] left-3" style={{ color: 'var(--color-text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <Link href="/host/create" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Create quiz
          </Link>
        </div>
      </div>

      {/* ── Hero: Last session (Tier 3) ── */}
      {lastSession && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
          className="relative overflow-hidden rounded-2xl p-6 md:p-7 mb-5"
          style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #182659 50%, #1F2E6C 100%)', color: '#fff' }}>
          {/* subtle glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background:
              'radial-gradient(800px 400px at 85% 0%, rgba(245,230,66,0.14), transparent 60%),' +
              'radial-gradient(500px 300px at 0% 100%, rgba(96,117,220,0.22), transparent 55%)',
          }} />
          <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-5 items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(245,230,66,0.22)', color: '#F5E642' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F5E642' }} />
                  Last session &middot; {lastSessionWhen}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {lastSession.type}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {lastSession.status === 'ended' ? 'Completed' : lastSession.status}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                {lastSession.title}
              </h2>
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {lastSession.participants} participant{lastSession.participants === 1 ? '' : 's'}
                {lastSession.duration ? ` · ${fmtDuration(lastSession.duration)} runtime` : ''}
              </p>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Link href={lastSession.type === 'quiz' ? '/host/quizzes' : '/host/presentations'}
                  className="btn-golive" style={{ textDecoration: 'none' }}>
                  <span className="play-dot">
                    <svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2.5 h-2.5" aria-hidden><path d="M8 5v14l11-7z"/></svg>
                  </span>
                  Run again
                </Link>
                <Link href="/host/sessions"
                  className="text-xs font-bold px-3.5 py-2 rounded-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', textDecoration: 'none' }}>
                  View session history
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-6 md:min-w-[280px] md:text-center">
              <div>
                <p className="text-2xl md:text-3xl font-black" style={{ fontFamily: 'var(--font-heading)' }}>
                  {lastSession.participants}
                </p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>participants</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#F5E642' }}>
                  {lastSession.avgScore != null ? `${lastSession.avgScore}%` : '—'}
                </p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>avg score</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-black" style={{ fontFamily: 'var(--font-heading)' }}>
                  {lastSession.completionPct != null ? `${lastSession.completionPct}%` : '—'}
                </p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>completion</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── KPI strip — clean label/value/subtitle layout ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: `Sessions (${range}d)`, value: loading ? '—' : s?.totalSessions ?? 0, subtitle: null as string | null },
          { label: 'Participants', value: loading ? '—' : s?.totalParticipants ?? 0, subtitle: null },
          { label: 'Avg score', value: loading ? '—' : s?.avgScore != null ? `${s.avgScore}%` : 'N/A', subtitle: null },
          { label: 'Completion', value: loading ? '—' : s?.completionRate != null ? `${s.completionRate}%` : 'N/A', subtitle: null },
          { label: 'Presentations', value: loading ? '—' : s?.presentationCount ?? 0, subtitle: loading ? null : `${s?.presentationSessionCount ?? 0} sessions run` },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="dash-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</p>
            <p className="text-[26px] font-black leading-tight mt-1.5" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>{kpi.value}</p>
            {kpi.subtitle && <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>{kpi.subtitle}</p>}
          </motion.div>
        ))}
      </div>

      {/* ── Share banner ── */}
      <div className="mb-5">
        <ShareQuizotic context="dashboard" size="sm" />
      </div>

      {/* ── Row 2: Session History (full width — Top Participants moved to bottom) ── */}
      <div className="mb-5">

        {/* Session History — full width */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Session History</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>All your recent quizzes and presentations</p>
              </div>
              <Link href="/host/sessions" className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-50" style={{ color: '#0F1B3D', border: '1px solid #D1D5DB' }}>
                View all →
              </Link>
            </div>
            {loading ? <Spinner /> : data?.recentSessions.length === 0 ? <Empty icon="⚡" text="No sessions yet. Host a quiz to see history here." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['SESSION NAME', 'DATE', 'PARTICIPANTS', 'AVG SCORE', 'COMPLETION', 'STATUS'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentSessions.map((sess) => (
                      <tr key={sess.id} className="border-t hover:bg-slate-50 transition-colors" style={{ borderColor: '#F1F5F9' }}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-sm truncate max-w-[180px]" style={{ color: '#0F1B3D' }}>{sess.title}</p>
                          <span className="text-[10px] font-bold capitalize" style={{ color: sess.type === 'quiz' ? '#0F1B3D' : '#D97706' }}>{sess.type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{fmtDate(sess.date)}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: '#7C3AED' }}>{sess.participants}</td>
                        <td className="px-4 py-3">
                          {sess.avgScore != null
                            ? <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: scoreBg(sess.avgScore), color: scoreColor(sess.avgScore) }}>{sess.avgScore}%</span>
                            : <span className="text-xs" style={{ color: '#CBD5E1' }}>N/A</span>}
                        </td>
                        <td className="px-4 py-3">
                          {sess.completionPct != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                <div className="h-full rounded-full" style={{ width: `${sess.completionPct}%`, background: sess.completionPct >= 80 ? '#16A34A' : '#D97706' }} />
                              </div>
                              <span className="text-xs font-bold" style={{ color: sess.completionPct >= 80 ? '#16A34A' : '#D97706' }}>{sess.completionPct}%</span>
                            </div>
                          ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: sess.status === 'ended' ? '#F0FDF4' : '#FEF3C7', color: sess.status === 'ended' ? '#16A34A' : '#D97706' }}>
                            {sess.status === 'ended' ? 'Completed' : sess.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

      </div>

      {/* ── Row 3: Question Difficulty + Bloom's Coverage + Engagement Score ── */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">

        {/* Hardest questions — sorted ascending by correct %, chip + bar (Tier 4.1 restyle) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Hardest questions</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Correct % · sorted ascending{data?.recentQuestionDifficulty ? ` · ${data.recentQuestionDifficulty.sessionTitle}` : ''}</p>
              </div>
            </div>
            {loading ? <Spinner /> : !data?.recentQuestionDifficulty ? (
              <Empty icon="📊" text="Run a quiz session to see question difficulty analysis" />
            ) : (
              <div className="px-5 py-4 flex-1 space-y-3">
                {[...data.recentQuestionDifficulty.questions]
                  .sort((a, b) => a.correctPct - b.correctPct)
                  .slice(0, 5)
                  .map((q) => {
                    const pct = Math.round(q.correctPct)
                    const chipBg = pct < 50 ? '#FEE2E2' : pct < 65 ? '#FEF3C7' : '#DCFCE7'
                    const chipColor = pct < 50 ? '#B91C1C' : pct < 65 ? '#A16207' : '#15803D'
                    return (
                      <div key={q.index}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className="chip flex-shrink-0" style={{ background: chipBg, color: chipColor }}>{pct}%</span>
                            <span className="text-[13px] font-medium leading-snug" style={{ color: '#0F1B3D' }}>
                              {q.text.length > 90 ? q.text.slice(0, 88) + '…' : q.text}
                            </span>
                          </div>
                          {q.bloomsLevel && (
                            <span className="text-[10px] font-semibold flex-shrink-0 capitalize" style={{ color: 'var(--color-text-muted)' }}>
                              {q.bloomsLevel}
                            </span>
                          )}
                        </div>
                        <div className="h-bar">
                          <span style={{ width: `${q.correctPct}%`, background: diffColor(q.correctPct) }} />
                        </div>
                      </div>
                    )
                  })}
                {hardQuestions.length > 0 && (
                  <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#DC2626' }}>
                      Q{hardQuestions.map(q => q.index + 1).join(', Q')} need{hardQuestions.length === 1 ? 's' : ''} re-teaching — below 50% accuracy
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Bloom's Coverage — Tier 3 redesign: default view is a horizontal
            stacked bar (more decision-useful); radar available via toggle. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Bloom&apos;s Coverage</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Cognitive levels in your sessions</p>
              </div>
              <button
                onClick={() => setBloomsView(bloomsView === 'bar' ? 'radar' : 'bar')}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: '#F3F4F6', color: '#0F1B3D' }}
                title="Toggle chart view"
              >
                {bloomsView === 'bar' ? 'View radar' : 'View bars'}
              </button>
            </div>
            {loading ? <Spinner /> : bloomsTotal === 0 ? (
              <Empty icon="🎓" text="Tag questions with Bloom's levels to see coverage" />
            ) : bloomsView === 'bar' ? (
              <div className="px-5 py-4 flex-1 flex flex-col">
                {/* Stacked bar */}
                {(() => {
                  const palette: Record<string, string> = {
                    Remember: '#60A5FA', Understand: '#3B82F6', Apply: '#F97316',
                    Analyse: '#8B5CF6', Evaluate: '#10B981', Create: '#EC4899',
                  }
                  return (
                    <>
                      <div className="flex h-6 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-paper-2)' }}>
                        {radarData.map(b => {
                          const pct = bloomsTotal > 0 ? (b.count / bloomsTotal) * 100 : 0
                          if (pct === 0) return null
                          return <div key={b.level} style={{ width: `${pct}%`, background: palette[b.level] ?? '#94A3B8' }} title={`${b.level}: ${b.count}`} />
                        })}
                      </div>
                      <div className="mt-3 space-y-1.5 flex-1">
                        {radarData.map(b => {
                          const pct = bloomsTotal > 0 ? Math.round((b.count / bloomsTotal) * 100) : 0
                          return (
                            <div key={b.level} className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: palette[b.level] ?? '#94A3B8' }} />
                              <span className="flex-1 truncate" style={{ color: '#0F1B3D' }}>{b.level}</span>
                              <span className="font-bold" style={{ color: b.count > 0 ? '#0F1B3D' : '#94A3B8' }}>{pct}%</span>
                              <span className="text-[10px] w-12 text-right" style={{ color: '#94A3B8' }}>{b.count} Q{b.count !== 1 ? 's' : ''}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
                {(() => {
                  const remUnder = (radarData.find(b => b.level === 'Remember')?.count ?? 0) + (radarData.find(b => b.level === 'Understand')?.count ?? 0)
                  const remPct = Math.round((remUnder / bloomsTotal) * 100)
                  if (remPct > 70) return (
                    <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>
                        💡 {remPct}% of questions are at Remember/Understand level — add more Apply &amp; Evaluate questions
                      </p>
                    </div>
                  )
                  return null
                })()}
              </div>
            ) : (
              <>
                <div className="px-4 py-2 flex-1">
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="level" tick={{ fontSize: 9, fill: '#64748B', fontWeight: 600 }} />
                      <Radar name="Actual" dataKey="count" stroke="#0F1B3D" fill="#0F1B3D" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Recommended" dataKey="recommended" stroke="#F59E0B" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                      <Tooltip content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="text-xs rounded-lg px-2 py-1.5 shadow-lg border" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
                            <p className="font-bold" style={{ color: '#0F1B3D' }}>{payload[0]?.payload?.level}</p>
                            <p style={{ color: '#0F1B3D' }}>Questions: <strong>{payload[0]?.payload?.count}</strong></p>
                          </div>
                        ) : null
                      } />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                  {radarData.map(b => (
                    <span key={b.level} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: b.count > 0 ? '#F3F4F6' : '#F8FAFC', color: b.count > 0 ? '#0F1B3D' : '#94A3B8' }}>
                      {b.level}: {b.count} Q{b.count !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>

        {/* Engagement heatmap — sessions per day, last 8 weeks (Tier 4 restyle) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Engagement</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Sessions per day · darker = more</p>
            </div>
            {loading ? <Spinner /> : (data?.trend?.length ?? 0) === 0 ? (
              <Empty icon="📈" text="Run quiz sessions to see engagement" />
            ) : (() => {
              // Build 7 × 4 grid (Mon-Sun × last 4 weeks) from daily trend data
              const byDate: Record<string, number> = {}
              data?.trend?.forEach(t => {
                const key = (typeof t.date === 'string' ? t.date : new Date(t.date).toISOString()).slice(0, 10)
                byDate[key] = (byDate[key] ?? 0) + (t.sessions ?? 0)
              })
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              // dayOfWeek: 0 = Monday, 6 = Sunday
              const dayOfWeek = (today.getDay() + 6) % 7
              const weeksToShow = 4
              const startDate = new Date(today)
              startDate.setDate(startDate.getDate() - dayOfWeek - (weeksToShow - 1) * 7)
              const cells: { key: string; day: number; count: number; future: boolean; label: string }[] = []
              for (let w = 0; w < weeksToShow; w++) {
                for (let d = 0; d < 7; d++) {
                  const cd = new Date(startDate)
                  cd.setDate(cd.getDate() + w * 7 + d)
                  const key = cd.toISOString().slice(0, 10)
                  cells.push({
                    key,
                    day: cd.getDate(),
                    count: byDate[key] ?? 0,
                    future: cd > today,
                    label: `${cd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${byDate[key] ?? 0} session${(byDate[key] ?? 0) === 1 ? '' : 's'}`,
                  })
                }
              }
              const heatColor = (c: number, future: boolean) => {
                if (future) return 'transparent'
                if (c === 0) return 'var(--color-paper-2)'
                if (c === 1) return '#BEC8E9'
                if (c <= 3) return '#547BCE'
                if (c <= 5) return '#193B95'
                return '#0F1B3D'
              }
              // Contrast-aware date-number color: dark-text on pale cells, light-text on dark cells
              const dateTextColor = (c: number, future: boolean) => {
                if (future) return 'transparent'
                if (c <= 1) return 'rgba(15, 27, 61, 0.55)' // on paper-2 / pale blue
                return 'rgba(255, 255, 255, 0.78)'          // on medium → dark blue
              }
              const startLabel = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              const endLabel = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              const totalSessions = cells.reduce((s, c) => s + c.count, 0)
              return (
                <div className="px-5 py-4 flex-1 flex flex-col">
                  <div className="grid grid-cols-7 gap-1.5 mb-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <div key={i} className="text-[10px] font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {cells.map(c => (
                      <div
                        key={c.key}
                        className="heat-cell flex items-center justify-center"
                        title={c.future ? '' : c.label}
                        style={{ background: heatColor(c.count, c.future), border: c.future ? '1px dashed var(--color-line)' : 'none' }}
                      >
                        {!c.future && (
                          <span className="text-[10px] font-semibold leading-none" style={{ color: dateTextColor(c.count, c.future) }}>
                            {c.day}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] mt-2 flex items-center justify-between" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{startLabel}</span>
                    <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{totalSessions} session{totalSessions === 1 ? '' : 's'} · 4 weeks</span>
                    <span>{endLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                    <span>less</span>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-paper-2)' }} />
                      <div className="w-3 h-3 rounded-sm" style={{ background: '#BEC8E9' }} />
                      <div className="w-3 h-3 rounded-sm" style={{ background: '#547BCE' }} />
                      <div className="w-3 h-3 rounded-sm" style={{ background: '#193B95' }} />
                      <div className="w-3 h-3 rounded-sm" style={{ background: '#0F1B3D' }} />
                    </div>
                    <span>more</span>
                  </div>
                </div>
              )
            })()}
          </Card>
        </motion.div>
      </div>

      {/* ── Row 4: Performance Trend (full width) ── */}
      <div className="mb-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Performance Trend</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Avg score &amp; participants over time</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {([30, 90, 365] as const).map(d => (
                  <button key={d} onClick={() => setRange(d)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-md transition-all"
                    style={{ background: range === d ? '#0F1B3D' : 'transparent', color: range === d ? '#fff' : '#64748B', border: range === d ? 'none' : '1px solid var(--color-line)' }}>
                    {d === 365 ? '1Y' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
            {loading ? <Spinner /> : data?.trend.length === 0 ? <Empty icon="📈" text="Run sessions to see trend" /> : (
              <div className="px-4 py-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data?.trend.map(t => ({ ...t, label: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="avgScore" stroke="#0F1B3D" strokeWidth={2} dot={{ r: 3, fill: '#0F1B3D' }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="participants" stroke="#7C3AED" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: '#7C3AED' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-5 h-0.5" style={{ background: '#0F1B3D' }} /> Avg Score (%)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#7C3AED' }} /> Participants
                  </span>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Row 5: Confidence grid + At-risk learners ── */}
      <div className="grid md:grid-cols-3 gap-5 mb-6">

        {/* Confidence Grid — 2×2 with axis labels + interpretations (Tier 4.1 restyle) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Confidence grid</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>How sure were they about their answers?</p>
              </div>
              <span className="chip" style={{ background: '#FAF5FF', color: 'var(--color-accent-violet)' }}>Signature metric</span>
            </div>
            {(grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong) === 0 ? (
              <Empty icon="🧠" text="Confidence data appears after quiz sessions" />
            ) : (() => {
              const total = grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong
              const toPct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
              const Cell = ({ label, value, percent, interp, bg, border, color }: { label: string; value: number; percent: number; interp: string; bg: string; border: string; color: string }) => (
                <div className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</div>
                  <div className="text-[24px] font-black leading-tight mt-1" style={{ color, fontFamily: 'var(--font-heading)' }}>{value}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{percent}% · {interp}</div>
                </div>
              )
              // Explicit 3-col × 3-row grid. Each axis label is placed INTO the row
              // it labels so it vertically centers via `items-center` on the grid.
              const axisLabelStyle = { color: 'var(--color-text-muted)', whiteSpace: 'nowrap' as const }
              return (
                <div
                  className="p-4 flex-1 grid gap-2"
                  style={{
                    gridTemplateColumns: 'auto 1fr 1fr',
                    gridTemplateRows: '1fr 1fr auto',
                    alignItems: 'center',
                  }}
                >
                  {/* Row 1: Sure */}
                  <div className="text-[11px] pr-2 text-right font-semibold" style={axisLabelStyle}>Sure →</div>
                  <Cell label="SURE · CORRECT" value={grid.sureCorrect} percent={toPct(grid.sureCorrect)} interp="mastery" bg="#F0FDF4" border="#BBF7D0" color="#166534" />
                  <Cell label="SURE · WRONG" value={grid.sureWrong} percent={toPct(grid.sureWrong)} interp="re-teach" bg="#FEF2F2" border="#FECACA" color="#B91C1C" />
                  {/* Row 2: Unsure */}
                  <div className="text-[11px] pr-2 text-right font-semibold" style={axisLabelStyle}>Unsure →</div>
                  <Cell label="UNSURE · CORRECT" value={grid.unsureCorrect} percent={toPct(grid.unsureCorrect)} interp="reinforce" bg="#EFF6FF" border="#BFDBFE" color="#1D4ED8" />
                  <Cell label="UNSURE · WRONG" value={grid.unsureWrong} percent={toPct(grid.unsureWrong)} interp="normal" bg="#FFF7ED" border="#FED7AA" color="#C2410C" />
                  {/* Row 3: column footers */}
                  <div />
                  <div className="text-[10px] text-center font-semibold pt-1" style={{ color: 'var(--color-text-muted)' }}>Correct</div>
                  <div className="text-[10px] text-center font-semibold pt-1" style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
                </div>
              )
            })()}
          </Card>
        </motion.div>

        {/* At-risk learners — standalone card (Tier 4.1) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>At-risk learners</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Flagged across recent sessions</p>
              </div>
              {atRiskParticipants.length > 0 && (
                <span className="chip" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                  {atRiskParticipants.length} flagged
                </span>
              )}
            </div>
            {atRiskParticipants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: '#DCFCE7' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>No one at risk — everyone&apos;s keeping up.</p>
              </div>
            ) : (
              <div className="p-3 space-y-2 flex-1">
                {atRiskParticipants.slice(0, 4).map((p, i) => (
                  <div key={p.name + i} className="flex items-start gap-3 p-2 rounded-[10px]" style={{ background: 'var(--color-paper)' }}>
                    <AvatarCircle name={p.name} index={i} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold truncate" style={{ color: '#0F1B3D' }}>{p.name}</div>
                      <div className="text-[11px]" style={{ color: '#C2410C' }}>
                        Avg {Math.round(p.avgScore)}% across {p.sessions} session{p.sessions === 1 ? '' : 's'} · may need follow-up
                      </div>
                    </div>
                  </div>
                ))}
                {atRiskParticipants.length > 4 && (
                  <p className="text-[11px] text-center pt-1" style={{ color: 'var(--color-text-muted)' }}>
                    +{atRiskParticipants.length - 4} more
                  </p>
                )}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Row 6: Top participants — full-width table at the bottom (Tier 4.3) ── */}
      {(data?.topParticipants?.length ?? 0) > 0 && (() => {
        // Archetype derivation: prefer backend `archetype`, else derive from score + trend + variance
        type Arch = { label: string; bg: string; color: string }
        const deriveArchetype = (p: AnalyticsData['topParticipants'][number]): Arch => {
          if (p.atRisk || p.avgScore < 50) return { label: 'At risk', bg: '#FEE2E2', color: '#B91C1C' }
          if (p.avgScore >= 80 && (p.scoreChange == null || Math.abs(p.scoreChange) < 3)) return { label: 'Steady achiever', bg: '#DCFCE7', color: '#15803D' }
          if (p.scoreChange != null && p.scoreChange > 5) return { label: 'Late bloomer', bg: '#EFF6FF', color: '#1D4ED8' }
          if (p.scores.length >= 3) {
            const avg = p.scores.reduce((a, b) => a + b, 0) / p.scores.length
            const meanDev = p.scores.reduce((s, x) => s + Math.abs(x - avg), 0) / p.scores.length
            const range = Math.max(...p.scores) - Math.min(...p.scores)
            if (meanDev > 10 && range > 20) return { label: 'Wobbly', bg: '#FFF7ED', color: '#C2410C' }
          }
          return { label: 'Consistent', bg: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }
        }
        const archetypeFromLabel = (label: string): Arch => {
          const m = label.toLowerCase()
          if (m.includes('risk')) return { label, bg: '#FEE2E2', color: '#B91C1C' }
          if (m.includes('steady') || m.includes('achiev')) return { label, bg: '#DCFCE7', color: '#15803D' }
          if (m.includes('late') || m.includes('bloom')) return { label, bg: '#EFF6FF', color: '#1D4ED8' }
          if (m.includes('wobbl')) return { label, bg: '#FFF7ED', color: '#C2410C' }
          return { label, bg: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }
        }
        // avgScore is raw Kahoot-style points per participant — we can't chip-color it without a max,
        // but we CAN tint the text by comparing against the cohort median to flag relative outliers.
        const scores = (data?.topParticipants ?? []).map(p => p.avgScore).sort((a, b) => a - b)
        const cohortMedian = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0
        const cohortScoreColor = (s: number) => {
          if (cohortMedian === 0) return '#0F1B3D'
          const ratio = s / cohortMedian
          if (ratio >= 1.1) return '#15803D' // clearly above median
          if (ratio <= 0.7) return '#B91C1C' // clearly below median
          return '#0F1B3D'
        }
        return (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} className="mb-6">
            <Card>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                <div>
                  <h2 className="text-base font-black" style={{ color: '#0F1B3D' }}>Top participants</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Across the last {range} days · sparklines show per-session score</p>
                </div>
                <Link href="/host/participants" className="chip" style={{ background: 'var(--color-paper-2)', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
                  Full roster →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Participant</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Archetype</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Sessions</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Avg score</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topParticipants.map((p, i) => {
                      const arch = p.archetype ? archetypeFromLabel(p.archetype) : deriveArchetype(p)
                      return (
                        <tr key={`${p.name}-${i}`} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <AvatarCircle name={p.name} index={i} />
                              <span className="font-semibold" style={{ color: '#0F1B3D' }}>{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="chip" style={{ background: arch.bg, color: arch.color }}>{arch.label}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-ink)' }}>{p.sessions}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold" style={{ color: cohortScoreColor(p.avgScore) }}>
                              {p.avgScore.toLocaleString('en-IN')}
                              <span className="text-[10px] font-semibold ml-1" style={{ color: 'var(--color-text-muted)' }}>pts</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Sparkline scores={p.scores} />
                              <ScoreChange change={p.scoreChange} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )
      })()}

      {/* ── Quick actions ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border"
        style={{ background: '#F3F4F6', borderColor: '#D1D5DB' }}>
        <div>
          <p className="text-base font-black" style={{ color: '#0F1B3D' }}>Ready to run your next session?</p>
          <p className="text-sm mt-0.5" style={{ color: '#374151' }}>
            <strong style={{ color: '#92400E' }}>Quiz</strong> for a scored test &middot;{' '}
            <strong style={{ color: '#0369A1' }}>Slides</strong> for an interactive presentation.{' '}
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="underline decoration-dotted hover:decoration-solid font-semibold"
              style={{ color: '#0F1B3D' }}
            >
              What&apos;s the difference?
            </button>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0 flex-wrap justify-center">
          <Link href="/host/create" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Create Quiz
          </Link>
          <Link href="/host/present/create" className="btn-primary-teal" style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Create Slides
          </Link>
          <Link href="/host/templates" className="btn-ghost" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)' }}>
            Browse templates
          </Link>
        </div>
      </motion.div>

      {/* Quiz vs Slides comparison modal */}
      <QuizVsSlidesModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
    </div>
  )
}
