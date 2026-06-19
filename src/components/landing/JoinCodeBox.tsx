'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'

// Participant entry point on the marketing site. Students arriving with a
// 6-digit session code shouldn't have to hunt for /join — same pattern as
// kahoot.it. Renders an inline code input that forwards to /join?code=XXXXXX.
export function JoinCodeBox({ variant }: { variant: 'nav' | 'hero' | 'menu' }) {
  const [code, setCode] = useState('')
  const ready = code.length === 6

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    track('landing_join_code_used', { variant })
    window.location.href = `/join?code=${code}`
  }

  const compact = variant === 'nav'

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center', width: variant === 'menu' ? '100%' : undefined }}>
      <input
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        placeholder={compact ? 'Join code' : 'Enter 6-digit code'}
        aria-label="Session join code"
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontWeight: 700,
          fontSize: compact ? 13 : 16,
          letterSpacing: '0.12em',
          color: '#fff',
          background: 'rgba(255,255,255,0.08)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          borderRadius: 10,
          padding: compact ? '7px 10px' : '11px 14px',
          width: compact ? 104 : undefined,
          flex: variant === 'menu' ? 1 : undefined,
          minWidth: 0,
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,209,59,0.7)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
      />
      <button
        type="submit"
        disabled={!ready}
        aria-label="Join session"
        style={{
          fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)',
          fontWeight: 700,
          fontSize: compact ? 13 : 15,
          color: '#0D0D0D',
          background: '#FBD13B',
          border: '2px solid #0D0D0D',
          borderRadius: 10,
          padding: compact ? '6px 14px' : '10px 20px',
          cursor: ready ? 'pointer' : 'default',
          opacity: ready ? 1 : 0.5,
          transition: 'opacity 0.15s',
          flexShrink: 0,
        }}
      >
        Join
      </button>
    </form>
  )
}
