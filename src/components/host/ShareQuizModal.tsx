'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { track } from '@/lib/analytics'

// "Share a copy" — gives colleagues a link that clones this quiz into their
// own library. Unlike AssignQuizModal (participants take the quiz), a share
// link mints nothing until the recipient signs in and imports, so creating
// the link on open is safe and keeps the UX one-step.

interface ShareQuizModalProps {
  quizId: string
  quizTitle: string
  onClose: () => void
}

interface ShareLinkData {
  token: string
  importCount: number
}

export function ShareQuizModal({ quizId, quizTitle, onClose }: ShareQuizModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<ShareLinkData | null>(null)
  const [revoked, setRevoked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function createLink() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/quizzes/${quizId}/share-link`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not create the share link.')
        setLink(null)
      } else {
        setLink({ token: json.data.token, importCount: json.data.importCount ?? 0 })
        setRevoked(false)
        // created=false means an existing active link was reused — not a new share.
        if (json.data.created) track('quiz_share_link_created', { quizId })
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    createLink()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId])

  const shareUrl = link ? `${window.location.origin}/import/${link.token}` : ''

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/quizzes/${quizId}/share-link`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not turn off the link.')
      } else {
        setRevoked(true)
        setLink(null)
        track('quiz_share_link_revoked', { quizId })
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="rounded-2xl p-6 max-w-md w-full shadow-xl"
        style={{ background: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>Share a copy</h3>
            <p className="text-xs mt-0.5 truncate max-w-[18rem]" style={{ color: '#64748B' }}>{quizTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
            aria-label="Close"
            style={{ color: '#94A3B8' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <p className="text-xs mb-4 px-3 py-2.5 rounded-xl" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
          Anyone with this link can sign in and save a copy of this quiz to their
          own library. Their copy is independent — your later edits won&apos;t sync.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-xs font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
            <span className="ml-3 text-sm" style={{ color: '#64748B' }}>Creating link…</span>
          </div>
        ) : revoked ? (
          <div className="text-center py-4">
            <p className="text-sm font-bold mb-1" style={{ color: '#0F1B3D' }}>Link turned off</p>
            <p className="text-xs mb-4" style={{ color: '#64748B' }}>
              The old link no longer works. Copies already made are unaffected.
            </p>
            <button
              onClick={() => createLink()}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              style={{ background: '#0F1B3D', color: '#fff' }}
            >
              Create new link
            </button>
          </div>
        ) : link ? (
          <>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span className="flex-1 text-sm truncate" style={{ color: '#0F1B3D', fontFamily: 'monospace' }}>{shareUrl}</span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-colors"
                style={{ background: copied ? '#16A34A' : '#0F1B3D', color: '#fff' }}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#64748B' }}>
                Imported {link.importCount} time{link.importCount === 1 ? '' : 's'}
              </span>
              <button
                onClick={handleRevoke}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 hover:bg-red-50"
                style={{ color: '#DC2626', border: '1px solid #FECACA' }}
              >
                {busy ? 'Turning off…' : 'Turn off link'}
              </button>
            </div>
          </>
        ) : null}
      </motion.div>
    </motion.div>
  )
}
