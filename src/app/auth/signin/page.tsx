'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

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

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const csrfRes = await fetch('/api/auth/csrf', { signal: controller.signal })
      const { csrfToken } = await csrfRes.json()
      const res = await fetch('/api/auth/signin/nodemailer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, csrfToken, callbackUrl: '/host' }),
        redirect: 'manual',
        signal: controller.signal,
      })
      clearTimeout(timeout)

      // redirect:'manual' turns 302 into type:'opaqueredirect' with status 0
      if (res.ok || res.type === 'opaqueredirect' || res.status === 302 || res.status === 200) {
        setEmailSent(true)
      } else {
        const text = await res.text().catch(() => '')
        if (text.includes('Configuration') || res.status === 500) {
          setError('Email sign-in is not available right now. Please sign in with Google.')
        } else {
          setError('Could not send magic link. Please try signing in with Google.')
        }
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Email sign-in timed out. Please try signing in with Google instead.')
      } else {
        setError('Network error. Check your connection and try again.')
      }
    }
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: '#0F1B3D' }}>
        <Link href="/" className="absolute top-5 left-5 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: '#94A3B8' }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/></svg>
        Home
      </Link>
      <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#F5E642', border: '2px solid #0D0D0D' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M3 8l9 6 9-6" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="#0F1B3D" strokeWidth="2"/></svg>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
            Check your email
          </h1>
          <p className="text-base mb-6" style={{ color: '#94A3B8' }}>
            We sent a magic link to <strong style={{ color: '#F5E642' }}>{email}</strong>. Click it to sign in.
          </p>
          <button
            onClick={() => { setEmailSent(false); setEmail('') }}
            className="text-sm font-semibold"
            style={{ color: '#F5E642' }}
          >
            Try a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: '#0F1B3D' }}>
      <Link href="/" className="absolute top-5 left-5 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: '#94A3B8' }}>
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

          <form onSubmit={handleEmailSignIn}>
            <label htmlFor="signin-email" className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
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
              {loading ? 'Sending...' : 'Send Magic Link'}
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
          No password needed. We&apos;ll email you a secure link.
        </p>
      </div>
    </div>
  )
}
