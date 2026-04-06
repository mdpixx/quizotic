'use client'

import { signIn } from 'next-auth/react'
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
    try {
      const result = await signIn('resend', { email, callbackUrl: '/host', redirect: false })
      if (result?.error) {
        setError('Could not send the magic link. Please check your email and try again.')
        setLoading(false)
        return
      }
      setEmailSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFBF5' }}>
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Check your email
          </h1>
          <p className="text-base mb-6" style={{ color: '#4A5568' }}>
            We sent a magic link to <strong>{email}</strong>. Click it to sign in.
          </p>
          <button
            onClick={() => { setEmailSent(false); setEmail('') }}
            className="text-sm font-semibold"
            style={{ color: '#4361EE' }}
          >
            Try a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFBF5' }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Welcome to Quizotic
          </h1>
          <p className="text-base" style={{ color: '#4A5568' }}>
            Sign in to create and host quizzes
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: '#fff', border: '1.5px solid #E2E8F0', color: '#1B2559' }}
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
            <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
          </div>

          <form onSubmit={handleEmailSignIn}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-blue-200"
              style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#1B2559' }}
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full mt-3 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)' }}
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
        <p className="text-center text-xs mt-4" style={{ color: '#9CA3AF' }}>
          No password needed. We&apos;ll email you a secure link.
        </p>
      </div>
    </div>
  )
}
