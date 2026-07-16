'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/analytics'

interface ImportQuizButtonProps {
  token: string
}

type ErrorState = { code: string; message: string } | null

export default function ImportQuizButton({ token }: ImportQuizButtonProps) {
  const router = useRouter()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<ErrorState>(null)

  async function handleImport() {
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(`/api/import/${token}`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        track('quiz_imported')
        router.push('/host/quizzes')
        return
      }
      setError({
        code: typeof json.code === 'string' ? json.code : 'UNKNOWN',
        message: json.error ?? 'Could not import the quiz. Please try again.',
      })
      setImporting(false)
    } catch {
      setError({ code: 'NETWORK', message: 'Network error. Please check your connection and try again.' })
      setImporting(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleImport}
        disabled={importing}
        className="w-full py-3.5 rounded-xl font-black text-base transition-opacity disabled:opacity-60"
        style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
      >
        {importing ? 'Adding to your library…' : 'Add to my library'}
      </button>

      {error && (
        <div
          className="mt-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#FCA5A5' }}
        >
          <p>{error.message}</p>
          {error.code === 'LIBRARY_FULL' && (
            <p className="mt-2">
              <a href="/pricing" className="underline font-bold" style={{ color: '#FBD13B' }}>See plans</a>
              <span style={{ color: '#94A3B8' }}> · </span>
              <a href="/host/quizzes" className="underline" style={{ color: '#FCA5A5' }}>Manage my quizzes</a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
