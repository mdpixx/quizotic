'use client'

// Route error boundary for the whole /host app segment (dashboard, builder,
// live session). Before this existed, a render error — the Server Components
// error we saw on /host, a #418 hydration mismatch, or a ChunkLoadError after
// a deploy — white-screened the page with no way back. Now the host sees a
// recoverable card instead. A hard reload re-fetches fresh chunks, which also
// clears stale-deploy ChunkLoadErrors.

import { useEffect } from 'react'
import Link from 'next/link'

export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surfaced in dev; in prod the existing PostHog/Sentry autocapture already
    // reports it. The digest links this card to the server-side stack trace.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[host/error]', error)
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: '#F8F9FA' }}>
      <div className="text-4xl">😵‍💫</div>
      <div>
        <h1 className="text-xl font-black text-gray-900">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          This page hit an unexpected error. Reloading usually fixes it — your saved quizzes are safe.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            // Try React's in-place recovery first; fall back to a hard reload
            // (needed for ChunkLoadError after a deploy).
            try {
              reset()
            } catch {
              window.location.reload()
            }
          }}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
        >
          Try again
        </button>
        <Link
          href="/host"
          className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
