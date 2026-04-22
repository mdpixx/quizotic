'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface PresentationRecord {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export default function PresentationsPage() {
  const router = useRouter()
  const [presentations, setPresentations] = useState<PresentationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchPresentations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/presentations')
      if (res.ok) {
        const json = await res.json()
        setPresentations(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPresentations() }, [fetchPresentations])

  async function handlePresent(id: string) {
    setStartingId(id)
    setError('')
    try {
      const res = await fetch(`/api/presentations/${id}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      const pres = json.data
      // Store in localStorage for the presentation session page
      localStorage.setItem('quizotic_active_presentation', JSON.stringify(pres))
      router.push('/host/present/session')
    } catch {
      setError('Could not load presentation. Please try again.')
      setStartingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/presentations/${id}`, { method: 'DELETE' })
      setPresentations(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  const filtered = presentations.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Presentations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
            {presentations.length} presentation{presentations.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Link href="/host/present/create" className="btn-primary w-full sm:w-auto justify-center" style={{ textDecoration: 'none' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Create Presentation
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search presentations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md text-sm px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-yellow-200"
          style={{ borderColor: '#E2E8F0', background: '#fff', color: '#0F1B3D' }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">📽</div>
          <p className="text-lg font-black mb-2" style={{ color: '#0F1B3D' }}>
            {presentations.length === 0 ? 'No presentations yet' : 'No presentations match your search'}
          </p>
          <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
            {presentations.length === 0 ? 'Create your first presentation to get started' : 'Try a different search term'}
          </p>
          {presentations.length === 0 && (
            <Link href="/host/present/create" className="btn-primary" style={{ textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              Create your first presentation
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((pres, i) => (
              <motion.div
                key={pres.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border p-5 flex flex-col"
                style={{ background: '#fff', borderColor: '#E2E8F0' }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: '#FFF5F5' }}>
                    📽
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm leading-snug truncate" style={{ color: '#0F1B3D' }}>
                      {pres.title}
                    </h3>
                  </div>
                </div>

                <p className="text-[11px] mb-4 flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                  Last edited {relativeTime(pres.updatedAt)}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handlePresent(pres.id)}
                    disabled={startingId === pres.id}
                    className="btn-golive flex-1 justify-center"
                  >
                    {startingId === pres.id ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        Loading
                      </span>
                    ) : (
                      <>
                        <span className="play-dot"><svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2 h-2"><path d="M8 5v14l11-7z"/></svg></span>
                        Present
                      </>
                    )}
                  </button>
                  <Link href={`/host/present/create?id=${pres.id}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
                    Edit
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(pres.id)}
                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-red-50"
                    title="Delete"
                    style={{ color: '#EF4444', border: '1.5px solid #FECACA' }}
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full shadow-xl"
              style={{ background: '#fff' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-black mb-2" style={{ color: '#0F1B3D' }}>Delete Presentation?</h3>
              <p className="text-sm mb-5" style={{ color: '#64748B' }}>
                This will permanently delete &ldquo;{presentations.find(p => p.id === confirmDelete)?.title}&rdquo;.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                  style={{ color: '#64748B', borderColor: '#E2E8F0' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deletingId === confirmDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-60"
                  style={{ background: '#EF4444', color: '#fff' }}
                >
                  {deletingId ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
