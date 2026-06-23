'use client'

// RemotePairing — the phone-remote entry screen.
//
// Host enters the 6-digit game code (prefilled from ?code=) and the 4-digit
// PIN shown on the projector lobby. On submit we call the parent's onSubmit,
// which fires useHostSocket.join({ gameCode, pin }) → emits host_join_remote.
// The server replies with a full session_state on success or host_remote_error
// on failure; the parent surfaces `error` back here.

import { useState, type ReactNode } from 'react'

interface RemotePairingProps {
  gameCode: string
  pin: string
  connected: boolean
  error: string | null
  onSubmit: (gameCode: string, pin: string) => void
  logo: ReactNode
}

export function RemotePairing({
  gameCode: initialCode,
  pin: initialPin,
  connected,
  error,
  onSubmit,
  logo,
}: RemotePairingProps) {
  const [code, setCode] = useState(initialCode)
  const [pinValue, setPinValue] = useState(initialPin)

  const codeValid = /^\d{6}$/.test(code)
  const pinValid = /^\d{4}$/.test(pinValue)
  const canSubmit = codeValid && pinValid

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(code, pinValue)
  }

  return (
    <div
      className="min-h-svh flex flex-col px-5"
      style={{
        background: 'var(--color-paper)',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <header className="flex items-center justify-between pt-2">
        {logo}
        <span
          className="text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            color: connected ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}
        >
          {connected ? '● Online' : '○ Connecting'}
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="text-center mb-7">
          <h1
            className="font-display text-3xl font-black leading-tight"
            style={{ color: 'var(--color-primary)' }}
          >
            Host remote
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Drive your live session from your phone. Enter the code and the PIN shown on the projector.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="rm-code"
              className="block text-[11px] font-black uppercase tracking-[0.16em] mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Game code
            </label>
            <input
              id="rm-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-2xl px-5 py-4 text-3xl font-black tracking-[0.3em] text-center font-display outline-none"
              style={{
                background: 'var(--color-bg)',
                border: `2px solid ${codeValid ? 'var(--color-success)' : 'var(--color-line)'}`,
                color: 'var(--color-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="rm-pin"
              className="block text-[11px] font-black uppercase tracking-[0.16em] mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Host PIN (on the lobby)
            </label>
            <input
              id="rm-pin"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="0000"
              className="w-full rounded-2xl px-5 py-4 text-3xl font-black tracking-[0.4em] text-center font-display outline-none"
              style={{
                background: 'var(--color-bg)',
                border: `2px solid ${pinValid ? 'var(--color-yellow-dark)' : 'var(--color-line)'}`,
                color: 'var(--color-primary)',
              }}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-bold"
              style={{
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl py-4 text-lg font-black font-display transition-all disabled:opacity-40"
            style={{
              background: 'var(--color-yellow)',
              color: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
              boxShadow: '0 4px 0 var(--color-primary)',
            }}
          >
            Pair
          </button>
        </form>
      </div>
    </div>
  )
}
