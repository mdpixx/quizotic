'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import QRCode from 'react-qr-code'

interface PhoneRemoteModalProps {
  open: boolean
  onClose: () => void
  gameCode: string
}

const REMOTE_PATH = '/host/remote'

// Client-only origin: the server renders the canonical domain, the client swaps
// in its own origin without a hydration mismatch or an extra render.
const noopSubscribe = () => () => {}
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => 'https://quizotic.live',
  )
}

// "Control from your phone" overlay — the host scans it with their own phone and
// walks away from the laptop.
//
// Account-based pairing means there is NO pairing PIN to display. The phone just
// opens /host/remote signed into the SAME account, and the server hands it the
// session (see server.mjs host_join_remote). Identity, not a visible code, is the
// gate — which is why this is safe to show on a projector at any time.
//
// FIXED, NOT ABSOLUTE — on purpose. This used to be an absolutely-positioned
// popover anchored under a button at the bottom of the lobby's PIN card. That
// card lives in a `lg:overflow-y-auto` column on an `h-svh overflow-hidden` page,
// so the panel opened into dead space below the fold and hosts thought the button
// was broken. Anchoring to the viewport means no ancestor's overflow can clip it.
//
// Modeled on JoinQrModal — same backdrop/blur/escape/click-away behavior, and the
// same solid white card, because a QR needs dark-on-light contrast to scan.
export function PhoneRemoteModal({ open, onClose, gameCode }: PhoneRemoteModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const origin = useOrigin()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  // ?code= takes control of THIS session directly — the remote reads it on mount
  // and skips the "which of your live sessions?" picker entirely.
  const remoteUrl = `${origin}${REMOTE_PATH}?code=${gameCode}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Use your phone as a remote"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,27,61,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden text-center p-7 relative"
        style={{ background: 'rgba(255,255,255,0.98)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full font-bold transition-colors"
          style={{ color: '#64748B', background: 'rgba(15,27,61,0.06)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <span
          className="inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
          style={{ background: '#F1E7FB', color: '#7e1f9b' }}
        >
          Host only — not for participants
        </span>
        <h2
          className="mt-2 font-black leading-tight"
          style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}
        >
          Control from your phone
        </h2>
        <p className="mt-2 text-sm leading-snug" style={{ color: '#64748B' }}>
          Run the quiz from anywhere in the room — start, reveal answers, and move on
          without going back to this screen.
        </p>

        <div className="flex flex-col items-center gap-3 mt-6">
          <div className="p-3 bg-white rounded-2xl border-2" style={{ borderColor: '#2D2A66', boxShadow: '0 6px 0 rgba(15,27,61,0.25)' }}>
            <QRCode value={remoteUrl} size={200} bgColor="#ffffff" fgColor="#0F1B3D" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#2D2A66' }}>Scan with YOUR phone</p>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: '#2D2A66' }}>Or visit</p>
            <p className="text-lg font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>quizotic.live/host/remote</p>
          </div>
          <p className="text-xs leading-snug" style={{ color: '#64748B' }}>
            Sign in with this same account — that is what grants control. If a
            participant scans this, they are asked to sign in as you and get no
            further. Participants join with the game PIN instead.
          </p>
        </div>
      </div>
    </div>
  )
}
