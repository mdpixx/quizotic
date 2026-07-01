'use client'

// FeedbackModal — the "Send feedback" dialog, decoupled from any trigger.
//
// Previously this lived inside FloatingFeedbackButton (a global floating bubble
// on every page). The bubble was obstructive and rarely used, so it was removed
// in favour of intentional entry points: the host account menu, a footer link,
// and a contextual post-session prompt. Each of those opens THIS modal via the
// FeedbackProvider context.
//
// `source` identifies where the modal was opened from ('account-menu', 'footer',
// 'post-session', …). It is appended to the submitted message so ops can see the
// origin in the triage email — no API schema change needed (/api/feedback still
// only takes message / email / url / userAgent).

import { useEffect, useState } from 'react'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  source?: string
}

export function FeedbackModal({ open, onClose, source }: FeedbackModalProps) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Reset transient state whenever the modal is (re)opened, so a second open
  // after a successful send starts fresh instead of showing the thank-you.
  useEffect(() => {
    if (open) {
      setMessage('')
      setEmail('')
      setSubmitting(false)
      setSent(false)
      setError('')
    }
  }, [open])

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async () => {
    if (!message.trim()) {
      setError('Please describe what happened')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const body = source ? `${message.trim()}\n\n— via ${source}` : message.trim()
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: body,
          email: email.trim() || null,
          url: window.location.href,
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody?.error || `Failed (${res.status})`)
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Feedback"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="mb-3 text-4xl">✓</div>
            <h2 className="mb-2 text-xl font-bold text-[#0F1B3D]">Thanks for the feedback</h2>
            <p className="mb-4 text-sm text-slate-600">
              We read every message. If you left an email we&apos;ll follow up.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border-2 border-[#0D0D0D] bg-[#FBD13B] py-3 font-bold text-[#0D0D0D] transition-transform hover:scale-[1.02]"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-bold text-[#0F1B3D]">Send feedback</h2>
            <p className="mb-4 text-sm text-slate-600">
              Found a bug? Stuck? Have an idea? Tell us — we ship daily.
            </p>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              What happened?
            </label>
            <textarea
              autoFocus
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe the issue or idea…"
              className="mb-3 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm focus:border-[#0F1B3D] focus:outline-none"
            />
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email (optional, so we can reply)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              maxLength={200}
              placeholder="you@example.com"
              className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-[#0F1B3D] focus:outline-none"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !message.trim()}
                className="flex-1 rounded-xl border-2 border-[#0D0D0D] bg-[#FBD13B] py-3 font-bold text-[#0D0D0D] transition-transform hover:scale-[1.02] disabled:scale-100 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
