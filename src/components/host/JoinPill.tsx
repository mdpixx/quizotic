'use client'

import QRCode from 'react-qr-code'

interface JoinPillProps {
  gameCode: string
  variant?: 'fixed' | 'inline'
}

// Small always-visible join pill — small QR + 6-digit code + join URL — so
// late-joining participants can jump in mid-session without the host having
// to switch screens. Fixed variant anchors top-right; inline variant flows
// with surrounding layout.
export function JoinPill({ gameCode, variant = 'fixed' }: JoinPillProps) {
  if (!gameCode) return null

  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://quizotic.live')
  const joinUrl = `${origin}/join?code=${gameCode}`

  const containerClass = variant === 'fixed'
    ? 'fixed top-4 right-4 z-40 hidden md:flex'
    : 'flex'

  return (
    <div
      className={`${containerClass} items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-md px-3 py-2`}
      aria-label="Join this session"
    >
      <div className="p-1 bg-white rounded-lg">
        <QRCode value={joinUrl} size={56} bgColor="#ffffff" fgColor="#0F1B3D" level="L" />
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
