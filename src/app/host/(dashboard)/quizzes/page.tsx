'use client'

import { useEffect, useState, useCallback } from 'react'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { QuizListRow } from '@/components/host/QuizListRow'
import { AssignQuizModal, type QuizPatch } from '@/components/host/AssignQuizModal'
import { track } from '@/lib/analytics'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { setActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

interface QuizRecord {
  id: string
  title: string
  subject: string | null
  language: string | null
  createdAt: string
  updatedAt: string
  coverImageUrl: string | null
  questionCount: number
  asyncShareSlug: string | null
  asyncAllowRetries: boolean
  asyncOpensAt: string | null
  asyncClosesAt: string | null
  asyncPublishedAt: string | null
  asyncQuestionCount: number
  asyncResponseCount: number
  asyncNeedsRepublish: boolean
}

// Soft cover palette for quiz thumbnail cards — deterministic by id hash so
// a quiz keeps visual continuity without turning the library into color blocks.
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #F8FAFC 0%, #E0F2FE 100%)',
  'linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)',
  'linear-gradient(135deg, #F0FDF4 0%, #BBF7D0 100%)',
  'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)',
  'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)',
  'linear-gradient(135deg, #ECFEFF 0%, #A5F3FC 100%)',
]
function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}

function QuizCoverMotif({ id }: { id: string }) {
  let baseSeed = 0
  for (let i = 0; i < id.length; i++) baseSeed = (baseSeed * 131 + id.charCodeAt(i)) >>> 0
  const seededUnit = (step: number) => {
    let value = (baseSeed + step * 0x9e3779b9) >>> 0
    value ^= value >>> 16
    value = Math.imul(value, 0x7feb352d)
    value ^= value >>> 15
    value = Math.imul(value, 0x846ca68b)
    value ^= value >>> 16
    return (value >>> 0) / 0xffffffff
  }
  const dots = Array.from({ length: 8 }, (_, i) => ({
    cx: 4 + seededUnit(i * 4 + 1) * 92,
    cy: 4 + seededUnit(i * 4 + 2) * 92,
    o: 0.25 + seededUnit(i * 4 + 4) * 0.6,
  }))
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <rect x="19" y="15" width="62" height="70" rx="10" fill="#fff" opacity="0.88" />
      <rect x="28" y="27" width="44" height="7" rx="3.5" fill="#0F1B3D" opacity="0.18" />
      <rect x="28" y="43" width="38" height="6" rx="3" fill="#2563EB" opacity="0.22" />
      <rect x="28" y="57" width="32" height="6" rx="3" fill="#16A34A" opacity="0.22" />
      <circle cx="70" cy="66" r="9" fill="#FBD13B" stroke="#0F1B3D" strokeOpacity="0.48" strokeWidth="2" />
      <path d="M66.4 66l2.2 2.2 5-5.2" stroke="#0F1B3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {dots.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r="1.2" fill="#0F1B3D" opacity={s.o * 0.35} />
      ))}
    </svg>
  )
}

function modeStatus(quiz: QuizRecord): { label: string; tone: 'ready' | 'draft' | 'attention' } {
  if (!quiz.asyncShareSlug) return { label: 'Draft', tone: 'draft' }
  if (quiz.asyncNeedsRepublish) return { label: 'Republish', tone: 'attention' }
  return { label: 'Self-paced', tone: 'ready' }
}

