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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFBF5' }}>
      <div className="max-w-sm w-full text-center">
        <div className="text-4xl mb-4">:(</div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
          Sign in failed
        </h1>
        <p className="text-base mb-6" style={{ color: '#4A5568' }}>
          {message}
        </p>
        <a
          href="/auth/signin"
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)' }}
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
