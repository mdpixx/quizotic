'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const messages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'Access denied. You may not have permission to sign in.',
    Verification: 'The magic link has expired or has already been used.',
    Default: 'An unexpected error occurred during sign in.',
  }

  const message = messages[error ?? ''] ?? messages.Default

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#DC2626', border: '2px solid #0D0D0D' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M12 9v4M12 17h.01" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></svg>
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
          Sign in failed
        </h1>
        <p className="text-base mb-6" style={{ color: '#94A3B8' }}>
          {message}
        </p>
        <a
          href="/auth/signin"
          className="inline-block px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
          style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
        >
          Try again
        </a>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
}
