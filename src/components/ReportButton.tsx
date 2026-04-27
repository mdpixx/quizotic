'use client'

import { useState } from 'react'

// Lightweight "Report" button — opens a small modal with category picker
// and a free-text details box. Posts to /api/moderation/report. Designed
// to be drop-in on any page that shows user-generated content (quiz cards,
// session pages, attendee answers).

interface ReportButtonProps {
  targetType: 'quiz' | 'session' | 'answer' | 'user'
  targetId: string
  className?: string
  label?: string
}

const CATEGORIES: Array<{ value: 'spam' | 'hate' | 'sexual' | 'copyright' | 'other'; label: string }> = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'hate', label: 'Hate speech or harassment' },
  { value: 'sexual', label: 'Sexual or inappropriate content' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'other', label: 'Something else' },
]

export function ReportButton({ targetType, targetId, className, label = 'Report' }: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<typeof CATEGORIES[number]['value']>('spam')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, category, details: details.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not submit report')
        return
      }
      setDone(true)
      setTimeout(() => { setOpen(false); setDone(false); setDetails('') }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'text-xs text-gray-500 hover:text-red-600 hover:underline transition-colors'}
        title="Report this content"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Report this content</h3>
              <p className="text-xs text-gray-500 mt-0.5">Reports go to the Quizotic moderation team.</p>
            </div>

            {done ? (
              <div className="rounded-lg p-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm">
                Thanks. We&apos;ve received your report.
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Reason</label>
                  <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Details (optional)</label>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    maxLength={2000}
                    placeholder="Anything that helps us understand the issue"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {error && (
                  <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">
                    {submitting ? 'Sending…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
