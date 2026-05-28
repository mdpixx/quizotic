'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Phase = 'email' | 'code'

export default function SignInPage() {
  const [phase, setPhase] = useState<Phase>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the code box the moment we transition to the code phase —
  // saves a tap on mobile where the screen scrolls and users hunt for
  // where to type.
  useEffect(() => {
    if (phase === 'code') codeInputRef.current?.focus()
  }, [phase])

  // Countdown for the resend button. 30s is enough to discourage spam
  // without making the legitimate "didn't get it" path feel slow.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl: '/host' })
    } catch {
      setError('Could not connect to Google. Please try again.')
      setLoading(false)
    }
  }

  // POSTs the email to NextAuth's nodemailer route, which fires our
  // sendVerificationRequest → emails a 6-digit OTP. We never get the OTP
  // back; the user types it in.
  async function requestCode(targetEmail: string) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const csrfRes = await fetch('/api/auth/csrf', { signal: controller.signal })
      const { csrfToken } = await csrfRes.json()
      const res = await fetch('/api/auth/signin/nodemailer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: targetEmail, csrfToken, callbackUrl: '/host' }),
        redirect: 'manual',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok || res.type === 'opaqueredirect' || res.status === 302 || res.status === 200) {
        return { ok: true as const }
      }
      const text = await res.text().catch(() => '')
      if (text.includes('Configuration') || res.status === 500) {
        return { ok: false as const, error: 'Email sign-in is not available right now. Please sign in with Google.' }
      }
      return { ok: false as const, error: 'Could not send code. Please try signing in with Google.' }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false as const, error: 'Email sign-in timed out. Please try signing in with Google instead.' }
      }
      return { ok: false as const, error: 'Network error. Check your connection and try again.' }
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setInfo('')
    const result = await requestCode(email.trim())
    setLoading(false)
    if (result.ok) {
      setPhase('code')
      setResendCooldown(30)
    } else {
      setError(result.error)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError('')
    setInfo('')
    const result = await requestCode(email.trim())
    setResending(false)
    if (result.ok) {
      setInfo('A new code has been sent.')
      setResendCooldown(30)
      setCode('')
      codeInputRef.current?.focus()
    } else {
      setError(result.error)
    }
  }

  // Submit the code — GET NextAuth's email callback with the code as the
  // `token` parameter. NextAuth looks it up in `VerificationToken`,
  // validates the 15-minute expiry, sets the session cookie, and either
  // 302s to /host (success) or to /auth/error (wrong/expired). We let
  // fetch follow redirects so we can read the final `res.url` — that's
  // how we tell success from failure (with `redirect:'manual'` the
  // response is opaque and the Location header is unreadable).
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6) {
      setError('Please enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const params = new URLSearchParams({
        email: email.trim(),
        token: trimmed,
        callbackUrl: '/host',
      })
      const res = await fetch(`/api/auth/callback/nodemailer?${params.toString()}`, {
        method: 'GET',
      })
      const finalUrl = res.url || ''
      if (finalUrl.includes('/auth/error') || finalUrl.includes('error=')) {
        setError('That code is invalid or expired. Request a new code and try again.')
        setLoading(false)
        return
      }
      // Success — NextAuth set the session cookie before redirecting.
      // Hard-navigate so client-side state (NextAuth session, JWT) is
      // re-read fresh on the next route.
      window.location.href = '/host'
    } catch {
      setError('Network error. Check your connection and try again.')
      setLoading(false)
    }
  }

  // Code-entry view -------------------------------------------------------
  if (phase === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: '#0F1B3D' }}>
        <Link href="/" className="absolute left-5 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80" style={{ top: 'max(1.25rem, env(safe-area-inset-top, 0px))', color: '#94A3B8' }}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/></svg>
          Home
        </Link>
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#F5E642', border: '2px solid #0D0D0D' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M3 8l9 6 9-6" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="#0F1B3D" strokeWidth="2"/></svg>
            </div>
            <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
              Enter your sign-in code
            </h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              We emailed a 6-digit code to <strong style={{ color: '#F5E642' }}>{email}</strong>.
            </p>
          </div>

          <div className="rounded-2xl p-6" style={{ background: '#fff', border: '2px solid rgba(15,27,61,0.1)' }}>
            <form onSubmit={handleCodeSubmit}>
              <label htmlFor="signin-code" className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
                6-digit code
              </label>
              <input
                ref={codeInputRef}
                id="signin-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 text-center"
                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F1B3D', fontSize: 28, letterSpacing: '0.4em', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', fontWeight: 700, '--tw-ring-color': 'rgba(245,230,66,0.4)' } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full mt-3 px-4 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
              >
                {loading ? 'Verifying...' : 'Sign in'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-4 text-sm">
              <button
                type="button"
                onClick={() => { setPhase('email'); setCode(''); setError(''); setInfo('') }}
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#64748B' }}
              >
                ← Use a different email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#0F1B3D' }}
              >
                {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>

          {info && (
            <div className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
              style={{ background: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' }}>
              {info}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
              style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
              {error}
            </div>
          )}
          <p className="text-center text-xs mt-4" style={{ color: '#64748B' }}>
            The code expires in 15 minutes.
          </p>
        </div>
      </div>
    )
  }

  // Email-entry view ------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: '#0F1B3D' }}>
      <Link href="/" className="absolute left-5 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80" style={{ top: 'max(1.25rem, env(safe-area-inset-top, 0px))', color: '#94A3B8' }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/></svg>
        Home
      </Link>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Q</div>
            <span className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
              Quizo<span style={{ color: '#F5E642' }}>tic</span>
            </span>
          </div>
          <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
            Welcome to Quizotic
          </h1>
          <p className="text-base" style={{ color: '#94A3B8' }}>
            Sign in to create and host quizzes
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '2px solid rgba(15,27,61,0.1)' }}>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: '#fff', border: '1.5px solid #E2E8F0', color: '#0F1B3D' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
            <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
          </div>

          <form onSubmit={handleEmailSubmit}>
            <label htmlFor="signin-email" className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all focus:ring-2"
              style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#0F1B3D', '--tw-ring-color': 'rgba(245,230,66,0.4)' } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full mt-3 px-4 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              {loading ? 'Sending code...' : 'Email me a code'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
            style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}
        <p className="text-center text-xs mt-4" style={{ color: '#64748B' }}>
          No password needed. We&apos;ll email you a 6-digit code.
        </p>
      </div>
    </div>
  )
}
