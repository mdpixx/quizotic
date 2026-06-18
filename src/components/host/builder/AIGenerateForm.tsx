'use client'

/**
 * AIGenerateForm — shared AI quiz-generation form.
 *
 * Used by:
 *   - AIGeneratePanel (the in-builder slide-over modal, accessed via "Generate with AI" in QuestionList)
 *   - BuilderLauncher (the start-screen right panel for aitopic/aiurl/aidoc modes)
 *
 * Manages its own input + loading state. Calls POST /api/generate-quiz on submit
 * and passes the raw question array to onGenerated.
 */

import { useState } from 'react'
import type { Question } from '@/lib/quiz-types'
import { QUIZ_LANGUAGES } from '@/lib/languages'
import { SparkleIcon } from './SparkleIcon'

export type AIGenerateMode = 'aitopic' | 'aiurl' | 'aidoc'

interface AIGenerateFormProps {
  initialMode?: AIGenerateMode
  plan: 'free' | 'pro'
  onGenerated: (raw: Partial<Question>[]) => void
}

const TABS: { id: AIGenerateMode; label: string }[] = [
  { id: 'aitopic', label: 'Topic' },
  { id: 'aiurl', label: 'URL' },
  { id: 'aidoc', label: 'PDF / DOCX' },
]

export function AIGenerateForm({ initialMode = 'aitopic', plan, onGenerated }: AIGenerateFormProps) {
  const [mode, setMode] = useState<AIGenerateMode>(initialMode)
  const [topic, setTopic] = useState('')
  const [url, setUrl] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [language, setLanguage] = useState('English')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canGenerate =
    !loading &&
    (mode === 'aitopic' ? topic.trim().length > 0
      : mode === 'aiurl' ? url.trim().length > 0
      : docFile !== null)

  async function handleGenerate() {
    setError('')
    setLoading(true)
    try {
      let body: FormData | string
      const headers: Record<string, string> = {}

      if (mode === 'aidoc' && docFile) {
        const fd = new FormData()
        fd.append('file', docFile)
        fd.append('questionCount', String(count))
        fd.append('difficulty', difficulty)
        fd.append('language', language)
        fd.append('mode', 'doc')
        body = fd
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({
          mode: mode === 'aitopic' ? 'topic' : 'url',
          topic: mode === 'aitopic' ? topic : undefined,
          url: mode === 'aiurl' ? url : undefined,
          questionCount: count,
          difficulty,
          language,
        })
      }

      const res = await fetch('/api/generate-quiz', { method: 'POST', headers, body })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Generation failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (!Array.isArray(data)) {
        setError('Unexpected response from server. Please try again.')
        return
      }
      onGenerated(data as Partial<Question>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Source tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F3F4F6' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={
              mode === t.id
                ? { background: '#fff', color: '#0F1B3D', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: '#6B7280' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Source input */}
      {mode === 'aitopic' && (
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canGenerate) handleGenerate() }}
          placeholder="e.g. Indian History, Machine Learning, GST..."
          className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          style={{ borderColor: '#E5E7EB' }}
        />
      )}
      {mode === 'aiurl' && (
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          style={{ borderColor: '#E5E7EB' }}
        />
      )}
      {mode === 'aidoc' && (
        <label
          className="flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-purple-300 transition-colors"
          style={{ borderColor: '#D8B4FE' }}
        >
          <span className="text-2xl">&#128196;</span>
          <span className="text-sm font-medium text-gray-600">
            {docFile ? docFile.name : 'Click to choose PDF or DOCX'}
          </span>
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={e => setDocFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {/* Count + Difficulty */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Questions</label>
          <select
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
            style={{ borderColor: '#E5E7EB' }}
          >
            {(plan === 'pro' ? [5, 10, 15, 20, 25] : [5, 8, 10]).map(n => (
              <option key={n} value={n}>{n} questions</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Difficulty</label>
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
            style={{ borderColor: '#E5E7EB' }}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Language</label>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          style={{ borderColor: '#E5E7EB' }}
        >
          {QUIZ_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {error && (
        <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: '#7C3AED', color: '#fff' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Generating&hellip;
          </>
        ) : (
          <>
            <SparkleIcon className="w-4 h-4" />
            Generate {count} questions
          </>
        )}
      </button>
    </div>
  )
}
