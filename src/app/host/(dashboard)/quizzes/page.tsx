'use client'

import { useEffect, useState, useCallback } from 'react'
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
  asyncShareSlug: string | null
  asyncAllowRetries: boolean
  asyncClosesAt: string | null
  asyncPublishedAt: string | null
  asyncQuestionCount: number
  asyncResponseCount: number
  asyncNeedsRepublish: boolean
}

interface ShareState {
  quizId: string
  slug: string | null
  questionCount: number
  responseCount: number
  allowRetries: boolean
  closesAt: string | null
  publishedAt: string | null
  needsRepublish: boolean
  publishing: boolean
  copied: boolean
  messageCopied: boolean
}

// Gradient palette for quiz thumbnail cards — deterministic by id hash
// so the same quiz always gets the same gradient. Inspired by mockup 06.
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #0F1B3D 0%, #1B2A5E 100%)',
  'linear-gradient(135deg, #E07A5F 0%, #C2410C 100%)',
  'linear-gradient(135deg, #16A34A 0%, #047857 100%)',
  'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
  'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
  'linear-gradient(135deg, #0891B2 0%, #155E75 100%)',
]
function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}

// Deterministic "constellation" motif seeded from the quiz id so each cover
// gets unique star positions that don't shift between renders. Matches the
// day-to-night brand theme. Purely decorative — sits behind the title.
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
  const stars = Array.from({ length: 14 }, (_, i) => ({
    cx: 4 + seededUnit(i * 4 + 1) * 92,
    cy: 4 + seededUnit(i * 4 + 2) * 92,
    r: 0.3 + seededUnit(i * 4 + 3) * 1.2,
    o: 0.25 + seededUnit(i * 4 + 4) * 0.6,
  }))
  const orbX = 18 + seededUnit(81) * 16
  const orbY = 18 + seededUnit(82) * 16
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <defs>
        <radialGradient id={`orb-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#F5E642" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#F5E642" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`shade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <circle cx={orbX} cy={orbY} r="28" fill={`url(#orb-${id})`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#FFF" opacity={s.o} />
      ))}
      <rect x="0" y="0" width="100" height="100" fill={`url(#shade-${id})`} />
    </svg>
  )
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

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function closeAtFor(days: number | null): string | null {
  if (days === null) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

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
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [shareModal, setShareModal] = useState<ShareState | null>(null)

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

  async function handleShare(id: string) {
    setShareModal({ quizId: id, slug: null, questionCount: 0, responseCount: 0, allowRetries: false, closesAt: null, publishedAt: null, needsRepublish: false, publishing: true, copied: false, messageCopied: false })
    try {
      const res = await fetch(`/api/quizzes/${id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error || 'Could not create share link.')
        setShareModal(null)
        return
      }
      const { shareSlug, questionCount, responseCount, allowRetries, closesAt, publishedAt, needsRepublish } = json.data
      setShareModal({ quizId: id, slug: shareSlug, questionCount, responseCount: responseCount ?? 0, allowRetries, closesAt: closesAt ?? null, publishedAt: publishedAt ?? null, needsRepublish: !!needsRepublish, publishing: false, copied: false, messageCopied: false })
      setQuizzes(prev => prev.map(q => q.id === id ? {
        ...q,
        asyncShareSlug: shareSlug,
        asyncQuestionCount: questionCount,
        asyncResponseCount: responseCount ?? q.asyncResponseCount ?? 0,
        asyncAllowRetries: allowRetries,
        asyncClosesAt: closesAt ?? null,
        asyncPublishedAt: publishedAt ?? new Date().toISOString(),
        asyncNeedsRepublish: false,
      } : q))
    } catch {
      setError('Could not create share link. Please try again.')
      setShareModal(null)
    }
  }

  async function handleToggleRetries(allow: boolean) {
    if (!shareModal) return
    const res = await fetch(`/api/quizzes/${shareModal.quizId}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowRetries: allow }),
    })
    if (!res.ok) return
    setShareModal(prev => prev ? { ...prev, allowRetries: allow } : prev)
    setQuizzes(prev => prev.map(q => q.id === shareModal.quizId ? { ...q, asyncAllowRetries: allow } : q))
  }

  async function handleSetExpiry(closesAt: string | null) {
    if (!shareModal) return
    const res = await fetch(`/api/quizzes/${shareModal.quizId}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closesAt }),
    })
    if (!res.ok) return
    setShareModal(prev => prev ? { ...prev, closesAt } : prev)
    setQuizzes(prev => prev.map(q => q.id === shareModal.quizId ? { ...q, asyncClosesAt: closesAt } : q))
  }

  async function handleUnpublish() {
    if (!shareModal) return
    const quizId = shareModal.quizId
    await fetch(`/api/quizzes/${quizId}/publish`, { method: 'DELETE' })
    setShareModal(null)
    setQuizzes(prev => prev.map(q => q.id === quizId ? {
      ...q,
      asyncShareSlug: null,
      asyncQuestionCount: 0,
      asyncResponseCount: 0,
      asyncAllowRetries: false,
      asyncClosesAt: null,
      asyncPublishedAt: null,
      asyncNeedsRepublish: false,
    } : q))
  }

  function handleCopyLink() {
    if (!shareModal?.slug) return
    const url = `${window.location.origin}/q/${shareModal.slug}`
    navigator.clipboard.writeText(url).catch(() => {})
    setShareModal(prev => prev ? { ...prev, copied: true } : prev)
    setTimeout(() => setShareModal(prev => prev ? { ...prev, copied: false } : prev), 2000)
  }

  function participantMessage(): string {
    if (!shareModal?.slug || typeof window === 'undefined') return ''
    const url = `${window.location.origin}/q/${shareModal.slug}`
    return `Take this self-paced Quizotic quiz anytime:\n${url}\nNo host or live code needed.`
  }

  function handleCopyMessage() {
    const msg = participantMessage()
    if (!msg) return
    navigator.clipboard.writeText(msg).catch(() => {})
    setShareModal(prev => prev ? { ...prev, messageCopied: true } : prev)
    setTimeout(() => setShareModal(prev => prev ? { ...prev, messageCopied: false } : prev), 2000)
  }

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
          <Link href="/host/create" className="btn-primary" style={{ textDecoration: 'none' }}>
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
            <Link href="/host/create" className="btn-primary" style={{ textDecoration: 'none' }}>
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

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {recent.map((quiz, i) => (
                    <motion.div
                      key={quiz.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-[16px] overflow-hidden flex flex-col"
                      style={{ background: '#fff', border: '1px solid var(--color-line)' }}
                    >
                      {/* Gradient cover with constellation motif */}
                      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: gradientFor(quiz.id) }}>
                        <QuizCoverMotif id={quiz.id} />
                        <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="chip" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', backdropFilter: 'blur(6px)' }}>
                              Quiz
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
                          <h3 className="text-[18px] font-black leading-snug line-clamp-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
                            {quiz.title}
                          </h3>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {quiz.subject && (
                            <span className="chip" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{quiz.subject}</span>
                          )}
                          {quiz.language && quiz.language !== 'en' && (
                            <span className="chip" style={{ background: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }}>{quiz.language.toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-[12px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                          Updated {timeAgo(quiz.updatedAt)}
                        </p>
                        {quiz.asyncShareSlug && (
                          <div className="mb-3 rounded-lg px-2.5 py-2" style={{ background: quiz.asyncNeedsRepublish ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${quiz.asyncNeedsRepublish ? '#FDE68A' : '#BBF7D0'}` }}>
                            <p className="text-[11px] font-bold" style={{ color: quiz.asyncNeedsRepublish ? '#92400E' : '#15803D' }}>
                              {quiz.asyncNeedsRepublish ? 'Republish changes' : 'Self-paced live'}
                            </p>
                            <p className="text-[10px]" style={{ color: '#64748B' }}>
                              {quiz.asyncResponseCount} response{quiz.asyncResponseCount === 1 ? '' : 's'} · {quiz.asyncQuestionCount} question{quiz.asyncQuestionCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2 mt-auto">
                          <Link href={`/host/create?edit=${quiz.id}`} className="btn-secondary flex-1 justify-center" style={{ textDecoration: 'none', padding: '7px 10px', fontSize: '12px' }}>
                            Edit
                          </Link>
                          <button
                            onClick={() => handleShare(quiz.id)}
                            className="btn-secondary flex-1 justify-center"
                            style={{ padding: '7px 9px', fontSize: '11px' }}
                            title="Share self-paced quiz"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {quiz.asyncNeedsRepublish ? 'Republish' : 'Self-paced'}
                          </button>
                          <button
                            onClick={() => handleStart(quiz.id)}
                            disabled={startingId === quiz.id}
                            className="btn-golive flex-1 justify-center"
                            style={{ padding: '7px 9px', fontSize: '11px' }}
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
                        </div>
                      </div>
                    </motion.div>
                  ))}
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
                  <div
                    key={quiz.id}
                    className={`grid grid-cols-[40px_1fr_140px_auto] gap-4 items-center p-3 ${i < arr.length - 1 ? 'border-b' : ''}`}
                    style={{ borderColor: 'var(--color-line)' }}
                  >
                    <div className="w-10 h-10 rounded-[8px]" style={{ background: gradientFor(quiz.id) }} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: '#0F1B3D' }}>{quiz.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {quiz.subject && <span className="chip" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{quiz.subject}</span>}
                        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Updated {timeAgo(quiz.updatedAt)}</span>
                        {quiz.asyncShareSlug && (
                          <span className="chip" style={{ background: quiz.asyncNeedsRepublish ? '#FFFBEB' : '#F0FDF4', color: quiz.asyncNeedsRepublish ? '#92400E' : '#15803D' }}>
                            {quiz.asyncNeedsRepublish ? 'Republish changes' : `${quiz.asyncResponseCount} self-paced`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] hidden md:block" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(quiz.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/host/create?edit=${quiz.id}`} className="btn-secondary" style={{ textDecoration: 'none', padding: '6px 10px', fontSize: '12px' }}>
                        Edit
                      </Link>
                      <button
                        onClick={() => handleShare(quiz.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        title="Share self-paced quiz"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {quiz.asyncNeedsRepublish ? 'Republish' : 'Self-paced'}
                      </button>
                      <button
                        onClick={() => handleStart(quiz.id)}
                        disabled={startingId === quiz.id}
                        className="btn-golive"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      >
                        {startingId === quiz.id ? (
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        ) : (
                          <>
                            <span className="play-dot" style={{ width: '14px', height: '14px' }}><svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2 h-2"><path d="M8 5v14l11-7z"/></svg></span>
                            Host live
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDuplicate(quiz.id)}
                        className="btn-icon"
                        title="Duplicate"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(quiz.id)}
                        className="btn-icon"
                        title="Delete"
                        style={{ color: '#B91C1C' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Share / self-serve link modal */}
      <AnimatePresence>
        {shareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShareModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full shadow-xl"
              style={{ background: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              {shareModal.publishing ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
                  <span className="ml-3 text-sm" style={{ color: '#64748B' }}>Creating share link…</span>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-black mb-1" style={{ color: '#0F1B3D' }}>Self-paced quiz link</h3>
                  <p className="text-sm mb-4" style={{ color: '#64748B' }}>
                    {shareModal.questionCount} question{shareModal.questionCount !== 1 ? 's' : ''} · No host needed · Works anytime.
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Responses</p>
                      <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{shareModal.responseCount}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Published</p>
                      <p className="text-xs font-bold" style={{ color: '#0F1B3D' }}>{shareModal.publishedAt ? timeAgo(shareModal.publishedAt) : 'now'}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Closes</p>
                      <p className="text-xs font-bold" style={{ color: '#0F1B3D' }}>{shareModal.closesAt ? formatDateTime(shareModal.closesAt) : 'Never'}</p>
                    </div>
                  </div>

                  {/* Link display + copy */}
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <span className="flex-1 text-sm truncate" style={{ color: '#0F1B3D', fontFamily: 'monospace' }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/q/${shareModal.slug}` : `/q/${shareModal.slug}`}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-colors"
                      style={{ background: shareModal.copied ? '#16A34A' : '#0F1B3D', color: '#fff' }}
                    >
                      {shareModal.copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="rounded-xl p-3 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: '#0F1B3D' }}>Participant message</p>
                    <textarea
                      readOnly
                      value={participantMessage()}
                      rows={3}
                      className="w-full resize-none rounded-lg px-3 py-2 text-xs outline-none"
                      style={{ background: '#fff', color: '#334155', border: '1px solid #E2E8F0' }}
                    />
                    <button
                      onClick={handleCopyMessage}
                      className="mt-2 w-full py-2 rounded-lg text-xs font-bold"
                      style={{ background: shareModal.messageCopied ? '#16A34A' : '#E2E8F0', color: shareModal.messageCopied ? '#fff' : '#0F1B3D' }}
                    >
                      {shareModal.messageCopied ? 'Message copied!' : 'Copy participant message'}
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-bold mb-2" style={{ color: '#0F1B3D' }}>Link expiry</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Never', value: null as number | null },
                        { label: '7 days', value: 7 },
                        { label: '30 days', value: 30 },
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => handleSetExpiry(closeAtFor(opt.value))}
                          className="py-2 rounded-lg text-xs font-bold border"
                          style={{ color: '#0F1B3D', borderColor: '#E2E8F0', background: '#fff' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Allow retries toggle */}
                  <div className="flex items-center justify-between mb-5 py-3 border-t border-b" style={{ borderColor: '#E2E8F0' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>Allow retakes</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Let players take the quiz more than once</p>
                    </div>
                    <button
                      onClick={() => handleToggleRetries(!shareModal.allowRetries)}
                      className="w-11 h-6 rounded-full relative transition-colors flex-shrink-0"
                      style={{ background: shareModal.allowRetries ? '#16A34A' : '#CBD5E1' }}
                      aria-label="Toggle retakes"
                    >
                      <span
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                        style={{ left: shareModal.allowRetries ? '22px' : '4px' }}
                      />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleUnpublish}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-red-50"
                      style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => setShareModal(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-gray-50"
                      style={{ color: '#0F1B3D', border: '1px solid #E2E8F0' }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
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
