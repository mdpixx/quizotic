'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'react-qr-code'

interface JoinQrModalProps {
  open: boolean
  onClose: () => void
  gameCode: string
}

// Mid-session "scan to join" overlay so latecomers can hop in without the
// host leaving the question stage. Modeled on EndQuizConfirmModal — same
// backdrop/blur/escape/click-away behavior. The card is solid white on
// purpose: a QR needs dark-on-light contrast to scan reliably from across a
// room, and the navy stage behind it makes the card read as a spotlight.
export function JoinQrModal({ open, onClose, gameCode }: JoinQrModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

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

  // Same construction as the lobby QR and JoinPill — one canonical join URL.
  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan to join the game"
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

        <p className="text-xs tracking-[0.4em] font-black uppercase mb-2" style={{ color: '#2D2A66' }}>Game PIN</p>
        <p
          className="font-black leading-none select-all whitespace-nowrap"
          style={{
            fontSize: 'clamp(36px, 4vw, 56px)',
            letterSpacing: '0.04em',
            backgroundImage: 'linear-gradient(135deg, #0F1B3D 0%, #2D2A66 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            fontFamily: 'var(--font-display)',
          }}
        >
          {gameCode}
        </p>

        <div className="flex flex-col items-center gap-3 mt-6">
          <div className="p-3 bg-white rounded-2xl border-2" style={{ borderColor: '#2D2A66', boxShadow: '0 6px 0 rgba(15,27,61,0.25)' }}>
            <QRCode value={joinUrl} size={224} bgColor="#ffffff" fgColor="#0F1B3D" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#2D2A66' }}>Scan to join</p>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: '#2D2A66' }}>Or visit</p>
            <p className="text-xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>quizotic.live/join</p>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>enter code <span className="font-mono font-black" style={{ color: '#0F1B3D' }}>{gameCode}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
