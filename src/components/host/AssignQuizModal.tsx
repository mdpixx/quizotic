'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'react-qr-code'
import { track } from '@/lib/analytics'

// Self-contained modal that replaces the old inline share dialog. It fetches /
// publishes its own state so callers only pass identity + a change callback.
// Two tabs:
//   • Share now  — publish immediately (POST), live response count, retries,
//                  closes-at + time-limit controls, unpublish.
//   • Schedule   — opensAt / closesAt datetime-local inputs (sent as UTC ISO),
//                  same retries + time-limit controls.
// Once a session exists, both tabs show the result block: link + copy, QR with a
// PNG download, and a copy-invite-message button.

interface AssignQuizModalProps {
  quizId: string
  quizTitle: string
  // Whether the quiz already has an open share session. When false the modal
  // must NOT publish on open — merely looking at the Assign dialog should
  // never make a quiz publicly joinable.
  hasExistingShare: boolean
  onClose: () => void
  onChanged: (quizId: string, patch: QuizPatch) => void
}

// Subset of QuizRecord fields the parent list mirrors after a change.
export interface QuizPatch {
  asyncShareSlug: string | null
  asyncQuestionCount: number
  asyncResponseCount: number
  asyncAllowRetries: boolean
  asyncOpensAt: string | null
  asyncClosesAt: string | null
  asyncPublishedAt: string | null
  asyncNeedsRepublish: boolean
}

interface PublishData {
  shareSlug: string | null
  questionCount: number
  responseCount: number
  allowRetries: boolean
  opensAt: string | null
  closesAt: string | null
  publishedAt: string | null
  needsRepublish: boolean
  timeLimitMinutes: number | null
}

type Tab = 'now' | 'schedule'

