'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  summary: { totalSessions: number; totalParticipants: number; avgScore: number | null; completionRate: number | null }
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
const AVATAR_COLORS = ['#4361EE', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9']
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
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#4361EE', borderTopColor: 'transparent' }} />
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
      <p className="font-bold mb-1" style={{ color: '#1B2559' }}>{label}</p>
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
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(90)

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

  // ── Empty-state onboarding for new users ──────────────────────────────────
  if (!loading && data && data.summary.totalSessions === 0) {
    return (
      <div className="p-6 md:p-8" style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-8 pb-4">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl md:text-4xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Welcome to Quizotic!
          </h1>
          <p className="text-base md:text-lg max-w-lg mx-auto" style={{ color: '#64748B' }}>
            Let&apos;s get you started with your first live session. Pick one to begin.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 mt-8 mb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Link href="/host/create" className="block rounded-2xl border p-6 transition-all hover:scale-[1.01] hover:shadow-lg" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: '#EEF2FF' }}>🧠</div>
              <h2 className="text-xl font-black mb-2" style={{ color: '#1B2559' }}>Create a Quiz</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>
                Build an interactive quiz with multiple question types, timers, and Bloom&apos;s taxonomy tagging. Perfect for classrooms and training sessions.
              </p>
              <span className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ background: 'var(--brand-gradient)' }}>
                + Create Quiz
              </span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Link href="/host/present/create" className="block rounded-2xl border p-6 transition-all hover:scale-[1.01] hover:shadow-lg" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: '#F0FDFA' }}>📽</div>
              <h2 className="text-xl font-black mb-2" style={{ color: '#1B2559' }}>Create a Presentation</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#64748B' }}>
                Build interactive slides with polls, word clouds, and Q&amp;A for live engagement. Great for meetings and workshops.
              </p>
              <span className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #0EA5E9, #06B6D4)' }}>
                + Create Slides
              </span>
            </Link>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border p-6" style={{ background: '#FAFBFF', borderColor: '#E2E8F0' }}>
          <h3 className="text-base font-black mb-4 text-center" style={{ color: '#1B2559' }}>3 Steps to Go Live</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Create', desc: 'Build a quiz or presentation with your content', icon: '✏️' },
              { step: '2', title: 'Host Live', desc: 'Start a session and share the join code with your audience', icon: '📡' },
              { step: '3', title: 'Review', desc: 'See scores, engagement, and insights in your analytics dashboard', icon: '📊' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center p-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white mb-3" style={{ background: 'var(--brand-gradient)' }}>
                  {s.step}
                </div>
                <p className="text-sm font-black mb-1" style={{ color: '#1B2559' }}>{s.title}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8" style={{ maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>Track your sessions, participants and learning outcomes</p>
        </div>
        <div className="flex gap-1.5">
          {([30, 90, 365] as const).map(d => (
            <button key={d} onClick={() => setRange(d)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: range === d ? '#4361EE' : '#F0F4FF', color: range === d ? '#fff' : '#4361EE' }}>
              {d === 365 ? '1 Year' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: '⚡', label: 'Total Sessions', value: loading ? '—' : s?.totalSessions ?? 0, color: '#4361EE' },
          { icon: '👥', label: 'Participants', value: loading ? '—' : s?.totalParticipants ?? 0, color: '#7C3AED' },
          { icon: '🎯', label: 'Avg Score', value: loading ? '—' : s?.avgScore != null ? `${s.avgScore}%` : 'N/A', color: '#D97706' },
          { icon: '✅', label: 'Completion Rate', value: loading ? '—' : s?.completionRate != null ? `${s.completionRate}%` : 'N/A', color: '#059669' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-4 border flex items-center gap-3" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${kpi.color}18` }}>{kpi.icon}</div>
            <div>
              <p className="text-2xl font-black leading-tight" style={{ fontFamily: 'var(--font-heading)', color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#64748B' }}>{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Row 2: Session History + Top Participants ── */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">

        {/* Session History — 2/3 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2">
          <Card>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Session History</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>All your recent quizzes and presentations</p>
              </div>
              <Link href="/host/sessions" className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-blue-50" style={{ color: '#4361EE', border: '1px solid #C7D7FD' }}>
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
                          <p className="font-bold text-sm truncate max-w-[180px]" style={{ color: '#1B2559' }}>{sess.title}</p>
                          <span className="text-[10px] font-bold capitalize" style={{ color: sess.type === 'quiz' ? '#4361EE' : '#D97706' }}>{sess.type}</span>
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

        {/* Top Participants — 1/3 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Top Participants</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Tracked across all sessions by name</p>
              </div>
            </div>
            {loading ? <Spinner /> : data?.topParticipants.length === 0 ? (
              <Empty icon="👥" text="Participant data appears after quiz sessions" />
            ) : (
              <div className="px-4 py-3 space-y-3 flex-1">
                {data?.topParticipants.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <AvatarCircle name={p.name} index={i} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: '#1B2559' }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                        {p.sessions} session{p.sessions !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <Sparkline scores={p.scores} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black" style={{ color: scoreColor(p.avgScore) }}>{p.avgScore}%</span>
                        <ScoreChange change={p.scoreChange} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* At-risk alert */}
            {atRiskParticipants.length > 0 && (
              <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <p className="text-xs font-bold mb-0.5" style={{ color: '#C2410C' }}>
                  ⚠ {atRiskParticipants.length} participant{atRiskParticipants.length > 1 ? 's' : ''} scored below 60% twice in a row
                </p>
                <p className="text-[10px]" style={{ color: '#EA580C' }}>
                  {atRiskParticipants.map(p => p.name).join(', ')} — may need follow-up
                </p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Row 3: Question Difficulty + Bloom's Coverage + Engagement Score ── */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">

        {/* Question Difficulty */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Question Difficulty</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>% of participants who got each question correct</p>
              </div>
              {data?.recentQuestionDifficulty && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg truncate max-w-[100px]" style={{ background: '#EEF2FF', color: '#4361EE' }}>
                  {data.recentQuestionDifficulty.sessionTitle}
                </span>
              )}
            </div>
            {loading ? <Spinner /> : !data?.recentQuestionDifficulty ? (
              <Empty icon="📊" text="Run a quiz session to see question difficulty analysis" />
            ) : (
              <div className="px-5 py-4 flex-1 space-y-2">
                {data.recentQuestionDifficulty.questions.slice(0, 7).map((q) => (
                  <div key={q.index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium truncate max-w-[160px]" style={{ color: '#1B2559' }}>
                        Q{q.index + 1} — {q.text.slice(0, 20)}{q.text.length > 20 ? '…' : ''}
                      </span>
                      <span className="text-[11px] font-black" style={{ color: diffColor(q.correctPct) }}>{Math.round(q.correctPct)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${q.correctPct}%`, background: diffColor(q.correctPct) }} />
                    </div>
                  </div>
                ))}
                {hardQuestions.length > 0 && (
                  <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#DC2626' }}>
                      🔴 Q{hardQuestions.map(q => q.index + 1).join(', Q')} need{hardQuestions.length === 1 ? 's' : ''} re-teaching — below 50% accuracy
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Bloom's Coverage */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Bloom&apos;s Coverage</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Cognitive levels in your sessions</p>
            </div>
            {loading ? <Spinner /> : bloomsTotal === 0 ? (
              <Empty icon="🎓" text="Tag questions with Bloom's levels to see coverage" />
            ) : (
              <>
                <div className="px-4 py-2 flex-1">
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="level" tick={{ fontSize: 9, fill: '#64748B', fontWeight: 600 }} />
                      <Radar name="Actual" dataKey="count" stroke="#4361EE" fill="#4361EE" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Recommended" dataKey="recommended" stroke="#F59E0B" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                      <Tooltip content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="text-xs rounded-lg px-2 py-1.5 shadow-lg border" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
                            <p className="font-bold" style={{ color: '#1B2559' }}>{payload[0]?.payload?.level}</p>
                            <p style={{ color: '#4361EE' }}>Questions: <strong>{payload[0]?.payload?.count}</strong></p>
                          </div>
                        ) : null
                      } />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                  {radarData.map(b => (
                    <span key={b.level} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: b.count > 0 ? '#EEF2FF' : '#F8FAFC', color: b.count > 0 ? '#4361EE' : '#94A3B8' }}>
                      {b.level}: {b.count} Q{b.count !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
                {bloomsTotal > 0 && (() => {
                  const remUnder = (radarData.find(b => b.level === 'Remember')?.count ?? 0) + (radarData.find(b => b.level === 'Understand')?.count ?? 0)
                  const higherOrder = (radarData.find(b => b.level === 'Apply')?.count ?? 0) + (radarData.find(b => b.level === 'Analyse')?.count ?? 0) + (radarData.find(b => b.level === 'Evaluate')?.count ?? 0) + (radarData.find(b => b.level === 'Create')?.count ?? 0)
                  const remPct = Math.round((remUnder / bloomsTotal) * 100)
                  if (remPct > 70) return (
                    <div className="mx-5 mb-4 px-3 py-2 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <p className="text-[10px] font-medium" style={{ color: '#92400E' }}>
                        💡 {remPct}% of questions are at Remember/Understand level — add more Apply &amp; Evaluate questions
                      </p>
                    </div>
                  )
                  return null
                })()}
              </>
            )}
          </Card>
        </motion.div>

        {/* Engagement Score */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Engagement Score</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Per-session engagement breakdown</p>
            </div>
            {loading ? <Spinner /> : data?.engagementTrend.length === 0 ? (
              <Empty icon="📈" text="Run quiz sessions to see engagement trends" />
            ) : (
              <>
                <div className="px-3 py-3 flex-1">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data?.engagementTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <YAxis domain={[50, 105]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="completionPct" fill="#4361EE" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      <Bar dataKey="confidencePct" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 pb-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#4361EE' }} /> Completion %
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#F59E0B' }} /> Confidence %
                  </span>
                </div>
                <div className="px-5 pb-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: '#F1F5F9' }}>
                  {[
                    { label: 'Avg Completion', value: data?.engagementTrend.length ? `${Math.round(data.engagementTrend.reduce((s, e) => s + e.completionPct, 0) / data.engagementTrend.length)}%` : '—', color: '#4361EE' },
                    { label: 'Avg Confidence', value: (() => { const vals = data?.engagementTrend.filter(e => e.confidencePct != null) ?? []; return vals.length ? `${Math.round(vals.reduce((s, e) => s + (e.confidencePct ?? 0), 0) / vals.length)}%` : '—' })(), color: '#F59E0B' },
                    { label: 'Sessions', value: data?.engagementTrend.length ?? 0, color: '#7C3AED' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <p className="text-base font-black" style={{ color: stat.color, fontFamily: 'var(--font-heading)' }}>{stat.value}</p>
                      <p className="text-[9px] font-semibold" style={{ color: '#94A3B8' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Row 4: Performance Trend + Confidence Grid ── */}
      <div className="grid md:grid-cols-3 gap-5 mb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="md:col-span-2">
          <Card>
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Performance Trend</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Avg score &amp; participants over time</p>
            </div>
            {loading ? <Spinner /> : data?.trend.length === 0 ? <Empty icon="📈" text="Run sessions to see trend" /> : (
              <div className="px-4 py-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data?.trend.map(t => ({ ...t, label: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="avgScore" stroke="#4361EE" strokeWidth={2} dot={{ r: 3, fill: '#4361EE' }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="participants" stroke="#7C3AED" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: '#7C3AED' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-5 h-0.5" style={{ background: '#4361EE' }} /> Avg Score (%)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#7C3AED' }} /> Participants
                  </span>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Confidence Grid */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="h-full flex flex-col">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
              <h2 className="text-base font-black" style={{ color: '#1B2559' }}>Confidence Grid</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Aggregated across all sessions</p>
            </div>
            {(grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong) === 0 ? (
              <Empty icon="🧠" text="Confidence data appears after quiz sessions" />
            ) : (
              <div className="p-4 flex-1">
                <div className="grid grid-cols-2 gap-1 mb-1 text-center">
                  <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>Correct</p>
                  <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>Wrong</p>
                </div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#64748B' }}>Sure</p>
                <div className="grid grid-cols-2 gap-1 mb-1">
                  {[
                    { val: grid.sureCorrect, bg: '#DCFCE7', color: '#16A34A', tip: 'Solid knowledge' },
                    { val: grid.sureWrong, bg: '#FEF3C7', color: '#D97706', tip: 'Dangerous misconception' },
                  ].map((cell, i) => (
                    <div key={i} className="flex flex-col items-center justify-center rounded-xl py-3" style={{ background: cell.bg }}>
                      <span className="text-xl font-black" style={{ color: cell.color }}>{cell.val}</span>
                      <span className="text-[9px] font-semibold mt-0.5" style={{ color: cell.color }}>{cell.tip}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#64748B' }}>Unsure</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { val: grid.unsureCorrect, bg: '#F0FDF4', color: '#4ADE80', tip: 'Lucky guess' },
                    { val: grid.unsureWrong, bg: '#F8FAFC', color: '#94A3B8', tip: 'Aware of gaps' },
                  ].map((cell, i) => (
                    <div key={i} className="flex flex-col items-center justify-center rounded-xl py-3" style={{ background: cell.bg }}>
                      <span className="text-xl font-black" style={{ color: cell.color }}>{cell.val}</span>
                      <span className="text-[9px] font-semibold mt-0.5" style={{ color: cell.color }}>{cell.tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Quick actions ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border"
        style={{ background: '#EEF2FF', borderColor: '#C7D7FD' }}>
        <div>
          <p className="text-base font-black" style={{ color: '#1B2559' }}>Ready to run your next session?</p>
          <p className="text-sm mt-0.5" style={{ color: '#4A5568' }}>Create a quiz or presentation and host it live in minutes.</p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Link href="/host/create" className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: 'var(--brand-gradient)', color: '#fff' }}>+ Create Quiz</Link>
          <Link href="/host/present/create" className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: '#fff', color: '#4361EE', border: '1.5px solid #4361EE' }}>+ Create Slides</Link>
        </div>
      </motion.div>
    </div>
  )
}