function statusStyle(tone: 'ready' | 'draft' | 'attention') {
  if (tone === 'ready') return { background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0' }
  if (tone === 'attention') return { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
  return { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }
}

function readinessSignals(quiz: QuizRecord): Array<{ label: string; tone: 'ready' | 'draft' | 'attention' }> {
  const signals: Array<{ label: string; tone: 'ready' | 'draft' | 'attention' }> = []
  if (quiz.questionCount === 0) {
    signals.push({ label: 'Needs questions', tone: 'attention' })
  } else {
    signals.push({ label: 'Ready live', tone: 'ready' })
  }
  if (quiz.asyncNeedsRepublish) signals.push({ label: 'Stale link', tone: 'attention' })
  if (quiz.asyncResponseCount > 0) signals.push({ label: 'Report ready', tone: 'ready' })
  return signals
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Short date label for an amber "Scheduled · <date>" chip when opensAt is future.
function scheduledLabel(quiz: QuizRecord): string | null {
  if (!quiz.asyncOpensAt) return null
  const opens = new Date(quiz.asyncOpensAt)
  if (opens.getTime() <= Date.now()) return null
  return `Scheduled · ${opens.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
}

const SCHEDULED_CHIP_STYLE = { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }

export default function QuizzesPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeSubject, setActiveSubject] = useState<string>('All')
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [assignQuiz, setAssignQuiz] = useState<{ id: string; title: string } | null>(null)

  const fetchQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quizzes')
      if (res.ok) {
        const json = await res.json()
        setQuizzes(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQuizzes() }, [fetchQuizzes])

  async function handleStart(id: string) {
    setStartingId(id)
    setError('')
    try {
      const res = await fetch(`/api/quizzes/${id}`)
      if (!res.ok) throw new Error('Failed to load quiz')
      const json = await res.json()
      const quiz: Quiz = json.data
      setActiveSession(quiz)
      router.push('/host/session')
    } catch {
      setError('Could not load quiz. Please try again.')
      setStartingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/quizzes/${id}`, { method: 'DELETE' })
      setQuizzes(prev => prev.filter(q => q.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/quizzes/${id}`)
      if (!res.ok) return
      const json = await res.json()
      const quiz: Quiz = json.data
      const duped = { ...quiz, id: undefined, title: `${quiz.title} (Copy)` }
      await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duped),
      })
      fetchQuizzes()
    } catch {
      setError('Could not duplicate quiz.')
    }
  }

  function handleAssign(id: string, title: string) {
    track('selfpaced_share_opened', { quizId: id })
    setAssignQuiz({ id, title })
  }

  // Mirror a publish/schedule change from AssignQuizModal back into the list row.
  const handleQuizPatched = useCallback((quizId: string, patch: QuizPatch) => {
    setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, ...patch } : q))
  }, [])

  // Unique subjects for filter chips
  const subjects = Array.from(new Set(quizzes.map(q => q.subject).filter(Boolean))) as string[]

  const filtered = quizzes
    .filter(q => activeSubject === 'All' || q.subject === activeSubject)
    .filter(q =>
      !search || q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.subject ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  // Split into "Recent" (top 4) and "All" for the rest
  const recent = filtered.slice(0, 4)
  const rest = filtered.slice(4)

  return (
    <div className="paper-grain min-h-full" style={{ background: 'var(--color-paper)' }}>
    <div className="p-6 md:p-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[28px] font-black leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            My quizzes
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} saved{subjects.length > 0 ? ` · ${subjects.length} subject${subjects.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/host/build" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Create quiz
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
          {error}
        </div>
      )}

      <div className="mb-5 grid md:grid-cols-2 gap-3">
        <div className="rounded-[14px] bg-white border p-4 flex items-center gap-3" style={{ borderColor: 'var(--color-line)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0F1B3D', color: '#FBD13B' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black" style={{ color: '#0F1B3D' }}>Host live</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Run a room with a join code, timer, and leaderboard.</p>
          </div>
        </div>
        <div className="rounded-[14px] bg-white border p-4 flex items-center gap-3" style={{ borderColor: 'var(--color-line)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ECFDF5', color: '#047857' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black" style={{ color: '#0F1B3D' }}>Share self-paced</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Send a link for anytime attempts, retakes, and reports.</p>
          </div>
        </div>
      </div>

      {/* Toolbar — search + subject chips + Grid/List toggle */}
      <div className="mb-6 rounded-[14px] px-3 py-2.5 flex items-center gap-3 flex-wrap" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <input
            type="text"
            placeholder="Search this library…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 text-[13px] rounded-[10px] outline-none focus:ring-2 focus:ring-yellow-200"
            style={{ background: 'var(--color-paper)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute top-[12px] left-3" style={{ color: 'var(--color-text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>

        {subjects.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveSubject('All')}
              className="chip"
              style={{ background: activeSubject === 'All' ? 'var(--color-ink)' : 'var(--color-paper-2)', color: activeSubject === 'All' ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', border: 'none' }}
            >
              All
            </button>
            {subjects.slice(0, 5).map(sub => (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className="chip"
                style={{ background: activeSubject === sub ? 'var(--color-ink)' : '#EFF6FF', color: activeSubject === sub ? '#fff' : '#1D4ED8', cursor: 'pointer', border: 'none' }}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 flex-shrink-0" style={{ background: 'var(--color-paper-2)', borderRadius: '10px', padding: '3px' }}>
          <button
            onClick={() => setView('grid')}
            className="px-2.5 py-1 text-[12px] font-semibold rounded-md flex items-center gap-1"
            style={{ background: view === 'grid' ? '#fff' : 'transparent', color: view === 'grid' ? 'var(--color-ink)' : 'var(--color-text-muted)', boxShadow: view === 'grid' ? '0 1px 0 rgba(0,0,0,.03)' : 'none' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className="px-2.5 py-1 text-[12px] font-semibold rounded-md flex items-center gap-1"
            style={{ background: view === 'list' ? '#fff' : 'transparent', color: view === 'list' ? 'var(--color-ink)' : 'var(--color-text-muted)', boxShadow: view === 'list' ? '0 1px 0 rgba(0,0,0,.03)' : 'none' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-[16px]" style={{ background: 'var(--color-paper-2)', border: '1px dashed #DDD4BC' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }}><path d="M9 11H5a2 2 0 0 0-2 2v7h14v-7a2 2 0 0 0-2-2h-4"/><path d="M9 11V6a3 3 0 0 1 6 0v5"/></svg>
          </div>
          <p className="text-[18px] font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            {quizzes.length === 0 ? 'No quizzes yet.' : 'No quizzes match.'}
          </p>
          <p className="text-sm mb-5 max-w-[40ch]" style={{ color: 'var(--color-text-muted)' }}>
            {quizzes.length === 0 ? 'Start with one clear question. Everything else can follow.' : 'Try a different search term or subject filter.'}
          </p>
          {quizzes.length === 0 && (
            <Link href="/host/build" className="btn-primary" style={{ textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              Create your first quiz
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Recent section — top 4 as gradient thumbnail cards ── */}
          {view === 'grid' && recent.length > 0 && (
            <section className="mb-8">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-[16px] font-black" style={{ color: '#0F1B3D' }}>Recent</h2>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Picked up where you left off</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                <AnimatePresence>
                  {recent.map((quiz, i) => {
                    const status = modeStatus(quiz)
                    const signals = readinessSignals(quiz)
                    return (
                    <motion.div
                      key={quiz.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-[12px] overflow-hidden flex flex-col transition-shadow hover:shadow-lg"
                      style={{ background: '#fff', border: '1px solid var(--color-line)' }}
                    >
                      <div className="relative aspect-[5/3] overflow-hidden" style={{ background: gradientFor(quiz.id) }}>
                        {quiz.coverImageUrl ? (
                          <img src={quiz.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <QuizCoverMotif id={quiz.id} />
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(to top, rgba(15,27,61,0.76), rgba(15,27,61,0))' }} />
                        <div className="relative z-10 h-full p-3 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="chip" style={{ background: 'rgba(255,255,255,0.86)', color: '#0F1B3D', backdropFilter: 'blur(6px)' }}>
                              {quiz.questionCount} Qs
                            </span>
                            <button
                              onClick={() => setConfirmDelete(quiz.id)}
                              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                              style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.08)' }}
                              title="Delete"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                            </button>
                          </div>
                          <h3 className="text-[15px] font-black leading-snug line-clamp-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
                            {quiz.title}
                          </h3>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {quiz.subject && (
                            <span className="chip" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{quiz.subject}</span>
                          )}
                          <span className="chip" style={statusStyle(status.tone)}>{status.label}</span>
                          {scheduledLabel(quiz) && (
                            <span className="chip" style={SCHEDULED_CHIP_STYLE}>{scheduledLabel(quiz)}</span>
                          )}
                          {signals.slice(0, 2).map(signal => (
                            <span key={signal.label} className="chip" style={statusStyle(signal.tone)}>{signal.label}</span>
                          ))}
                          {quiz.language && quiz.language !== 'en' && (
                            <span className="chip" style={{ background: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }}>{quiz.language.toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                          Updated {timeAgo(quiz.updatedAt)}
                        </p>
                        {quiz.asyncShareSlug && (
                          <div className="mb-2 rounded-lg px-2.5 py-2" style={{ background: quiz.asyncNeedsRepublish ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${quiz.asyncNeedsRepublish ? '#FDE68A' : '#BBF7D0'}` }}>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold" style={{ color: quiz.asyncNeedsRepublish ? '#92400E' : '#15803D' }}>
                                {quiz.asyncNeedsRepublish ? 'Republish changes' : 'Self-paced live'}
                              </p>
                              <Link href={`/host/quizzes/${quiz.id}/report`} className="text-[10px] font-bold underline" style={{ color: '#64748B' }}>
                                Results
                              </Link>
                            </div>
                            <p className="text-[10px]" style={{ color: '#64748B' }}>
                              {quiz.asyncResponseCount} response{quiz.asyncResponseCount === 1 ? '' : 's'} · {quiz.asyncQuestionCount} question{quiz.asyncQuestionCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2 mt-auto items-center">
                          <button
                            onClick={() => handleStart(quiz.id)}
                            disabled={startingId === quiz.id}
                            className="btn-golive flex-1 justify-center"
                            style={{ padding: '7px 9px', fontSize: '12px' }}
                          >
                            {startingId === quiz.id ? (
                              <span className="flex items-center gap-1.5">
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                              </span>
                            ) : (
                              <>
                                <span className="play-dot" style={{ width: '16px', height: '16px' }}><svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2 h-2"><path d="M8 5v14l11-7z"/></svg></span>
                                Host live
                              </>
                            )}
                          </button>
                          <Link href={`/host/build?edit=${quiz.id}`} className="btn-secondary flex-1 justify-center" style={{ textDecoration: 'none', padding: '7px 10px', fontSize: '12px' }}>
                            Edit
                          </Link>
                          <RowActionsMenu
                            label={`Actions for ${quiz.title || 'quiz'}`}
                            actions={[
                              {
                                label: 'Assign',
                                title: 'Share now or schedule for a date',
                                onClick: () => handleAssign(quiz.id, quiz.title),
                                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                              },
                              ...(quiz.asyncShareSlug ? [{
                                label: 'View results',
                                onClick: () => { window.location.href = `/host/quizzes/${quiz.id}/report` },
                                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 3v18h18M9 17V9M14 17V5M19 17v-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                              }] : []),
                              {
                                label: 'Duplicate',
                                onClick: () => handleDuplicate(quiz.id),
                                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
                              },
                              {
                                label: 'Delete',
                                onClick: () => setConfirmDelete(quiz.id),
                                danger: true,
                                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
                              },
                            ]}
                          />
                        </div>
                      </div>
                    </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* ── Rest as list rows (or all quizzes if view === 'list') ── */}
          {(view === 'list' ? filtered : rest).length > 0 && (
            <section>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-[16px] font-black" style={{ color: '#0F1B3D' }}>{view === 'list' ? 'All quizzes' : 'Recently edited'}</h2>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {view === 'list' ? 'Full library' : 'Earlier drafts and published quizzes'}
                  </p>
                </div>
              </div>

              <div className="rounded-[16px] overflow-hidden" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
                {(view === 'list' ? filtered : rest).map((quiz, i, arr) => (
                  <QuizListRow
                    key={quiz.id}
                    quiz={quiz}
                    isLastRow={i === arr.length - 1}
                    startingId={startingId}
                    onStart={handleStart}
                    onAssign={handleAssign}
                    onViewResults={id => { window.location.href = `/host/quizzes/${id}/report` }}
                    onDuplicate={handleDuplicate}
                    onDelete={id => setConfirmDelete(id)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Assign modal — share now or schedule */}
      <AnimatePresence>
        {assignQuiz && (
          <AssignQuizModal
            quizId={assignQuiz.id}
            quizTitle={assignQuiz.title}
            hasExistingShare={!!quizzes.find(q => q.id === assignQuiz.id)?.asyncShareSlug}
            onClose={() => setAssignQuiz(null)}
            onChanged={handleQuizPatched}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full shadow-xl"
              style={{ background: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black mb-2" style={{ color: '#0F1B3D' }}>Delete Quiz?</h3>
              <p className="text-sm mb-5" style={{ color: '#64748B' }}>
                This will permanently delete &ldquo;{quizzes.find(q => q.id === confirmDelete)?.title}&rdquo;.
                Session history will not be affected.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                  style={{ color: '#64748B', borderColor: '#E2E8F0' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deletingId === confirmDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-red-600 disabled:opacity-60"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {deletingId ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  )
}
