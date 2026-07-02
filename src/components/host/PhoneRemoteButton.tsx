'use client'

// PhoneRemoteButton — non-secret "use your phone as a remote" affordance.
//
// Account-based pairing means there is NO pairing PIN to display. The host just
// opens quizotic.live/host/remote on their phone (signed into the SAME account)
// and their live session is there to control. So this affordance is safe to
// show anytime — on the projector lobby AND during the live quiz — because
// identity, not a visible code, is the gate (see server.mjs host_join_remote).
//
// Self-contained popover + QR so it can drop into the big session page without
// threading open/close state through it. Used in two places:
//   - lobby (variant="lobby") — a pill under the Game PIN card
//   - live control bar (variant="bar") — a compact icon button

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import QRCode from 'react-qr-code'

const REMOTE_PATH = '/host/remote'

// Client-only constant: server renders the canonical domain, the client
// swaps in its own origin without a hydration mismatch or an extra render.
const noopSubscribe = () => () => {}
function useRemoteUrl(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin + REMOTE_PATH,
    () => 'https://quizotic.live' + REMOTE_PATH,
  )
}

interface PhoneRemoteButtonProps {
  /** lobby = light pill on the PIN card; bar = dark icon in the control bar. */
  variant: 'lobby' | 'bar'
}

export function PhoneRemoteButton({ variant }: PhoneRemoteButtonProps) {
  const [open, setOpen] = useState(false)
  const remoteUrl = useRemoteUrl()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isBar = variant === 'bar'

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Use your phone as a remote"
        title="Use your phone as a remote"
        className={
          isBar
            ? 'flex h-10 w-10 items-center justify-center rounded-xl transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2'
            : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-offset-2'
        }
        style={
          isBar
            ? {
                background: open ? 'rgba(251,209,59,0.22)' : 'rgba(255,255,255,0.08)',
                color: open ? '#FBD13B' : 'rgba(255,255,255,0.78)',
                border: `1px solid ${open ? 'rgba(251,209,59,0.5)' : 'rgba(255,255,255,0.14)'}`,
              }
            : {
                background: '#FFFFFF',
                color: '#46107a',
                border: '1.5px solid #E2D9F3',
                boxShadow: '0 2px 8px rgba(70,16,122,0.08)',
              }
        }
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
        {!isBar && <span>Use phone as remote</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Phone remote pairing"
          className="absolute z-50 w-64 rounded-2xl p-4 text-center"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2D9F3',
            boxShadow: '0 18px 50px rgba(15,27,61,0.28)',
            bottom: isBar ? 'calc(100% + 12px)' : undefined,
            top: isBar ? undefined : 'calc(100% + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.16em] mb-2" style={{ color: '#7e1f9b' }}>
            Control from your phone
          </p>
          <div className="mx-auto bg-white p-2 rounded-xl" style={{ width: 'fit-content' }}>
            <QRCode value={remoteUrl} size={132} fgColor="#46107a" bgColor="#FFFFFF" />
          </div>
          <p className="mt-3 text-sm font-bold" style={{ color: '#46107a' }}>quizotic.live/host/remote</p>
          <p className="mt-1 text-xs leading-snug" style={{ color: '#64748B' }}>
            Open on your phone and sign in with this same account. No code needed.
          </p>
        </div>
      )}
    </div>
  )
}
