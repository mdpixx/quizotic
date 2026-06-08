'use client'

/**
 * QuizBuilder — the new Slido-style quiz builder component.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ← back   [title input]   [Save] [Start live]   [⚙] │  ← top bar
 *   ├──────────┬───────────────────────────────────────────┤
 *   │ Question │                                           │
 *   │ list     │   QuestionCanvas (full-width, no right    │
 *   │ (narrow) │   panel — type/timer/points inline)       │
 *   │          │                                           │
 *   │ [+ Add]  │                                           │
 *   └──────────┴───────────────────────────────────────────┘
 *
 * Used by /host/build — the flagged parallel route.
 * The legacy /host/create builder is untouched until flip.
 */

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuizBuilder } from '@/hooks/use-quiz-builder'
import { isKnownQuestionType } from '@/lib/quiz-builder-logic'
import { resolveHostBackNavigation } from '@/lib/host-navigation'
import { QuestionList } from './QuestionList'
import { QuestionCanvas } from './QuestionCanvas'

// ── AutosaveBadge ─────────────────────────────────────────────────────────────

function AutosaveBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: '#FEF3C7', color: '#92400E' }}>
        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Saving…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: '#FEE2E2', color: '#991B1B' }}>
        Couldn&apos;t save — retrying
      </span>
    )
  }
  return (
    <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: '#DCFCE7', color: '#14532D' }}>
      &#10003; Saved
    </span>
  )
}

// ── AI generation panel (bulk: topic/doc/URL) ─────────────────────────────────
// Simplified — no +/- type steppers. AI auto-picks the mix.

