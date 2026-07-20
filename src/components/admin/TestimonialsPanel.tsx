'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'new' | 'shortlisted' | 'published' | 'declined'
type Filter = 'open' | Status | 'all'

interface TestimonialItem {
  id: string
  emailSnapshot: string
  name: string
  designation: string
  organization: string | null
  quote: string
  displayQuote: string | null
  photoUrl: string | null
  publicationConsent: boolean
  editingAllowed: boolean
  materialChange: boolean
  consentVersion: string
  consentGrantedAt: string
  reconfirmedAt: string | null
  reconfirmedQuote: string | null
  status: Status
  publishedAt: string | null
  createdAt: string
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'new', label: 'New' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'published', label: 'Published' },
  { key: 'declined', label: 'Declined' },
  { key: 'all', label: 'All' },
]

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ReviewCard({ item, onChanged }: { item: TestimonialItem; onChanged: () => void }) {
  const [displayQuote, setDisplayQuote] = useState(item.displayQuote ?? item.quote)
  const [materialChange, setMaterialChange] = useState(item.materialChange)
  const [reconfirmed, setReconfirmed] = useState(item.reconfirmedQuote?.trim() === (item.displayQuote ?? item.quote).trim())
  const [reconfirmationDirty, setReconfirmationDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const edited = displayQuote.trim() !== item.quote.trim()
  const needsReconfirmation = edited && (!item.editingAllowed || materialChange)

  async function update(status: Status) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status,
          displayQuote,
          materialChange,
          ...(reconfirmationDirty ? { reconfirmed } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Update failed')
      onChanged()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${item.name}'s testimonial and photograph permanently?`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/testimonials?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Deletion failed')
      onChanged()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Deletion failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 gap-4">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-gray-200 object-cover dark:border-gray-600" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-black text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {item.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-gray-900 dark:text-white">{item.name}</h4>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{item.status}</span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{[item.designation, item.organization].filter(Boolean).join(' · ')}</p>
            <a href={`mailto:${item.emailSnapshot}`} className="mt-1 block truncate text-xs text-indigo-600 hover:underline dark:text-indigo-400">{item.emailSnapshot}</a>
            <p className="mt-3 text-xs leading-5 text-gray-400">
              Consent {formatDate(item.consentGrantedAt)} · version {item.consentVersion} · {item.editingAllowed ? 'light edits allowed' : 'publish as written'}
              {item.reconfirmedAt ? ` · reconfirmed ${formatDate(item.reconfirmedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-[1.4]">
          <div className="mb-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Original submission</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">{item.quote}</p>
          </div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Website copy
            <textarea disabled={item.status === 'published'} value={displayQuote} onChange={event => {
              setDisplayQuote(event.target.value)
              if (event.target.value.trim() !== item.reconfirmedQuote?.trim()) {
                setReconfirmed(false)
                setReconfirmationDirty(false)
              }
            }} minLength={40} maxLength={800} rows={5} className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white p-3 text-sm leading-6 text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          {edited && <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">Edited from the contributor&apos;s original submission.</p>}
          {edited && item.status !== 'published' && (
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={materialChange} onChange={event => {
                setMaterialChange(event.target.checked)
                if (event.target.checked) {
                  setReconfirmed(false)
                  setReconfirmationDirty(false)
                }
              }} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              This edit changes the contributor&apos;s meaning or makes claims beyond light grammar or length changes
            </label>
          )}
          {needsReconfirmation && item.status !== 'published' && (
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={reconfirmed} onChange={event => {
                setReconfirmed(event.target.checked)
                setReconfirmationDirty(true)
              }} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              Contributor reconfirmed this edited version
            </label>
          )}
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
        {item.status !== 'published' && <button type="button" disabled={busy} onClick={() => update(item.status)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Save copy</button>}
        {item.status !== 'shortlisted' && item.status !== 'published' && <button type="button" disabled={busy} onClick={() => update('shortlisted')} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200 disabled:opacity-50">Shortlist</button>}
        {item.status !== 'published' ? (
          <button type="button" disabled={busy || (needsReconfirmation && !reconfirmed)} onClick={() => update('published')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Publish</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => update('shortlisted')} className="rounded-lg bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-200 disabled:opacity-50">Unpublish</button>
        )}
        {item.status !== 'declined' && <button type="button" disabled={busy} onClick={() => update('declined')} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200">Decline</button>}
        <button type="button" disabled={busy} onClick={remove} className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20">Delete permanently</button>
      </div>
    </article>
  )
}

export function TestimonialsPanel() {
  const [filter, setFilter] = useState<Filter>('open')
  const [items, setItems] = useState<TestimonialItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const suffix = filter === 'open' ? '' : `?status=${filter}`
      const response = await fetch(`/api/admin/testimonials${suffix}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not load testimonials')
      if (version !== requestVersion.current) return
      setItems(body.items ?? [])
      setCounts(body.counts ?? {})
    } catch (loadError) {
      if (version !== requestVersion.current) return
      setError(loadError instanceof Error ? loadError.message : 'Could not load testimonials')
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm dark:border-gray-700/70 dark:bg-gray-800/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Testimonials</h3>
            <p className="text-xs text-gray-400">Review consent, refine display copy, and control the homepage.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(option => (
              <button key={option.key} type="button" onClick={() => setFilter(option.key)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === option.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>
                {option.label}{option.key !== 'open' && option.key !== 'all' ? ` (${counts[option.key] ?? 0})` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
        : loading ? <p className="p-6 text-center text-sm text-gray-400">Loading testimonials…</p>
        : items.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 dark:border-gray-700">No testimonials in this view.</p>
        : items.map(item => <ReviewCard key={item.id} item={item} onChanged={load} />)}
    </section>
  )
}
