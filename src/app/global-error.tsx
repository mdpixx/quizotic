'use client'

// Last-resort boundary for errors thrown in the ROOT layout itself, which the
// per-segment error.tsx files cannot catch. It must render its own <html> and
// <body>. Kept dependency-free and inline-styled so it works even if app CSS
// or chunks failed to load (the very situation that triggers it).

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[global-error]', error)
    }
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0D0D0D',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>😵‍💫</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Quizotic hit an unexpected error</h1>
        <p style={{ maxWidth: '24rem', fontSize: '0.875rem', color: '#9CA3AF', margin: 0 }}>
          Reloading the page should get you back. If it keeps happening, try again in a minute.
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0 }}>Reference: {error.digest}</p>
        ) : null}
        <button
          onClick={() => {
            try {
              reset()
            } catch {
              window.location.reload()
            }
          }}
          style={{
            border: 'none',
            borderRadius: '0.75rem',
            background: '#6366F1',
            color: '#fff',
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  )
}
