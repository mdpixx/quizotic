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
// origin in the triage email.
//
// `type` switches the modal between general feedback and the dedicated feature
// request flow opened from the host dashboard. It changes the copy (a host with
// a product idea is in a different frame of mind from one reporting a bug) and
// is persisted on the Feedback row so the admin Voice tab can triage roadmap
// signal separately from support noise.

import { useEffect, useState } from 'react'

export type FeedbackType = 'general' | 'feature' | 'bug'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  source?: string
  type?: FeedbackType
}

// Copy is keyed off the type so the feature-request entry point doesn't ask a
// host "What happened?" about an idea they haven't had yet.
const COPY: Record<FeedbackType, {
  title: string
  intro: string
  fieldLabel: string
  placeholder: string
  cta: string
  sentTitle: string
  sentBody: string
  emptyError: string
}> = {
  general: {
    title: 'Send feedback',
    intro: 'Found a bug? Stuck? Have an idea? Tell us — we ship daily.',
    fieldLabel: 'What happened?',
    placeholder: 'Describe the issue or idea…',
    cta: 'Send',
    sentTitle: 'Thanks for the feedback',
    sentBody: 'We read every message. If you left an email we\u2019ll follow up.',
    emptyError: 'Please describe what happened',
  },
  bug: {
    title: 'Report a problem',
    intro: 'Tell us what went wrong and we\u2019ll dig in.',
    fieldLabel: 'What happened?',
    placeholder: 'Describe the issue…',
    cta: 'Send',
    sentTitle: 'Thanks — we\u2019re on it',
    sentBody: 'We read every report. If you left an email we\u2019ll follow up.',
    emptyError: 'Please describe what happened',
  },
  feature: {
    title: 'Request a feature',
    intro: 'What would make Quizotic better for your sessions? Every request is read and shapes what we build next.',
    fieldLabel: 'What would you like us to build?',
    placeholder: 'e.g. Let me import questions from a Google Form, or show a class-wise breakdown in reports…',
    cta: 'Send request',
    sentTitle: 'Request received',
    sentBody: 'Thanks — this goes straight onto our roadmap board. If you left an email we\u2019ll tell you when it ships.',
    emptyError: 'Please describe the feature you\u2019d like',
  },
}

export function FeedbackModal({ open, onClose, source, type = 'general' }: FeedbackModalProps) {
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

  const copy = COPY[type]

  const submit = async () => {
    if (!message.trim()) {
      setError(copy.emptyError)
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
          type,
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
      aria-label={copy.title}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="mb-3 text-4xl">✓</div>
            <h2 className="mb-2 text-xl font-bold text-[#0F1B3D]">{copy.sentTitle}</h2>
            <p className="mb-4 text-sm text-slate-600">{copy.sentBody}</p>
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
            <h2 className="mb-1 text-xl font-bold text-[#0F1B3D]">{copy.title}</h2>
            <p className="mb-4 text-sm text-slate-600">{copy.intro}</p>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {copy.fieldLabel}
            </label>
            <textarea
              autoFocus
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={copy.placeholder}
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
                {submitting ? 'Sending…' : copy.cta}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
