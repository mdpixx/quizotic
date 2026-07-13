'use client'

import QRCode from 'react-qr-code'

interface JoinPillProps {
  gameCode: string
  variant?: 'fixed' | 'inline' | 'dock' | 'compact'
}

// Small always-visible join pill — small QR + 6-digit code + join URL — so
// late-joining participants can jump in mid-session without the host having
// to switch screens. Fixed variant anchors top-right; inline variant flows
// with surrounding layout.
export function JoinPill({ gameCode, variant = 'fixed' }: JoinPillProps) {
  if (!gameCode) return null

  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.quizotic.live')
  const joinUrl = `${origin}/join?code=${gameCode}`

  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-md border border-gray-200"
        aria-label="Join this session"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Join</span>
        <span className="text-base font-black tabular-nums" style={{ color: '#0F1B3D', letterSpacing: '0.08em' }}>
          {gameCode}
        </span>
      </div>
    )
  }

  const containerClass = variant === 'fixed'
    ? 'fixed top-4 right-4 z-40 hidden md:flex'
    : variant === 'dock'
      ? 'flex'
    : 'flex'

  const qrSize = variant === 'dock' ? 64 : 56
  const cardClass = variant === 'dock'
    ? 'items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg px-3 py-2'
    : 'items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-md px-3 py-2'

  return (
    <div
      className={`${containerClass} ${cardClass}`}
      aria-label="Join this session"
    >
      <div className="p-1 bg-white rounded-lg">
        <QRCode value={joinUrl} size={qrSize} bgColor="#ffffff" fgColor="#0F1B3D" level="L" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Join</span>
        <span className="text-xl font-black tabular-nums" style={{ color: '#0F1B3D', letterSpacing: '0.1em' }}>
          {gameCode}
        </span>
        <span className="text-[10px] font-semibold text-gray-500">quizotic.live/join</span>
      </div>
    </div>
  )
}
