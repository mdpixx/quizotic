'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'

// Host dashboard for self-paced / scheduled sessions. Polls /api/scheduled every
// 30s and groups sessions into upcoming, open now, and recently closed. Live
// countdowns use a serverNow→client offset so they stay correct even if the
// host's clock is skewed.

type Phase = 'upcoming' | 'open' | 'ended'

interface ScheduledSession {
  sessionId: string
  quizId: string
  title: string
  questionCount: number
  shareSlug: string | null
  phase: Phase
  opensAt: string | null
  closesAt: string | null
  timeLimitMinutes: number | null
  allowRetries: boolean
  joinedCount: number
  finishedCount: number
  avgScore: number | null
  createdAt: string
  endedAt: string | null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// HH:MM:SS countdown from a millisecond delta; clamps at zero.
function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const ICON = {
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 21v.01M17 21h.01M21 17h.01"/></svg>
  ),
  cancel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>
  ),
}

function CopyLinkButton({ slug }: { slug: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!slug) return null
  const url = typeof window !== 'undefined' ? `${window.location.origin}/q/${slug}` : `/q/${slug}`
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(url).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
      style={{ background: copied ? '#16A34A' : '#0F1B3D', color: '#fff' }}
    >
      {ICON.copy}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}

function QrToggle({ slug }: { slug: string | null }) {
  const [open, setOpen] = useState(false)
  if (!slug) return null
  const url = typeof window !== 'undefined' ? `${window.location.origin}/q/${slug}` : `/q/${slug}`
  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:bg-gray-50"
        style={{ color: '#0F1B3D', borderColor: '#E2E8F0' }}
        aria-expanded={open}
      >
        {ICON.qr}
        {open ? 'Hide QR' : 'Show QR'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-2.5 bg-white rounded-xl inline-block" style={{ border: '1px solid #E2E8F0' }}>
              <QRCode value={url} size={128} bgColor="#ffffff" fgColor="#0F1B3D" level="M" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ScheduledPage() {
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState<ScheduledSession | null>(null)
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set())
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Client clock offset (serverNow - Date.now()) so countdowns track server time.
  const offsetRef = useRef(0)
  const [tick, setTick] = useState(0)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled')
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error || 'Could not load scheduled quizzes.')
        return
      }
      offsetRef.current = new Date(json.data.serverNow).getTime() - Date.now()
      setSessions(json.data.sessions ?? [])
      setError('')
    } catch {
      setError('Could not load scheduled quizzes. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    const poll = setInterval(fetchSessions, 30000)
    return () => clearInterval(poll)
  }, [fetchSessions])

  // 1s tick drives the live countdowns.
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const serverNow = () => Date.now() + offsetRef.current

  async function handleCancel(session: ScheduledSession) {
    setCancellingId(session.sessionId)
    try {
      await fetch(`/api/quizzes/${session.quizId}/publish`, { method: 'DELETE' })
      setConfirmCancel(null)
      await fetchSessions()
    } finally {
      setCancellingId(null)
    }
  }

  async function handleCloseNow(session: ScheduledSession) {
    setClosingIds(prev => new Set(prev).add(session.sessionId))
    try {
      // DELETE ends the session immediately (a PATCH to closesAt=now would be
      // rejected as "in the past" by the publish validation). The 60s sweep
      // then finalizes in-progress attempts and writes the results JSON.
      await fetch(`/api/quizzes/${session.quizId}/publish`, { method: 'DELETE' }).catch(() => {})
      await fetchSessions()
    } finally {
      setClosingIds(prev => {
        const next = new Set(prev)
        next.delete(session.sessionId)
        return next
      })
    }
  }

  // tick read keeps the countdown re-rendering each second.
  void tick

  const upcoming = sessions.filter(s => s.phase === 'upcoming')
  const open = sessions.filter(s => s.phase === 'open')
  const ended = sessions.filter(s => s.phase === 'ended')

  return (
    <div className="paper-grain min-h-full" style={{ background: 'var(--color-paper)' }}>
      <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[28px] font-black leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Scheduled
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Self-paced quizzes that open, run, and close on a schedule — no host needed.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-[16px]" style={{ background: 'var(--color-paper-2)', border: '1px dashed #DDD4BC' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#fff', border: '1px solid var(--color-line)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M14.5 16.5l-2.5 1.5"/></svg>
            </div>
            <p className="text-[18px] font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              Nothing scheduled yet.
            </p>
            <p className="text-sm mb-5 max-w-[42ch]" style={{ color: 'var(--color-text-muted)' }}>
              Open <strong>My Quizzes</strong>, hit <strong>Assign</strong> on any quiz, and pick a date and time on the Schedule tab.
            </p>
            <Link href="/host/quizzes" className="btn-primary" style={{ textDecoration: 'none' }}>
              Go to My Quizzes
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Upcoming ── */}
            {upcoming.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[16px] font-black" style={{ color: '#0F1B3D' }}>Upcoming</h2>
                  <span className="chip" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>{upcoming.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {upcoming.map(s => {
                    const opensMs = s.opensAt ? new Date(s.opensAt).getTime() - serverNow() : 0
                    return (
                      <div key={s.sessionId} className="rounded-2xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-[15px] font-black leading-snug" style={{ color: '#0F1B3D' }}>{s.title}</h3>
                          <span className="chip flex-shrink-0" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>{s.questionCount} Qs</span>
                        </div>
                        <div className="rounded-xl px-3 py-2 mb-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>Opens in</p>
                          <p className="text-lg font-black tabular-nums" style={{ color: '#92400E' }}>{fmtCountdown(opensMs)}</p>
                        </div>
                        <div className="text-[12px] mb-3 space-y-0.5" style={{ color: '#64748B' }}>
                          <p>Opens {fmtDateTime(s.opensAt)}</p>
                          <p>Closes {fmtDateTime(s.closesAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-start gap-2">
                          <CopyLinkButton slug={s.shareSlug} />
                          <QrToggle slug={s.shareSlug} />
                          <button
                            onClick={() => setConfirmCancel(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:bg-red-50"
                            style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                          >
                            {ICON.cancel}
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Open now ── */}
            {open.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[16px] font-black" style={{ color: '#0F1B3D' }}>Open now</h2>
                  <span className="chip" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0' }}>{open.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {open.map(s => {
                    const closesMs = s.closesAt ? new Date(s.closesAt).getTime() - serverNow() : null
                    const closing = closingIds.has(s.sessionId)
                    return (
                      <div key={s.sessionId} className="rounded-2xl border p-4 bg-white" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-[15px] font-black leading-snug" style={{ color: '#0F1B3D' }}>{s.title}</h3>
                          <span className="chip flex-shrink-0" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0' }}>Live</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Joined</p>
                            <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{s.joinedCount}</p>
                          </div>
                          <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Finished</p>
                            <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{s.finishedCount}</p>
                          </div>
                        </div>
                        <div className="text-[12px] mb-3" style={{ color: '#64748B' }}>
                          <p>Closes {fmtDateTime(s.closesAt)}</p>
                          {closesMs !== null && (
                            <p className="font-bold tabular-nums" style={{ color: '#0F1B3D' }}>Closes in {fmtCountdown(closesMs)}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyLinkButton slug={s.shareSlug} />
                          <button
                            onClick={() => handleCloseNow(s)}
                            disabled={closing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-60 hover:bg-red-50"
                            style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                          >
                            {closing ? 'Closing…' : 'Close now'}
                          </button>
                          <Link
                            href={`/host/quizzes/${s.quizId}/report`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:bg-gray-50"
                            style={{ color: '#0F1B3D', borderColor: '#E2E8F0', textDecoration: 'none' }}
                          >
                            {ICON.report}
                            View live report
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Recently closed ── */}
            {ended.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[16px] font-black" style={{ color: '#0F1B3D' }}>Recently closed</h2>
                  <span className="chip" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>{ended.length}</span>
                </div>
                <div className="rounded-[16px] overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
                  {ended.map((s, i, arr) => (
                    <div
                      key={s.sessionId}
                      className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b' : ''}`}
                      style={{ borderColor: '#E2E8F0' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold truncate" style={{ color: '#0F1B3D' }}>{s.title}</p>
                        <p className="text-[11px]" style={{ color: '#64748B' }}>
                          {s.finishedCount} participant{s.finishedCount === 1 ? '' : 's'}
                          {s.avgScore !== null && <> · avg {s.avgScore}</>}
                          {s.endedAt && <> · ended {fmtDate(s.endedAt)}</>}
                        </p>
                      </div>
                      <Link
                        href={`/host/quizzes/${s.quizId}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:bg-gray-50 flex-shrink-0"
                        style={{ color: '#0F1B3D', borderColor: '#E2E8F0', textDecoration: 'none' }}
                      >
                        {ICON.report}
                        View report
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      <AnimatePresence>
        {confirmCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setConfirmCancel(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full shadow-xl"
              style={{ background: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black mb-2" style={{ color: '#0F1B3D' }}>Cancel this schedule?</h3>
              <p className="text-sm mb-5" style={{ color: '#64748B' }}>
                &ldquo;{confirmCancel.title}&rdquo; will be taken down and its share link will stop working. You can re-assign it anytime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmCancel(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                  style={{ color: '#64748B', borderColor: '#E2E8F0' }}
                >
                  Keep it
                </button>
                <button
                  onClick={() => handleCancel(confirmCancel)}
                  disabled={cancellingId === confirmCancel.sessionId}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-red-600 disabled:opacity-60"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {cancellingId === confirmCancel.sessionId ? 'Cancelling…' : 'Cancel schedule'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
