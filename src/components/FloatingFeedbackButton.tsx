'use client'

// Floating feedback button — bottom-right on every page. The fastest way for
// a user to tell us "this broke" without leaving the page they're on.
//
// Why globally mounted (not gated to specific pages):
//   - The bugs we miss most are the ones we can't reproduce. We need the
//     real user, on the real device, in the moment of frustration, with
//     URL + viewport + last-action context attached for free.
//   - A 56px circular button at bottom-right is an established pattern
//     (Intercom, Crisp, Linear) — users find it without friction.
//
// Why hide on certain phases (lobby/question/answered) of /join:
//   - During an active live quiz the participant's screen is precious;
//     a floating button right of the answer options would steal taps.
//   - We listen for the global `data-feedback-hidden` attribute on <html>
//     so the join page (and any other) can hide it during active flow.

import { useState, useEffect, useCallback } from 'react'

const HIDE_ATTR = 'data-feedback-hidden'

export function FloatingFeedbackButton() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Watch the <html data-feedback-hidden> attribute so any page can opt out
  // of showing the button during a critical flow (e.g. live quiz answering).
  useEffect(() => {
    const html = document.documentElement
    const update = () => setHidden(html.hasAttribute(HIDE_ATTR))
    update()
    const obs = new MutationObserver(update)
    obs.observe(html, { attributes: true, attributeFilter: [HIDE_ATTR] })
    return () => obs.disconnect()
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (hidden) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback or report a bug"
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0D0D0D] bg-[#F5E642] text-[#0D0D0D] shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#F5E642]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {open && <FeedbackModal onClose={close} />}
    </>
  )
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!message.trim()) {
      setError('Please describe what happened')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim() || null,
          // Include the URL + a coarse user agent so support has context
          // without us having to chase down the user.
          url: window.location.href,
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Failed (${res.status})`)
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
              className="w-full rounded-xl border-2 border-[#0D0D0D] bg-[#F5E642] py-3 font-bold text-[#0D0D0D] transition-transform hover:scale-[1.02]"
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
                className="flex-1 rounded-xl border-2 border-[#0D0D0D] bg-[#F5E642] py-3 font-bold text-[#0D0D0D] transition-transform hover:scale-[1.02] disabled:scale-100 disabled:opacity-60"
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
