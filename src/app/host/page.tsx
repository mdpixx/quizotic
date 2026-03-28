'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loadQuizzes, deleteQuiz, setActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

// ─── Session history types ────────────────────────────────────────────────────
interface SessionRecord {
  id: string
  quizId: string
  quizTitle: string
  date: string       // ISO string
  playerCount: number
  avgScore: number   // 0–100
  duration: number   // seconds
}

function loadSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('quizotic_sessions') || '[]')
  } catch { return [] }
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, sub, color }: {
  value: string | number; label: string; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: '#fff', borderColor: '#E9E2FF' }}>
      <p className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color }}>
        {value}
      </p>
      <p className="text-sm font-semibold" style={{ color: '#1E1B4B' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
    </div>
  )
}

// ─── Quiz card (shared between tabs) ─────────────────────────────────────────
function QuizCard({
  quiz,
  sessionCount,
  onStart,
  onEdit,
  onDelete,
}: {
  quiz: Quiz
  sessionCount: number
  onStart: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const created = quiz.createdAt
    ? new Date(quiz.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : 'Unknown date'

  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4 hover:shadow-md transition-all"
      style={{ background: '#fff', borderColor: '#E9E2FF' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: '#F3EEFF' }}>
        📋
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold truncate text-sm" style={{ color: '#1E1B4B' }}>{quiz.title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
          {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
          {quiz.subject ? ` · ${quiz.subject}` : ''}
          {' · '}{sessionCount} session{sessionCount !== 1 ? 's' : ''}
          {' · '}{created}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-violet-50"
          style={{ color: '#6B7280', borderColor: '#E9E2FF' }}>
          Edit
        </button>
        <button onClick={onDelete}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:text-red-500"
          style={{ color: '#9CA3AF' }}>
          Delete
        </button>
        <button onClick={onStart}
          className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.03]"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
          Start →
        </button>
      </div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'quizzes' | 'analytics'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HostDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [search, setSearch] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    setQuizzes(loadQuizzes())
    setSessions(loadSessions())
    setBannerDismissed(localStorage.getItem('quizotic_welcome_dismissed') === 'true')
  }, [])

  function dismissBanner() {
    localStorage.setItem('quizotic_welcome_dismissed', 'true')
    setBannerDismissed(true)
  }

  function handleDelete(id: string) {
    deleteQuiz(id)
    setQuizzes(loadQuizzes())
  }

  function handleStart(quiz: Quiz) {
    setActiveSession(quiz)
    router.push('/host/session')
  }

  function handleEdit(quiz: Quiz) {
    // Pass quiz id in URL for edit mode — create page can pick it up
    router.push(`/host/create?edit=${quiz.id}`)
  }

  // Per-quiz session count
  const sessionsByQuiz = useMemo(() => {
    const map: Record<string, number> = {}
    sessions.forEach(s => { map[s.quizId] = (map[s.quizId] || 0) + 1 })
    return map
  }, [sessions])

  // Stats
  const totalPlayers = sessions.reduce((s, r) => s + r.playerCount, 0)
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.avgScore, 0) / sessions.length)
    : 0

  // Filtered quizzes
  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    (q.subject || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── DASHBOARD TAB ──────────────────────────────────────────────────────────
  function DashboardTab() {
    const recent = quizzes.slice(0, 3)

    return (
      <div className="space-y-8">
        {/* Welcome banner — shown for new users until dismissed */}
        {quizzes.length === 0 && !bannerDismissed && (
          <div className="rounded-2xl p-6 relative" style={{ background: '#F3EEFF', border: '1.5px solid #C4B5FD' }}>
            <button onClick={dismissBanner}
              className="absolute top-4 right-4 text-base leading-none transition-opacity hover:opacity-60"
              style={{ color: '#9CA3AF' }} aria-label="Dismiss">
              ✕
            </button>
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>
              getting started
            </p>
            <div className="flex flex-col sm:flex-row gap-5 pr-6">
              {[
                {
                  num: '1',
                  title: 'Create your first quiz',
                  desc: 'Build from scratch or let AI do it from any URL or topic.',
                  action: () => router.push('/host/create'),
                  cta: 'Create now →',
                },
                {
                  num: '2',
                  title: 'Start a live session',
                  desc: 'Each session generates a unique game code for your class.',
                },
                {
                  num: '3',
                  title: 'Share the code',
                  desc: 'Participants join at quizotic.net — no app install needed.',
                },
              ].map(step => (
                <div key={step.num} className="flex-1 flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                    style={{ background: '#7C3AED', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                    {step.num}
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#1E1B4B' }}>{step.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>{step.desc}</p>
                    {step.action && (
                      <button onClick={step.action}
                        className="text-xs font-bold mt-1.5 transition-opacity hover:opacity-70"
                        style={{ color: '#7C3AED' }}>
                        {step.cta}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard value={quizzes.length} label="Quizzes" sub="in your library" color="#7C3AED" />
          <StatCard value={sessions.length} label="Sessions run" sub="all time" color="#EC4899" />
          <StatCard value={totalPlayers} label="Participants" sub="total across sessions" color="#F59E0B" />
          <StatCard value={sessions.length ? `${avgScore}%` : '—'} label="Avg score" sub="across all sessions" color="#6B7280" />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: '#a8a29e' }}>
            quick actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: '✦', title: 'Create with AI', desc: 'Paste a URL or topic — AI builds the quiz',
                action: () => router.push('/host/create?tab=ai-topic'),
                bg: 'linear-gradient(135deg,#7C3AED,#EC4899)', titleColor: '#fff', descColor: 'rgba(255,255,255,0.75)',
              },
              {
                icon: '⊞', title: 'Browse Templates', desc: '8 ready-made templates — edit to fit your content',
                action: () => router.push('/host/templates'),
                bg: '#F3EEFF', titleColor: '#1E1B4B', descColor: '#6B7280',
              },
              {
                icon: '✏', title: 'Blank quiz', desc: 'Start from scratch with your own questions',
                action: () => router.push('/host/create'),
                bg: '#FAFAFE', titleColor: '#1E1B4B', descColor: '#6B7280',
              },
              {
                icon: '★', title: 'Join a game', desc: 'Enter a code to join a live quiz as a player',
                action: () => router.push('/join'),
                bg: '#FEF3C7', titleColor: '#1E1B4B', descColor: '#92400E',
              },
            ].map(item => (
              <button key={item.title} onClick={item.action}
                className="rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
                style={{ background: item.bg }}>
                <span className="text-3xl mb-3 block" style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{item.icon}</span>
                <p className="font-black text-base mb-1" style={{ color: item.titleColor, fontFamily: 'var(--font-heading)' }}>{item.title}</p>
                <p className="text-sm font-medium" style={{ color: item.descColor }}>{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent quizzes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#a8a29e' }}>
              recent quizzes
            </h2>
            {quizzes.length > 3 && (
              <button onClick={() => setTab('quizzes')}
                className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#7C3AED' }}>
                see all {quizzes.length} →
              </button>
            )}
          </div>
          {quizzes.length === 0 ? (
            <div className="rounded-2xl border p-10 text-center" style={{ borderColor: '#E9E2FF' }}>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>No quizzes yet.</p>
              <button onClick={() => router.push('/host/create')}
                className="mt-3 text-sm font-bold px-5 py-2 rounded-full"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                Create your first →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map(q => (
                <QuizCard key={q.id} quiz={q}
                  sessionCount={sessionsByQuiz[q.id] || 0}
                  onStart={() => handleStart(q)}
                  onEdit={() => handleEdit(q)}
                  onDelete={() => handleDelete(q.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent session activity */}
        {sessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#a8a29e' }}>
                recent activity
              </h2>
              <button onClick={() => setTab('analytics')}
                className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#7C3AED' }}>
                full analytics →
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 4).map(s => (
                <div key={s.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
                  style={{ background: '#fff', borderColor: '#E9E2FF' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1E1B4B' }}>{s.quizTitle}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' · '}{s.playerCount} player{s.playerCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>{s.avgScore}%</p>
                    <p className="text-[10px]" style={{ color: '#9CA3AF' }}>avg score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── MY QUIZZES TAB ─────────────────────────────────────────────────────────
  function QuizzesTab() {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by title or subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-violet-400 transition-colors"
            style={{ borderColor: '#E9E2FF', color: '#1E1B4B', background: '#fff' }}
          />
          <button
            onClick={() => router.push('/host/create')}
            className="text-sm font-bold px-6 py-2.5 rounded-xl flex-shrink-0 transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            + new quiz
          </button>
        </div>

        {filteredQuizzes.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '#E9E2FF' }}>
            <p className="text-sm mb-3" style={{ color: '#9CA3AF' }}>
              {search ? `No quizzes matching "${search}"` : 'No quizzes yet.'}
            </p>
            {!search && (
              <button onClick={() => router.push('/host/create')}
                className="text-sm font-bold px-5 py-2 rounded-full"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                Create your first →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuizzes.map(q => (
              <QuizCard key={q.id} quiz={q}
                sessionCount={sessionsByQuiz[q.id] || 0}
                onStart={() => handleStart(q)}
                onEdit={() => handleEdit(q)}
                onDelete={() => handleDelete(q.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── ANALYTICS TAB ──────────────────────────────────────────────────────────
  function AnalyticsTab() {
    if (sessions.length === 0) {
      return (
        <div className="rounded-2xl border p-16 text-center" style={{ borderColor: '#E9E2FF' }}>
          <p className="text-2xl mb-3">📊</p>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1E1B4B' }}>No sessions yet</p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Run a live quiz — your analytics will appear here after the session ends.
          </p>
        </div>
      )
    }

    // Per-quiz analytics summary
    const quizStats = quizzes.map(q => {
      const qSessions = sessions.filter(s => s.quizId === q.id)
      const avgScoreQ = qSessions.length
        ? Math.round(qSessions.reduce((s, r) => s + r.avgScore, 0) / qSessions.length)
        : 0
      const totalPlayersQ = qSessions.reduce((s, r) => s + r.playerCount, 0)
      return { quiz: q, sessions: qSessions, avgScore: avgScoreQ, totalPlayers: totalPlayersQ }
    }).filter(x => x.sessions.length > 0)

    return (
      <div className="space-y-8">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard value={sessions.length} label="Total sessions" color="#7C3AED" />
          <StatCard value={totalPlayers} label="Total players" color="#F59E0B" />
          <StatCard value={`${avgScore}%`} label="Overall avg score" color="#EC4899" />
          <StatCard value={quizStats.length} label="Quizzes with data" color="#7C3AED" />
        </div>

        {/* Per-quiz breakdown */}
        {quizStats.length > 0 && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
              per-quiz performance
            </h2>
            <div className="space-y-3">
              {quizStats.map(({ quiz, sessions: qSessions, avgScore: qAvg, totalPlayers: qPlayers }) => (
                <div key={quiz.id} className="rounded-2xl border p-5" style={{ background: '#fff', borderColor: '#E9E2FF' }}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: '#1E1B4B' }}>{quiz.title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                        {quiz.questions.length} questions · {qSessions.length} session{qSessions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: qAvg >= 70 ? '#7C3AED' : qAvg >= 50 ? '#F59E0B' : '#dc2626' }}>
                        {qAvg}%
                      </p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>avg score</p>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: '#F3EEFF' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${qAvg}%`,
                        background: qAvg >= 70 ? 'linear-gradient(90deg,#7C3AED,#EC4899)' : qAvg >= 50 ? '#F59E0B' : '#dc2626',
                      }} />
                  </div>
                  <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{qPlayers} total participants</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session history table */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
            session history
          </h2>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E9E2FF' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F3EEFF', borderBottom: '1px solid #E9E2FF' }}>
                  {['Quiz', 'Date', 'Players', 'Avg Score', 'Duration'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                      style={{ color: '#9CA3AF' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid #F3EEFF' : undefined }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#1E1B4B' }}>
                      <span className="truncate block max-w-[200px]">{s.quizTitle}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#6B7280' }}>
                      {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#1E1B4B' }}>{s.playerCount}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: s.avgScore >= 70 ? '#7C3AED' : s.avgScore >= 50 ? '#F59E0B' : '#dc2626' }}>
                        {s.avgScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#6B7280' }}>
                      {s.duration > 0 ? `${Math.round(s.duration / 60)}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'quizzes', label: 'My Quizzes' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFE', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b"
        style={{ background: 'rgba(250,250,254,0.95)', backdropFilter: 'blur(8px)', borderColor: '#E9E2FF' }}>
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
            Quizo<span style={{ color: '#7C3AED' }}>tic</span>
          </a>

          {/* Tab navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: tab === t.id ? '#F3EEFF' : 'transparent',
                  color: tab === t.id ? '#7C3AED' : '#6B7280',
                }}>
                {t.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => router.push('/host/create')}
            className="text-sm font-bold px-5 py-2 rounded-full transition-all hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            + New Quiz
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex border-t" style={{ borderColor: '#E9E2FF' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-xs font-bold transition-colors"
              style={{
                color: tab === t.id ? '#7C3AED' : '#9CA3AF',
                borderBottom: tab === t.id ? '2px solid #7C3AED' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Tab title */}
        <div className="mb-7">
          <h1 className="text-2xl font-black lowercase" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
            {tab === 'dashboard' && 'dashboard'}
            {tab === 'quizzes' && `my quizzes (${quizzes.length})`}
            {tab === 'analytics' && 'analytics'}
          </h1>
          {tab === 'dashboard' && (
            <p className="text-sm mt-1" style={{ color: '#a8a29e' }}>
              {quizzes.length === 0 ? 'Welcome to Quizotic.' : 'Welcome back.'} Here&apos;s your quiz activity at a glance.
            </p>
          )}
        </div>

        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'quizzes' && <QuizzesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </main>
    </div>
  )
}
