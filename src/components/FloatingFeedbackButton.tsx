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
//
// Mobile drag: on touch devices the button can be dragged anywhere on screen
// and the position is persisted to localStorage so it survives page changes.
// Default mobile position is bottom-20 right-4 so it clears bottom toolbars.

import { useState, useEffect, useCallback, useRef } from 'react'

const HIDE_ATTR = 'data-feedback-hidden'
const STORAGE_KEY = 'quizotic.feedbackBubblePos'
const SIZE = 48   // w-12 / h-12
const DRAG_THRESHOLD = 6    // px of movement before treating as drag
const DRAG_TIME_THRESHOLD = 200  // ms — under this and no movement = tap

interface Pos { x: number; y: number }

function clampPos(x: number, y: number, safeInsets: { top: number; right: number; bottom: number; left: number }): Pos {
  const maxX = window.innerWidth  - SIZE - safeInsets.right  - 4
  const maxY = window.innerHeight - SIZE - safeInsets.bottom - 4
  const minX = safeInsets.left + 4
  const minY = safeInsets.top  + 4
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  }
}

function getSafeInsets() {
  // 8px margin on all sides gives adequate clearance from notch / home indicator
  // without needing to read env(safe-area-inset-*) from JS.
  return { top: 8, right: 8, bottom: 8, left: 8 }
}

export function FloatingFeedbackButton() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)

  const dragRef = useRef<{
    startX: number; startY: number;
    startPosX: number; startPosY: number;
    moved: boolean; startTime: number;
  } | null>(null)

  // Detect touch device once on mount
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  // Restore persisted position on mount (touch only)
  useEffect(() => {
    if (!isTouch) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Pos
        const safeInsets = getSafeInsets()
        setPos(clampPos(saved.x, saved.y, safeInsets))
      } else {
        // Default: bottom-20 right-4 (clears typical mobile bottom toolbars)
        const safeInsets = getSafeInsets()
        const defaultX = window.innerWidth  - SIZE - 16 - safeInsets.right
        const defaultY = window.innerHeight - SIZE - 80 - safeInsets.bottom
        setPos(clampPos(defaultX, defaultY, safeInsets))
      }
    } catch {
      // localStorage not available — stay at CSS default
    }
  }, [isTouch])

  // Watch <html data-feedback-hidden> attribute
  useEffect(() => {
    const html = document.documentElement
    const update = () => setHidden(html.hasAttribute(HIDE_ATTR))
    update()
    const obs = new MutationObserver(update)
    obs.observe(html, { attributes: true, attributeFilter: [HIDE_ATTR] })
    return () => obs.disconnect()
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // Pointer drag handlers (touch only)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isTouch) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos?.x ?? (window.innerWidth  - SIZE - 16),
      startPosY: pos?.y ?? (window.innerHeight - SIZE - 16),
      moved: false,
      startTime: Date.now(),
    }
  }, [isTouch, pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true
    }
    if (dragRef.current.moved) {
      const safeInsets = getSafeInsets()
      setPos(clampPos(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy, safeInsets))
    }
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    const wasDrag = dragRef.current.moved
    const elapsed = Date.now() - dragRef.current.startTime
    dragRef.current = null

    if (wasDrag) {
      // Persist final position
      setPos(prev => {
        if (prev) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)) } catch { /* ignore */ }
        }
        return prev
      })
    } else if (elapsed < DRAG_TIME_THRESHOLD || !wasDrag) {
      // True tap — open modal
      setOpen(true)
    }
  }, [])

  if (hidden) return null

  // On touch with a saved pos, use fixed x/y coordinates.
  // On desktop (or touch before pos is set), fall back to CSS bottom-4 right-4.
  const buttonStyle: React.CSSProperties = (isTouch && pos)
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : {}

  return (
    <>
      <button
        type="button"
        onPointerDown={isTouch ? onPointerDown : undefined}
        onPointerMove={isTouch ? onPointerMove : undefined}
        onPointerUp={isTouch ? onPointerUp : undefined}
        onClick={isTouch ? undefined : () => setOpen(true)}
        aria-label="Send feedback or report a bug"
        style={buttonStyle}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0D0D0D] bg-[#FBD13B] text-[#0D0D0D] shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#FBD13B]"
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