const TIME_LIMITS: Array<{ label: string; value: number | null }> = [
  { label: 'None', value: null },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
]

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function closeAtFor(days: number | null): string | null {
  if (days === null) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

// datetime-local wants `YYYY-MM-DDTHH:mm` in *local* time; toISOString is UTC,
// so we offset by the timezone before slicing.
function toLocalInputValue(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function defaultOpensValue(): string {
  // Default to the next hour boundary, today.
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return toLocalInputValue(d)
}

function plusOneDay(localValue: string): string {
  if (!localValue) return ''
  const base = new Date(localValue)
  if (isNaN(base.getTime())) return ''
  return toLocalInputValue(new Date(base.getTime() + 24 * 60 * 60 * 1000))
}

export function AssignQuizModal({ quizId, quizTitle, hasExistingShare, onClose, onChanged }: AssignQuizModalProps) {
  const [tab, setTab] = useState<Tab>('now')
  const [loading, setLoading] = useState(hasExistingShare)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<PublishData | null>(null)
  const [copied, setCopied] = useState(false)
  const [messageCopied, setMessageCopied] = useState(false)

  // Schedule tab inputs (local datetime-local strings)
  const [opensInput, setOpensInput] = useState<string>(defaultOpensValue)
  const [closesInput, setClosesInput] = useState<string>(() => plusOneDay(defaultOpensValue()))
  const [scheduleRetries, setScheduleRetries] = useState(false)
  const [scheduleTimeLimit, setScheduleTimeLimit] = useState<number | null>(null)

  const qrRef = useRef<HTMLDivElement>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = data?.shareSlug ?? null
  const shareUrl = slug ? `${origin}/q/${slug}` : ''
  const isScheduledUpcoming = !!(data?.opensAt && new Date(data.opensAt).getTime() > Date.now())

  const pushPatch = useCallback((d: PublishData) => {
    onChanged(quizId, {
      asyncShareSlug: d.shareSlug,
      asyncQuestionCount: d.questionCount,
      asyncResponseCount: d.responseCount,
      asyncAllowRetries: d.allowRetries,
      asyncOpensAt: d.opensAt,
      asyncClosesAt: d.closesAt,
      asyncPublishedAt: d.publishedAt,
      asyncNeedsRepublish: d.needsRepublish,
    })
  }, [onChanged, quizId])

  // On mount, ONLY when a share session already exists: POST to load its
  // state. The POST is idempotent server-side — it returns the open session
  // (republishing a stale snapshot if needed) rather than creating a
  // duplicate. For an unshared quiz we do nothing: publishing happens only on
  // an explicit user action ("Create share link" / "Schedule quiz"), so
  // opening this dialog never silently makes a quiz publicly joinable.
  useEffect(() => {
    if (!hasExistingShare) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/quizzes/${quizId}/publish`, { method: 'POST' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.success) {
          const issueMessage = Array.isArray(json.issues)
            ? json.issues.map((issue: { questionIndex: number; message: string }) => `Q${issue.questionIndex + 1}: ${issue.message}`).join(' ')
            : ''
          setError(issueMessage || json.error || 'Could not load share link.')
          setLoading(false)
          return
        }
        const next = normalize(json.data)
        setData(next)
        if (next.opensAt) setTab('schedule')
        setScheduleRetries(next.allowRetries)
        setScheduleTimeLimit(next.timeLimitMinutes)
        if (next.opensAt) setOpensInput(toLocalInputValue(new Date(next.opensAt)))
        if (next.closesAt) setClosesInput(toLocalInputValue(new Date(next.closesAt)))
        pushPatch(next)
      } catch {
        if (!cancelled) setError('Could not load share link. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, hasExistingShare])

  // Explicit publish for the share-now path of an unshared quiz.
  async function handlePublishNow() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/quizzes/${quizId}/publish`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        const issueMessage = Array.isArray(json.issues)
          ? json.issues.map((issue: { questionIndex: number; message: string }) => `Q${issue.questionIndex + 1}: ${issue.message}`).join(' ')
          : ''
        setError(issueMessage || json.error || 'Could not create the share link.')
        return
      }
      const next = normalize(json.data)
      setData(next)
      setScheduleRetries(next.allowRetries)
      setScheduleTimeLimit(next.timeLimitMinutes)
      pushPatch(next)
    } catch {
      setError('Could not create the share link. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function normalize(raw: Record<string, unknown>): PublishData {
    return {
      shareSlug: (raw.shareSlug as string | null) ?? null,
      questionCount: (raw.questionCount as number) ?? 0,
      responseCount: (raw.responseCount as number) ?? 0,
      allowRetries: !!raw.allowRetries,
      opensAt: (raw.opensAt as string | null) ?? null,
      closesAt: (raw.closesAt as string | null) ?? null,
      publishedAt: (raw.publishedAt as string | null) ?? null,
      needsRepublish: !!raw.needsRepublish,
      timeLimitMinutes: (raw.timeLimitMinutes as number | null) ?? null,
    }
  }

  async function patchSession(body: Record<string, unknown>): Promise<boolean> {
    setError('')
    const res = await fetch(`/api/quizzes/${quizId}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) {
      setError(json.error || 'Could not update.')
      return false
    }
    setData(prev => {
      if (!prev) return prev
      const updated: PublishData = {
        ...prev,
        allowRetries: typeof json.data.allowRetries === 'boolean' ? json.data.allowRetries : prev.allowRetries,
        opensAt: 'opensAt' in json.data ? (json.data.opensAt ?? null) : prev.opensAt,
        closesAt: 'closesAt' in json.data ? (json.data.closesAt ?? null) : prev.closesAt,
        timeLimitMinutes: 'timeLimitMinutes' in json.data ? (json.data.timeLimitMinutes ?? null) : prev.timeLimitMinutes,
      }
      pushPatch(updated)
      return updated
    })
    return true
  }

  async function handleToggleRetries(allow: boolean) {
    await patchSession({ allowRetries: allow })
  }

  async function handleSetExpiry(closesAt: string | null) {
    await patchSession({ closesAt })
  }

  async function handleSetTimeLimit(minutes: number | null) {
    await patchSession({ timeLimitMinutes: minutes })
  }

  async function handleSaveSchedule() {
    setError('')
    if (!opensInput || !closesInput) {
      setError('Pick both an open and close time.')
      return
    }
    const opensISO = new Date(opensInput).toISOString()
    const closesISO = new Date(closesInput).toISOString()
    setSaving(true)
    try {
      const body = { opensAt: opensISO, closesAt: closesISO, allowRetries: scheduleRetries, timeLimitMinutes: scheduleTimeLimit }
      // POST if no session yet, PATCH to reschedule an existing one.
      const method = data?.shareSlug ? 'PATCH' : 'POST'
      const res = await fetch(`/api/quizzes/${quizId}/publish`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        const issueMessage = Array.isArray(json.issues)
          ? json.issues.map((issue: { questionIndex: number; message: string }) => `Q${issue.questionIndex + 1}: ${issue.message}`).join(' ')
          : ''
        setError(issueMessage || json.error || 'Could not schedule the quiz.')
        return
      }
      setData(prev => {
        const merged = method === 'POST'
          ? normalize(json.data)
          : {
              ...(prev ?? normalize(json.data)),
              shareSlug: json.data.shareSlug ?? prev?.shareSlug ?? null,
              allowRetries: typeof json.data.allowRetries === 'boolean' ? json.data.allowRetries : scheduleRetries,
              opensAt: json.data.opensAt ?? opensISO,
              closesAt: json.data.closesAt ?? closesISO,
              timeLimitMinutes: 'timeLimitMinutes' in json.data ? (json.data.timeLimitMinutes ?? null) : scheduleTimeLimit,
            }
        pushPatch(merged)
        return merged
      })
      track('quiz_scheduled', { quizId, opensAt: opensISO, closesAt: closesISO })
    } catch {
      setError('Could not schedule the quiz. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnpublish() {
    setError('')
    await fetch(`/api/quizzes/${quizId}/publish`, { method: 'DELETE' })
    onChanged(quizId, {
      asyncShareSlug: null,
      asyncQuestionCount: 0,
      asyncResponseCount: 0,
      asyncAllowRetries: false,
      asyncOpensAt: null,
      asyncClosesAt: null,
      asyncPublishedAt: null,
      asyncNeedsRepublish: false,
    })
    onClose()
  }

  function handleCopyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function inviteMessage(): string {
    if (!shareUrl) return ''
    if (isScheduledUpcoming && data?.opensAt) {
      return `"${quizTitle}" opens ${formatDateTime(data.opensAt)}.\nTake it here:\n${shareUrl}`
    }
    return `Take "${quizTitle}" on Quizotic anytime:\n${shareUrl}\nNo host or live code needed.`
  }

  function handleCopyMessage() {
    const msg = inviteMessage()
    if (!msg) return
    navigator.clipboard.writeText(msg).catch(() => {})
    setMessageCopied(true)
    setTimeout(() => setMessageCopied(false), 2000)
  }

  // Serialize the rendered QR <svg> to a 1024px PNG and trigger a download.
  function handleDownloadQR() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !slug) return
    const size = 1024
    const serialized = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = `quizotic-${slug}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  const currentExpiryDays = (() => {
    if (!data?.closesAt) return null
    const remainingMs = new Date(data.closesAt).getTime() - Date.now()
    return remainingMs < 14 * 86400000 ? 7 : 30
  })()

  const hasSession = !!data?.shareSlug

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ background: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>Assign quiz</h3>
            <p className="text-xs mt-0.5 truncate max-w-[18rem]" style={{ color: '#64748B' }}>{quizTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
            aria-label="Close"
            style={{ color: '#94A3B8' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#F1F5F9' }}>
          <button
            onClick={() => setTab('now')}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
            style={{ background: tab === 'now' ? '#fff' : 'transparent', color: tab === 'now' ? '#0F1B3D' : '#64748B', boxShadow: tab === 'now' ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}
          >
            Share now
          </button>
          <button
            onClick={() => setTab('schedule')}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
            style={{ background: tab === 'schedule' ? '#fff' : 'transparent', color: tab === 'schedule' ? '#0F1B3D' : '#64748B', boxShadow: tab === 'schedule' ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}
          >
            Schedule
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
            <span className="ml-3 text-sm" style={{ color: '#64748B' }}>Loading…</span>
          </div>
        ) : (
          <>
            {data?.needsRepublish && (
              <div className="mb-4 px-3 py-2.5 rounded-xl text-xs font-medium" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                This quiz changed since it was shared. Re-save the schedule or toggle a setting to republish the latest version.
              </div>
            )}

            {/* Result block — shown once a session exists, on both tabs */}
            {hasSession && (
              <div className="mb-4">
                {isScheduledUpcoming && data?.opensAt ? (
                  <div className="mb-3 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                    Scheduled — opens {formatDateTime(data.opensAt)}
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                    <span>Live now</span>
                    <span>{data?.responseCount ?? 0} response{(data?.responseCount ?? 0) === 1 ? '' : 's'}</span>
                  </div>
                )}

                {/* QR */}
                <div className="flex flex-col items-center mb-3">
                  <div ref={qrRef} className="p-3 bg-white rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
                    <QRCode value={shareUrl} size={160} bgColor="#ffffff" fgColor="#0F1B3D" level="M" />
                  </div>
                  <button
                    onClick={handleDownloadQR}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-gray-50"
                    style={{ color: '#0F1B3D', border: '1px solid #E2E8F0' }}
                  >
                    Download QR
                  </button>
                </div>

                {/* Link + copy */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <span className="flex-1 text-sm truncate" style={{ color: '#0F1B3D', fontFamily: 'monospace' }}>{shareUrl}</span>
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-colors"
                    style={{ background: copied ? '#16A34A' : '#0F1B3D', color: '#fff' }}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>

                {/* Invite message */}
                <button
                  onClick={handleCopyMessage}
                  className="w-full py-2 rounded-lg text-xs font-bold transition-colors"
                  style={{ background: messageCopied ? '#16A34A' : '#E2E8F0', color: messageCopied ? '#fff' : '#0F1B3D' }}
                >
                  {messageCopied ? 'Invite copied!' : 'Copy invite message'}
                </button>
              </div>
            )}

            {/* ── Share-now tab ── */}
            {tab === 'now' && (
              <div>
                {hasSession ? (
                  <>
                    {/* Link expiry — owned by the Schedule tab when a window is set,
                        so hide it here to avoid silently overwriting the schedule. */}
                    <div className="mb-4" style={isScheduledUpcoming ? { display: 'none' } : undefined}>
                      <p className="text-xs font-bold mb-2" style={{ color: '#0F1B3D' }}>Link expiry</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Never', value: null as number | null },
                          { label: '7 days', value: 7 },
                          { label: '30 days', value: 30 },
                        ].map(opt => {
                          const active = currentExpiryDays === opt.value
                          return (
                            <button
                              key={opt.label}
                              onClick={() => handleSetExpiry(closeAtFor(opt.value))}
                              aria-pressed={active}
                              className="py-2 rounded-lg text-xs font-bold border transition-colors"
                              style={{ background: active ? '#0F1B3D' : '#fff', color: active ? '#F5E642' : '#0F1B3D', borderColor: active ? '#0F1B3D' : '#E2E8F0' }}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Allow retries */}
                    <div className="flex items-center justify-between mb-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>Allow retakes</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Let players take the quiz more than once</p>
                      </div>
                      <button
                        onClick={() => handleToggleRetries(!data?.allowRetries)}
                        className="w-11 h-6 rounded-full relative transition-colors flex-shrink-0"
                        style={{ background: data?.allowRetries ? '#16A34A' : '#CBD5E1' }}
                        aria-label="Toggle retakes"
                        aria-pressed={!!data?.allowRetries}
                      >
                        <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" style={{ left: data?.allowRetries ? '22px' : '4px' }} />
                      </button>
                    </div>

                    {/* Time limit */}
                    <div className="mb-5 pb-4 border-b" style={{ borderColor: '#E2E8F0' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: '#0F1B3D' }}>Time limit per attempt</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {TIME_LIMITS.map(opt => {
                          const active = data?.timeLimitMinutes === opt.value
                          return (
                            <button
                              key={opt.label}
                              onClick={() => handleSetTimeLimit(opt.value)}
                              className="py-1.5 rounded-lg text-xs font-bold border transition-colors"
                              style={{ background: active ? '#0F1B3D' : '#fff', color: active ? '#F5E642' : '#0F1B3D', borderColor: active ? '#0F1B3D' : '#E2E8F0' }}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
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
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-gray-50"
                        style={{ color: '#0F1B3D', border: '1px solid #E2E8F0' }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm mb-4" style={{ color: '#64748B' }}>
                      Get a link and QR code anyone can use to take this quiz at their own pace — no live session needed.
                    </p>
                    <button
                      onClick={handlePublishNow}
                      disabled={saving}
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                      style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D' }}
                    >
                      {saving ? 'Creating…' : 'Create share link'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Schedule tab ── */}
            {tab === 'schedule' && (
              <div>
                <div className="grid gap-3 mb-4">
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: '#0F1B3D' }}>Opens at</label>
                    <input
                      type="datetime-local"
                      value={opensInput}
                      onChange={e => {
                        const v = e.target.value
                        setOpensInput(v)
                        // Keep closes ahead of opens — default to opens + 1 day if it falls behind.
                        if (!closesInput || new Date(closesInput) <= new Date(v)) setClosesInput(plusOneDay(v))
                      }}
                      className="w-full h-10 px-3 text-sm rounded-lg outline-none focus:ring-2 focus:ring-yellow-200"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F1B3D' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: '#0F1B3D' }}>Closes at</label>
                    <input
                      type="datetime-local"
                      value={closesInput}
                      onChange={e => setClosesInput(e.target.value)}
                      className="w-full h-10 px-3 text-sm rounded-lg outline-none focus:ring-2 focus:ring-yellow-200"
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F1B3D' }}
                    />
                  </div>
                </div>

                {/* Allow retries */}
                <div className="flex items-center justify-between mb-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>Allow retakes</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>Let players take the quiz more than once</p>
                  </div>
                  <button
                    onClick={() => setScheduleRetries(r => !r)}
                    className="w-11 h-6 rounded-full relative transition-colors flex-shrink-0"
                    style={{ background: scheduleRetries ? '#16A34A' : '#CBD5E1' }}
                    aria-label="Toggle retakes"
                    aria-pressed={scheduleRetries}
                  >
                    <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" style={{ left: scheduleRetries ? '22px' : '4px' }} />
                  </button>
                </div>

                {/* Time limit */}
                <div className="mb-5 pb-4 border-b" style={{ borderColor: '#E2E8F0' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#0F1B3D' }}>Time limit per attempt</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_LIMITS.map(opt => {
                      const active = scheduleTimeLimit === opt.value
                      return (
                        <button
                          key={opt.label}
                          onClick={() => setScheduleTimeLimit(opt.value)}
                          className="py-1.5 rounded-lg text-xs font-bold border transition-colors"
                          style={{ background: active ? '#0F1B3D' : '#fff', color: active ? '#F5E642' : '#0F1B3D', borderColor: active ? '#0F1B3D' : '#E2E8F0' }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  {hasSession && (
                    <button
                      onClick={handleUnpublish}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-red-50"
                      style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                    >
                      Cancel schedule
                    </button>
                  )}
                  <button
                    onClick={handleSaveSchedule}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                    style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D' }}
                  >
                    {saving ? 'Saving…' : hasSession ? 'Update schedule' : 'Schedule quiz'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
