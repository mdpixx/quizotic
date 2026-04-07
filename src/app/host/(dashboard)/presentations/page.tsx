'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

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
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Presentations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
            {presentations.length} presentation{presentations.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Link
          href="/host/present/create"
          className="w-full sm:w-auto text-center text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] text-white"
          style={{ background: 'var(--brand-gradient)' }}
        >
          + Create Presentation
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
          className="w-full max-w-md text-sm px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-200"
          style={{ borderColor: '#E2E8F0', background: '#fff', color: '#1B2559' }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#4361EE', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">📽</div>
          <p className="text-lg font-black mb-2" style={{ color: '#1B2559' }}>
            {presentations.length === 0 ? 'No presentations yet' : 'No presentations match your search'}
          </p>
          <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
            {presentations.length === 0 ? 'Create your first presentation to get started' : 'Try a different search term'}
          </p>
          {presentations.length === 0 && (
            <Link
              href="/host/present/create"
              className="text-sm font-bold px-6 py-3 rounded-xl"
              style={{ background: 'var(--brand-gradient)', color: '#fff' }}
            >
              + Create Your First Presentation
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
                    <h3 className="font-black text-sm leading-snug truncate" style={{ color: '#1B2559' }}>
                      {pres.title}
                    </h3>
                  </div>
                </div>

                <p className="text-[11px] mb-4" style={{ color: '#CBD5E1' }}>
                  Updated {new Date(pres.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handlePresent(pres.id)}
                    disabled={startingId === pres.id}
                    className="flex-1 text-xs font-bold py-2 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: 'var(--brand-gradient)', color: '#fff' }}
                  >
                    {startingId === pres.id ? '⏳ Loading…' : '▶ Present'}
                  </button>
                  <Link
                    href={`/host/present/create?id=${pres.id}`}
                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-blue-50"
                    style={{ color: '#4361EE', border: '1.5px solid #C7D7FD' }}
                  >
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
              <h3 className="text-lg font-black mb-2" style={{ color: '#1B2559' }}>Delete Presentation?</h3>
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