function AIGeneratePanel({
  onClose,
  onGenerated,
  plan,
}: {
  onClose: () => void
  onGenerated: (raw: object[]) => void
  plan: 'free' | 'pro'
}) {
  const [mode, setMode] = useState<'aitopic' | 'aiurl' | 'aidoc'>('aitopic')
  const [topic, setTopic] = useState('')
  const [url, setUrl] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [language, setLanguage] = useState('English')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setError('')
    setLoading(true)
    try {
      let body: FormData | string
      let headers: Record<string, string> = {}
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
          mode,
          topic: mode === 'aitopic' ? topic : undefined,
          url: mode === 'aiurl' ? url : undefined,
          questionCount: count,
          difficulty,
          language,
        })
      }
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers,
        body,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Generation failed (${res.status})`)
        return
      }
      const questions = await res.json()
      onGenerated(questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: 'aitopic' | 'aiurl' | 'aidoc'; label: string }[] = [
    { id: 'aitopic', label: 'Topic' },
    { id: 'aiurl', label: 'URL' },
    { id: 'aidoc', label: 'PDF/DOCX' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl shadow-2xl border bg-white overflow-y-auto"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 95vw)', maxHeight: '85vh', borderColor: '#E5E7EB' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b" style={{ borderColor: '#F3F4F6' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>AI Generation</p>
            <h2 className="text-lg font-black mt-0.5" style={{ color: '#0F1B3D' }}>Generate questions</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Source tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F3F4F6' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={mode === t.id ? { background: '#fff', color: '#0F1B3D', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { color: '#6B7280' }}
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
            <label className="flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-purple-300 transition-colors" style={{ borderColor: '#D8B4FE' }}>
              <span className="text-2xl">&#128196;</span>
              <span className="text-sm font-medium text-gray-600">{docFile ? docFile.name : 'Click to choose PDF or DOCX'}</span>
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
            </label>
          )}

          {/* Count + Difficulty */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Number of questions</label>
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
              {['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'French', 'Spanish', 'Arabic', 'German'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</p>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || (mode === 'aitopic' && !topic.trim()) || (mode === 'aiurl' && !url.trim()) || (mode === 'aidoc' && !docFile)}
            className="w-full py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#7C3AED', color: '#fff' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                  <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                  <path d="M8 1l1.5 4H14l-3.5 2.5L12 12 8 9.5 4 12l1.5-4.5L2 5h4.5z"/>
                </svg>
                Generate {count} questions
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ── QuizBuilder ───────────────────────────────────────────────────────────────

export interface QuizBuilderProps {
  editId?: string | null
}

export function QuizBuilder({ editId }: QuizBuilderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = isKnownQuestionType(searchParams.get('type')) ? (searchParams.get('type') as never) : null

  const builder = useQuizBuilder({ editId, initialType })
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [titleError, setTitleError] = useState(false)

  // Navigate to live session when "Start live" succeeds
  useEffect(() => {
    if (builder.savedQuiz && typeof window !== 'undefined') {
      // Only navigate if triggered by start-live (handled inside handleStartLive)
    }
  }, [builder.savedQuiz])

  function handleBack() {
    const nav = resolveHostBackNavigation({
      returnTo: searchParams.get('returnTo'),
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      fallback: editId ? '/host/quizzes' : '/host/studio',
    })
    if (nav.kind === 'back') router.back()
    else router.push(nav.href)
  }

  async function handleSaveClick() {
    if (!builder.title.trim()) {
      setTitleError(true)
      setTimeout(() => setTitleError(false), 2000)
      return
    }
    await builder.handleSave()
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#F8F9FA' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b bg-white"
        style={{ borderColor: '#E5E7EB', height: 56 }}
      >
        {/* Circular back button — Slido-style, no logo */}
        <button
          type="button"
          onClick={handleBack}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-gray-100"
          style={{ border: '1.5px solid #E5E7EB', color: '#374151' }}
          title="Back"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
            <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Title input */}
        <input
          type="text"
          value={builder.title}
          onChange={e => builder.setTitle(e.target.value)}
          placeholder="Quiz title"
          className="flex-1 min-w-0 bg-transparent text-sm font-bold outline-none border-b-2 transition-colors focus:border-indigo-400 py-1"
          style={{ color: '#0F1B3D', borderBottomColor: titleError ? '#DC2626' : 'transparent', maxWidth: 320 }}
        />

        <div className="flex-1" />

        {/* Autosave badge */}
        <AutosaveBadge status={builder.autosaveStatus} />

        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={builder.undo}
            disabled={!builder.canUndo}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M4 7h9a4 4 0 010 8H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            type="button"
            onClick={builder.redo}
            disabled={!builder.canRedo}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M16 7H7a4 4 0 000 8h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M13 4l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={builder.saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50 hover:brightness-95"
          style={{ background: '#0F1B3D', color: '#F5E642' }}
        >
          {builder.saving ? 'Saving…' : 'Save'}
        </button>

        {/* Start live button */}
        <button
          type="button"
          onClick={builder.handleStartLive}
          disabled={builder.saving}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all hover:brightness-95"
          style={{ background: '#16A34A', color: '#fff' }}
        >
          &#9654; Start live
        </button>
      </div>

      {/* ── Save error banner ──────────────────────────────────────────── */}
      {builder.saveError && (
        <div className="flex-shrink-0 px-4 py-2 text-xs font-medium text-center" style={{ background: '#FEE2E2', color: '#991B1B' }}>
          {builder.saveError}
        </div>
      )}

      {/* ── 2-column body ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Question list — narrow, no heavy top/bottom blocks */}
        <div
          className="hidden md:flex flex-col flex-shrink-0"
          style={{ width: 224, background: '#fff' }}
        >
          <QuestionList
            questions={builder.questions}
            activeIndex={builder.activeIndex}
            onSelect={builder.setActiveIndex}
            onAdd={builder.addQuestion}
            onDuplicate={builder.duplicateQuestion}
            onDelete={builder.removeQuestion}
            onReorder={builder.reorderQuestions}
            onGenerateAI={() => setAiPanelOpen(true)}
          />
        </div>

        {/* Center: QuestionCanvas — takes all remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          {builder.activeQuestion ? (
            <QuestionCanvas
              question={builder.activeQuestion}
              index={builder.activeIndex}
              total={builder.questions.length}
              plan={builder.plan}
              onChange={partial => builder.updateQuestion(builder.activeIndex, partial)}
              onTypeChange={type => builder.changeQuestionType(builder.activeIndex, type)}
              onDuplicate={() => builder.duplicateQuestion(builder.activeIndex)}
              onDelete={() => builder.removeQuestion(builder.activeIndex)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-gray-400 text-sm">No questions yet</p>
              <button
                type="button"
                onClick={() => builder.addQuestion('mcq')}
                className="px-5 py-2.5 rounded-xl text-sm font-black"
                style={{ background: '#0F1B3D', color: '#F5E642' }}
              >
                + Add your first question
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Generate panel */}
      {aiPanelOpen && (
        <AIGeneratePanel
          plan={builder.plan}
          onClose={() => setAiPanelOpen(false)}
          onGenerated={raw => {
            builder.applyGeneratedQuestions(raw as Partial<import('@/lib/quiz-types').Question>[])
            setAiPanelOpen(false)
          }}
        />
      )}
    </div>
  )
}
