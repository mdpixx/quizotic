'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { loadQuizzes, deleteQuiz, saveQuiz, setActiveSession } from '@/lib/quiz-storage'
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

// ─── Presentation session history types ──────────────────────────────────────
interface PresentationSessionRecord {
  id: string
  presentationId: string
  presentationTitle: string
  date: string
  participantCount: number
  duration: number        // seconds
  totalSlides: number
  interactiveSlides: number
  slidesWithResponses: number
  totalResponses: number
  engagementRate: number  // 0-100
  avgResponsesPerSlide: number
}

function loadPresentationSessions(): PresentationSessionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('quizotic_presentation_sessions') || '[]')
  } catch { return [] }
}

// ─── Presentation types ───────────────────────────────────────────────────────
interface PresentationRecord {
  id: string
  title: string
  slides: { id: string; type: string }[]
  createdAt: string
  updatedAt: string
}

function loadPresentations(): PresentationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('quizotic_presentations') || '[]')
  } catch { return [] }
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, sub, color }: {
  value: string | number; label: string; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: '#fff', borderColor: '#DBEAFE' }}>
      <p className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color }}>
        {value}
      </p>
      <p className="text-lg font-semibold" style={{ color: '#1E1B4B' }}>{label}</p>
      {sub && <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
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
  onDuplicate,
}: {
  quiz: Quiz
  sessionCount: number
  onStart: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const created = quiz.createdAt
    ? new Date(quiz.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : 'Unknown date'

  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4 hover:shadow-md transition-all"
      style={{ background: '#fff', borderColor: '#DBEAFE' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: '#F0F4FF' }}>
        📋
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold truncate text-base" style={{ color: '#1E1B4B' }}>{quiz.title}</h3>
        <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
          {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
          {quiz.subject ? ` · ${quiz.subject}` : ''}
          {' · '}{sessionCount} session{sessionCount !== 1 ? 's' : ''}
          {' · '}{created}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onDuplicate}
          className="text-sm font-semibold px-3.5 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
          style={{ color: '#6B7280', borderColor: '#DBEAFE' }}
          title="Duplicate quiz">
          Duplicate
        </button>
        <button onClick={onEdit}
          className="text-sm font-semibold px-3.5 py-1.5 rounded-lg border transition-colors hover:bg-violet-50"
          style={{ color: '#6B7280', borderColor: '#DBEAFE' }}>
          Edit
        </button>
        <button onClick={onDelete}
          className="text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors hover:text-red-500"
          style={{ color: '#9CA3AF' }}>
          Delete
        </button>
        <button onClick={onStart}
          className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.03]"
          style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
          Start →
        </button>
      </div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'quizzes' | 'presentations' | 'analytics'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HostDashboardPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [presentationSessions, setPresentationSessions] = useState<PresentationSessionRecord[]>([])
  const [presentations, setPresentations] = useState<PresentationRecord[]>([])
  const [search, setSearch] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [referralStats, setReferralStats] = useState<{ referralCount: number; bonusCredits: number } | null>(null)

  useEffect(() => {
    // Load from localStorage first (instant)
    const localQuizzes = loadQuizzes()
    setQuizzes(localQuizzes)
    setSessions(loadSessions())
    setPresentationSessions(loadPresentationSessions())
    setPresentations(loadPresentations())
    setBannerDismissed(localStorage.getItem('quizotic_welcome_dismissed') === 'true')

    // Then fetch from DB and merge (DB is source of truth)
    fetch('/api/quizzes')
      .then(r => r.json())
      .then(res => {
        if (!res.success || !res.data) return
        const dbQuizzes: Quiz[] = res.data
        const localMap = new Map(localQuizzes.map(q => [q.id, q]))
        const merged = new Map<string, Quiz>()

        // DB quizzes take priority
        for (const q of dbQuizzes) {
          merged.set(q.id, localMap.get(q.id) ?? q)
        }
        // Add any localStorage-only quizzes (not yet synced to DB)
        for (const q of localQuizzes) {
          if (!merged.has(q.id)) merged.set(q.id, q)
        }

        const result = Array.from(merged.values())
        setQuizzes(result)
      })
      .catch(() => {}) // DB fetch failed — localStorage copy already loaded
  }, [])

  useEffect(() => {
    fetch('/api/user/referral-code')
      .then(r => r.json())
      .then(d => { if (d.code) setReferralCode(d.code) })
      .catch(() => {})
    fetch('/api/user/referral-stats')
      .then(r => r.json())
      .then(d => { if (typeof d.referralCount === 'number') setReferralStats(d) })
      .catch(() => {})
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => {})
  }, [])

  function dismissBanner() {
    localStorage.setItem('quizotic_welcome_dismissed', 'true')
    setBannerDismissed(true)
  }

  function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this quiz? This cannot be undone.')) return
    deleteQuiz(id)
    setQuizzes(loadQuizzes())
    fetch(`/api/quizzes/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function handleStart(quiz: Quiz) {
    setActiveSession(quiz)
    router.push('/host/session')
  }

  function handleEdit(quiz: Quiz) {
    // Pass quiz id in URL for edit mode — create page can pick it up
    router.push(`/host/create?edit=${quiz.id}`)
  }

  function handleDuplicate(quiz: Quiz) {
    const clone: Quiz = {
      ...quiz,
      id: crypto.randomUUID(),
      title: `${quiz.title} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: quiz.questions.map(q => ({ ...q, id: crypto.randomUUID() })),
    }
    saveQuiz(clone)
    setQuizzes(loadQuizzes())
    // Also persist to DB
    fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clone),
    }).catch(() => {})
  }

  function handleDeletePresentation(id: string) {
    if (!window.confirm('Are you sure you want to delete this presentation? This cannot be undone.')) return
    const updated = presentations.filter(p => p.id !== id)
    localStorage.setItem('quizotic_presentations', JSON.stringify(updated))
    setPresentations(updated)
  }

  function handlePresentNow(p: PresentationRecord) {
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(p))
    router.push('/host/present/session')
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
          <div className="rounded-2xl p-6 relative" style={{ background: '#F0F4FF', border: '1.5px solid #93C5FD' }}>
            <button onClick={dismissBanner}
              className="absolute top-4 right-4 text-base leading-none transition-opacity hover:opacity-60"
              style={{ color: '#9CA3AF' }} aria-label="Dismiss">
              ✕
            </button>
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>
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
                  desc: 'Participants join at quizotic.live — no app install needed.',
                },
              ].map(step => (
                <div key={step.num} className="flex-1 flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--color-primary)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                    {step.num}
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#1E1B4B' }}>{step.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>{step.desc}</p>
                    {step.action && (
                      <button onClick={step.action}
                        className="text-xs font-bold mt-1.5 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-primary)' }}>
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
          <StatCard value={quizzes.length} label="Quizzes" sub="in your library" color="#4361EE" />
          <StatCard value={presentations.length} label="Presentations" sub="interactive slides" color="#FF6B6B" />
          <StatCard value={sessions.length + presentationSessions.length} label="Sessions run" sub="all time" color="#F59E0B" />
          <StatCard value={totalPlayers + presentationSessions.reduce((s, r) => s + r.participantCount, 0)} label="Participants" sub="total across sessions" color="#16A34A" />
        </div>

        {/* Quick actions — 2 hero cards + 2 secondary */}
        <div>
          <h2 className="text-lg font-bold mb-4 uppercase tracking-wider" style={{ color: '#a8a29e' }}>
            create something
          </h2>

          {/* Hero cards — Quiz + Presentation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Create Quiz */}
            <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #4361EE, #7C3AED)' }}>
              <p className="text-3xl mb-2">🎯</p>
              <h3 className="text-xl font-black mb-1 text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                Create Quiz
              </h3>
              <p className="text-base font-medium mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Test knowledge with interactive MCQs, true/false & more
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => router.push('/host/create?tab=ai-topic')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#4361EE' }}>
                  ✦ AI from Topic / URL
                </button>
                <button onClick={() => router.push('/host/create')}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)' }}>
                  Blank Quiz
                </button>
              </div>
            </div>

            {/* Create Presentation */}
            <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #FF6B6B, #F59E0B)' }}>
              <p className="text-3xl mb-2">📊</p>
              <h3 className="text-xl font-black mb-1 text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                Create Presentation
              </h3>
              <p className="text-base font-medium mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Live polls, word clouds, Q&A & audience interaction slides
              </p>
              <div className="flex gap-2">
                <button onClick={() => router.push('/host/present/create')}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#FF6B6B' }}>
                  + Create Presentation
                </button>
              </div>
            </div>
          </div>

          {/* Secondary cards */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => router.push('/join')}
              className="rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] border"
              style={{ background: '#FEF3C7', borderColor: '#FDE68A' }}>
              <p className="text-2xl mb-2">🎮</p>
              <p className="text-lg font-black" style={{ color: '#1E1B4B', fontFamily: 'var(--font-heading)' }}>Join a Game</p>
              <p className="text-sm font-medium" style={{ color: '#92400E' }}>Enter a code to play</p>
            </button>
            <button onClick={() => router.push('/host/templates')}
              className="rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] border"
              style={{ background: '#F3E8FF', borderColor: '#DDD6FE' }}>
              <p className="text-2xl mb-2">📚</p>
              <p className="text-lg font-black" style={{ color: '#1E1B4B', fontFamily: 'var(--font-heading)' }}>Templates</p>
              <p className="text-sm font-medium" style={{ color: '#7C3AED' }}>8 ready-made quiz templates</p>
            </button>
          </div>
        </div>

        {/* Referral share card */}
        {referralCode && (
          <div className="rounded-2xl border p-5"
            style={{ background: 'linear-gradient(135deg, #F0F4FF 0%, #FEF3C7 100%)', borderColor: '#DBEAFE' }}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎁</span>
                  <p className="text-base font-bold" style={{ color: '#1E1B4B' }}>
                    Invite & Earn AI Credits
                  </p>
                </div>
                <p className="text-sm mb-2" style={{ color: '#374151' }}>
                  Earn <strong>10 bonus AI credits</strong> for every colleague who signs up. Up to 100 bonus credits.
                </p>
                {referralStats && referralStats.referralCount > 0 && (
                  <div className="flex gap-4 mb-2">
                    <span className="text-sm font-semibold" style={{ color: '#4361EE' }}>
                      {referralStats.referralCount} referral{referralStats.referralCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: '#059669' }}>
                      +{referralStats.bonusCredits} bonus credits
                    </span>
                  </div>
                )}
                <p className="text-sm font-mono truncate" style={{ color: '#6B7280' }}>
                  quizotic.live/r/{referralCode}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.quizotic.live/r/${referralCode}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{ background: '#fff', color: '#4361EE', border: '1.5px solid #DBEAFE' }}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hey! Check out *Quizotic* — it's a free live quiz & presentation platform (like Kahoot but better).\n\n- AI generates quizzes in seconds\n- 9 quiz types + 18 interactive slide types\n- Works on any phone browser, no app needed\n- Free for up to 50 participants\n- Pricing in INR with UPI\n\nI've been using it for my sessions and it's really good. Give it a try:\nhttps://www.quizotic.live/r/${referralCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center"
                  style={{ background: '#25D366', width: 38, height: 38 }}
                  title="Share on WhatsApp">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Recent quizzes + Recent presentations — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent quizzes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: '#a8a29e' }}>
                recent quizzes
              </h2>
              {quizzes.length > 3 && (
                <button onClick={() => setTab('quizzes')}
                  className="text-sm font-semibold transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}>
                  see all {quizzes.length} →
                </button>
              )}
            </div>
            {quizzes.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ borderColor: '#DBEAFE' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No quizzes yet.</p>
                <button onClick={() => router.push('/host/create')}
                  className="mt-3 text-sm font-bold px-5 py-2 rounded-full"
                  style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
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
                    onDuplicate={() => handleDuplicate(q)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent presentations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: '#a8a29e' }}>
                recent presentations
              </h2>
              {presentations.length > 3 && (
                <button onClick={() => setTab('presentations')}
                  className="text-sm font-semibold transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}>
                  see all {presentations.length} →
                </button>
              )}
            </div>
            {presentations.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ borderColor: '#DBEAFE' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No presentations yet.</p>
                <button onClick={() => router.push('/host/present/create')}
                  className="mt-3 text-sm font-bold px-5 py-2 rounded-full"
                  style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                  Create your first →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {presentations.slice(0, 3).map(p => {
                  const created = p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : 'Unknown date'
                  return (
                    <div key={p.id} className="rounded-2xl border p-5 flex items-center gap-4 hover:shadow-md transition-all"
                      style={{ background: '#fff', borderColor: '#DBEAFE' }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ background: '#FFF5F5' }}>
                        📊
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate text-base" style={{ color: '#1E1B4B' }}>{p.title}</h3>
                        <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
                          {p.slides.length} slide{p.slides.length !== 1 ? 's' : ''} · {created}
                        </p>
                      </div>
                      <button onClick={() => handlePresentNow(p)}
                        className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.03] flex-shrink-0"
                        style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                        Present →
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent session activity */}
        {(sessions.length > 0 || presentationSessions.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: '#a8a29e' }}>
                recent activity
              </h2>
              <button onClick={() => setTab('analytics')}
                className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: 'var(--color-primary)' }}>
                full analytics →
              </button>
            </div>
            <div className="space-y-2">
              {[
                ...sessions.map(s => ({ type: 'quiz' as const, id: s.id, title: s.quizTitle, date: s.date, participants: s.playerCount, metric: s.avgScore, metricLabel: 'avg score' })),
                ...presentationSessions.map(s => ({ type: 'presentation' as const, id: s.id, title: s.presentationTitle, date: s.date, participants: s.participantCount, metric: s.engagementRate, metricLabel: 'engagement' })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 4)
                .map(s => (
                  <div key={s.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
                    style={{ background: '#fff', borderColor: '#DBEAFE' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: '#1E1B4B' }}>{s.title}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: s.type === 'quiz' ? '#EEF2FF' : '#F0FFF4',
                            color: s.type === 'quiz' ? '#4361EE' : '#16A34A',
                          }}>
                          {s.type === 'quiz' ? 'Quiz' : 'Presentation'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' · '}{s.participants} participant{s.participants !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: s.type === 'quiz' ? 'var(--color-primary)' : '#16A34A' }}>{s.metric}%</p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{s.metricLabel}</p>
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
            style={{ borderColor: '#DBEAFE', color: '#1E1B4B', background: '#fff' }}
          />
          <button
            onClick={() => router.push('/host/create')}
            className="text-sm font-bold px-6 py-2.5 rounded-xl flex-shrink-0 transition-all hover:scale-[1.02]"
            style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            + new quiz
          </button>
        </div>

        {filteredQuizzes.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '#DBEAFE' }}>
            <p className="text-sm mb-3" style={{ color: '#9CA3AF' }}>
              {search ? `No quizzes matching "${search}"` : 'No quizzes yet.'}
            </p>
            {!search && (
              <button onClick={() => router.push('/host/create')}
                className="text-sm font-bold px-5 py-2 rounded-full"
                style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
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
                onDuplicate={() => handleDuplicate(q)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── PRESENTATIONS TAB ─────────────────────────────────────────────────────
  function PresentationsTab() {
    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/host/present/create')}
            className="text-sm font-bold px-6 py-2.5 rounded-xl flex-shrink-0 transition-all hover:scale-[1.02]"
            style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
            + New Presentation
          </button>
        </div>

        {presentations.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '#DBEAFE' }}>
            <p className="text-sm mb-3" style={{ color: '#9CA3AF' }}>No presentations yet.</p>
            <button onClick={() => router.push('/host/present/create')}
              className="text-sm font-bold px-5 py-2 rounded-full"
              style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
              Create your first →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {presentations.map(p => {
              const created = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                : 'Unknown date'
              return (
                <div key={p.id} className="rounded-2xl border p-5 flex items-center gap-4 hover:shadow-md transition-all"
                  style={{ background: '#fff', borderColor: '#DBEAFE' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: '#F0FDF4' }}>
                    📊
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate text-base" style={{ color: '#1E1B4B' }}>{p.title}</h3>
                    <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
                      {p.slides.length} slide{p.slides.length !== 1 ? 's' : ''}
                      {' · '}{created}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => router.push(`/host/present/create?id=${p.id}`)}
                      className="text-sm font-semibold px-3.5 py-1.5 rounded-lg border transition-colors hover:bg-violet-50"
                      style={{ color: '#6B7280', borderColor: '#DBEAFE' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeletePresentation(p.id)}
                      className="text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors hover:text-red-500"
                      style={{ color: '#9CA3AF' }}>
                      Delete
                    </button>
                    <button onClick={() => handlePresentNow(p)}
                      className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.03]"
                      style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
                      Present →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── ANALYTICS TAB ──────────────────────────────────────────────────────────
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'quizzes' | 'presentations'>('quizzes')

  function AnalyticsTab() {
    const hasQuizSessions = sessions.length > 0
    const hasPresentationSessions = presentationSessions.length > 0

    if (!hasQuizSessions && !hasPresentationSessions) {
      return (
        <div className="rounded-2xl border p-16 text-center" style={{ borderColor: '#DBEAFE' }}>
          <p className="text-2xl mb-3">📊</p>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1E1B4B' }}>No sessions yet</p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Run a live quiz or presentation — your analytics will appear here after the session ends.
          </p>
        </div>
      )
    }

    // Per-quiz analytics
    const quizStats = quizzes.map(q => {
      const qSessions = sessions.filter(s => s.quizId === q.id)
      const avgScoreQ = qSessions.length
        ? Math.round(qSessions.reduce((s, r) => s + r.avgScore, 0) / qSessions.length)
        : 0
      const totalPlayersQ = qSessions.reduce((s, r) => s + r.playerCount, 0)
      return { quiz: q, sessions: qSessions, avgScore: avgScoreQ, totalPlayers: totalPlayersQ }
    }).filter(x => x.sessions.length > 0)

    // Per-presentation analytics
    const presIds = [...new Set(presentationSessions.map(s => s.presentationId))]
    const presStats = presIds.map(pid => {
      const pSessions = presentationSessions.filter(s => s.presentationId === pid)
      const title = pSessions[0].presentationTitle
      const avgEngagement = Math.round(pSessions.reduce((s, r) => s + r.engagementRate, 0) / pSessions.length)
      const totalParticipants = pSessions.reduce((s, r) => s + r.participantCount, 0)
      const totalSlides = pSessions[0].totalSlides
      return { id: pid, title, sessions: pSessions, avgEngagement, totalParticipants, totalSlides }
    })

    const presTotalParticipants = presentationSessions.reduce((s, r) => s + r.participantCount, 0)
    const presAvgEngagement = presentationSessions.length
      ? Math.round(presentationSessions.reduce((s, r) => s + r.engagementRate, 0) / presentationSessions.length)
      : 0

    return (
      <div className="space-y-8">
        {/* Sub-tab toggle */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F0F4FF' }}>
          {([['quizzes', 'Quizzes'], ['presentations', 'Presentations']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setAnalyticsSubTab(key)}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: analyticsSubTab === key ? '#fff' : 'transparent',
                color: analyticsSubTab === key ? '#1E1B4B' : '#9CA3AF',
                boxShadow: analyticsSubTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── QUIZ ANALYTICS ── */}
        {analyticsSubTab === 'quizzes' && (
          <div className="space-y-8">
            {!hasQuizSessions ? (
              <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '#DBEAFE' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No quiz sessions yet. Run a live quiz to see analytics here.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard value={sessions.length} label="Total sessions" color="#4361EE" />
                  <StatCard value={totalPlayers} label="Total players" color="#F59E0B" />
                  <StatCard value={`${avgScore}%`} label="Overall avg score" color="#FF6B6B" />
                  <StatCard value={quizStats.length} label="Quizzes with data" color="#4361EE" />
                </div>

                {quizStats.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
                      per-quiz performance
                    </h2>
                    <div className="space-y-3">
                      {quizStats.map(({ quiz, sessions: qSessions, avgScore: qAvg, totalPlayers: qPlayers }) => (
                        <div key={quiz.id} className="rounded-2xl border p-5" style={{ background: '#fff', borderColor: '#DBEAFE' }}>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h3 className="font-bold text-sm" style={{ color: '#1E1B4B' }}>{quiz.title}</h3>
                              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                                {quiz.questions.length} questions · {qSessions.length} session{qSessions.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: qAvg >= 70 ? '#4361EE' : qAvg >= 50 ? '#F59E0B' : '#dc2626' }}>
                                {qAvg}%
                              </p>
                              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>avg score</p>
                            </div>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: '#F0F4FF' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${qAvg}%`,
                                background: qAvg >= 70 ? 'linear-gradient(90deg,#4361EE,#FF6B6B)' : qAvg >= 50 ? '#F59E0B' : '#dc2626',
                              }} />
                          </div>
                          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{qPlayers} total participants</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
                    session history
                  </h2>
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#DBEAFE' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#F0F4FF', borderBottom: '1px solid #DBEAFE' }}>
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
                          <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid #F0F4FF' : undefined }}>
                            <td className="px-4 py-3 font-medium" style={{ color: '#1E1B4B' }}>
                              <span className="truncate block max-w-[200px]">{s.quizTitle}</span>
                            </td>
                            <td className="px-4 py-3" style={{ color: '#6B7280' }}>
                              {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 font-semibold" style={{ color: '#1E1B4B' }}>{s.playerCount}</td>
                            <td className="px-4 py-3">
                              <span className="font-bold" style={{ color: s.avgScore >= 70 ? '#4361EE' : s.avgScore >= 50 ? '#F59E0B' : '#dc2626' }}>
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
              </>
            )}
          </div>
        )}

        {/* ── PRESENTATION ANALYTICS ── */}
        {analyticsSubTab === 'presentations' && (
          <div className="space-y-8">
            {!hasPresentationSessions ? (
              <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '#DBEAFE' }}>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No presentation sessions yet. Run a live presentation to see analytics here.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard value={presentationSessions.length} label="Total sessions" color="#16A34A" />
                  <StatCard value={presTotalParticipants} label="Total participants" color="#F59E0B" />
                  <StatCard value={`${presAvgEngagement}%`} label="Avg engagement" color="#16A34A" />
                  <StatCard value={presStats.length} label="Presentations with data" color="#4361EE" />
                </div>

                {presStats.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
                      per-presentation engagement
                    </h2>
                    <div className="space-y-3">
                      {presStats.map(({ id, title, sessions: pSessions, avgEngagement, totalParticipants, totalSlides }) => (
                        <div key={id} className="rounded-2xl border p-5" style={{ background: '#fff', borderColor: '#DBEAFE' }}>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h3 className="font-bold text-sm" style={{ color: '#1E1B4B' }}>{title}</h3>
                              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                                {totalSlides} slides · {pSessions.length} session{pSessions.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: avgEngagement >= 70 ? '#16A34A' : avgEngagement >= 40 ? '#F59E0B' : '#dc2626' }}>
                                {avgEngagement}%
                              </p>
                              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>engagement</p>
                            </div>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: '#F0FFF4' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${avgEngagement}%`,
                                background: avgEngagement >= 70 ? 'linear-gradient(90deg,#16A34A,#4ADE80)' : avgEngagement >= 40 ? '#F59E0B' : '#dc2626',
                              }} />
                          </div>
                          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{totalParticipants} total participants</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#a8a29e' }}>
                    session history
                  </h2>
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#DBEAFE' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#F0FFF4', borderBottom: '1px solid #DBEAFE' }}>
                          {['Presentation', 'Date', 'Participants', 'Engagement', 'Duration'].map(col => (
                            <th key={col} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                              style={{ color: '#9CA3AF' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {presentationSessions.map((s, i) => (
                          <tr key={s.id} style={{ borderBottom: i < presentationSessions.length - 1 ? '1px solid #F0F4FF' : undefined }}>
                            <td className="px-4 py-3 font-medium" style={{ color: '#1E1B4B' }}>
                              <span className="truncate block max-w-[200px]">{s.presentationTitle}</span>
                            </td>
                            <td className="px-4 py-3" style={{ color: '#6B7280' }}>
                              {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 font-semibold" style={{ color: '#1E1B4B' }}>{s.participantCount}</td>
                            <td className="px-4 py-3">
                              <span className="font-bold" style={{ color: s.engagementRate >= 70 ? '#16A34A' : s.engagementRate >= 40 ? '#F59E0B' : '#dc2626' }}>
                                {s.engagementRate}%
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
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'quizzes', label: 'My Quizzes' },
    { id: 'presentations', label: 'Presentations' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFE', fontFamily: 'var(--font-body)' }}>
      {/* Sub-header: tabs + actions */}
      <div className="border-b" style={{ background: '#FAFAFE', borderColor: '#DBEAFE' }}>
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between h-12">
          {/* Tab navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: tab === t.id ? '#F0F4FF' : 'transparent',
                  color: tab === t.id ? '#4361EE' : '#6B7280',
                }}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/host/admin')}
                className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
                style={{ border: '2px solid #7C3AED', color: '#7C3AED', background: 'transparent', fontFamily: 'var(--font-heading)' }}>
                Admin
              </button>
            )}
            <button
              onClick={() => router.push('/host/present/create')}
              className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ border: '2px solid var(--color-primary)', color: 'var(--color-primary)', background: 'transparent', fontFamily: 'var(--font-heading)' }}>
              + Present
            </button>
            <button
              onClick={() => router.push('/host/create')}
              className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
              + New Quiz
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex border-t" style={{ borderColor: '#DBEAFE' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-xs font-bold transition-colors"
              style={{
                color: tab === t.id ? '#4361EE' : '#9CA3AF',
                borderBottom: tab === t.id ? '2px solid #4361EE' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Tab title with personalized greeting */}
        <div className="mb-7">
          {tab === 'dashboard' ? (
            <>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
                {session?.user?.name ? (
                  <>
                    Hey, {session.user.name.split(' ')[0]}
                    <motion.span
                      className="inline-block ml-2"
                      animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                      transition={{ duration: 1.8, delay: 0.5, ease: 'easeInOut' }}
                    >
                      👋
                    </motion.span>
                  </>
                ) : (
                  'Dashboard'
                )}
              </h1>
              <p className="text-base mt-1" style={{ color: '#a8a29e' }}>
                {quizzes.length === 0 ? 'Welcome to Quizotic!' : 'Welcome back!'} Here&apos;s your quiz activity at a glance.
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-black lowercase" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
              {tab === 'quizzes' && `my quizzes (${quizzes.length})`}
              {tab === 'presentations' && `presentations (${presentations.length})`}
              {tab === 'analytics' && 'analytics'}
            </h1>
          )}
        </div>

        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'quizzes' && <QuizzesTab />}
        {tab === 'presentations' && <PresentationsTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </main>
    </div>
  )
}
