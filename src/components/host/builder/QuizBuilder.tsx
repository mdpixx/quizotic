'use client'

/**
 * QuizBuilder — the new Slido-style quiz builder component.
 *
 * Layout (always — canvas-first):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ← back   [title input]   [Generate/Import] [Save] [Start live]  │  ← top bar
 *   ├──────────┬───────────────────────────────────────────┤
 *   │ Question │                                           │
 *   │ list     │   QuestionCanvas (full-width, no right    │
 *   │ (narrow) │   panel — type/timer/points inline)       │
 *   │          │                                           │
 *   │ [+ Add]  │                                           │
 *   └──────────┴───────────────────────────────────────────┘
 *
 * The 6-source launcher (Topic/PDF/URL/CSV/Templates/Blank) is now an
 * on-demand modal opened by the "Generate / Import" toolbar button, or
 * automatically when ?start=aitopic/aidoc/aiurl/csv/templates is present.
 * A plain /host/build (or ?start=manual) always lands on the blank canvas.
 *
 * Used by /host/build — the flagged parallel route.
 * The legacy /host/create builder is untouched until flip.
 */

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuizBuilder } from '@/hooks/use-quiz-builder'
import { isKnownQuestionType } from '@/lib/quiz-builder-logic'
import { resolveHostBackNavigation } from '@/lib/host-navigation'
import { QuestionList } from './QuestionList'
import { QuestionCanvas } from './QuestionCanvas'
import { BuilderLauncher, type LauncherMode } from './BuilderLauncher'
import { AIGenerateForm } from './AIGenerateForm'
import { SparkleIcon } from './SparkleIcon'
import type { Question } from '@/lib/quiz-types'

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
        Saving&hellip;
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: '#FEE2E2', color: '#991B1B' }}>
        Couldn&apos;t save &mdash; retrying
      </span>
    )
  }
  return (
    <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: '#DCFCE7', color: '#14532D' }}>
      &#10003; Saved
    </span>
  )
}

// ── AIGeneratePanel ───────────────────────────────────────────────────────────
// Modal wrapper around AIGenerateForm. Triggered by "Generate with AI" in
// the QuestionList once the builder is open.

function AIGeneratePanel({
  onClose,
  onGenerated,
  plan,
}: {
  onClose: () => void
  onGenerated: (raw: Partial<Question>[]) => void
  plan: 'free' | 'pro'
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl shadow-2xl border bg-white overflow-y-auto"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 95vw)', maxHeight: '85vh', borderColor: '#E5E7EB' }}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b" style={{ borderColor: '#F3F4F6' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>AI Generation</p>
            <h2 className="text-lg font-black mt-0.5" style={{ color: '#0F1B3D' }}>Generate questions</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="px-5 py-4">
          <AIGenerateForm plan={plan} onGenerated={onGenerated} />
        </div>
      </div>
    </>
  )
}

// ── SourceModal ───────────────────────────────────────────────────────────────
// Full-screen modal wrapper around BuilderLauncher. Opened by the
// "Generate / Import" toolbar button, or automatically via ?start= param.

function SourceModal({
  plan,
  initialMode,
  onApply,
  onClose,
}: {
  plan: 'free' | 'pro'
  initialMode: LauncherMode
  onApply: (questions: Partial<Question>[], meta?: { title?: string; subject?: string }) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl shadow-2xl border bg-white overflow-hidden flex flex-col"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(960px, 95vw)',
          height: 'min(86vh, 680px)',
          borderColor: '#E5E7EB',
        }}
      >
        {/* Modal header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>Generate or import</p>
            <h2 className="text-base font-black mt-0.5" style={{ color: '#0F1B3D' }}>Start from a source</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {/* Launcher body fills remaining height */}
        <div className="flex-1 flex overflow-hidden">
          <BuilderLauncher
            plan={plan}
            initialMode={initialMode}
            onApply={onApply}
            onBlank={onClose}
          />
        </div>
      </div>
    </>
  )
}

// ── resolveMode ───────────────────────────────────────────────────────────────

function resolveMode(start: string | null): LauncherMode {
  if (start === 'aiurl') return 'aiurl'
  if (start === 'aidoc') return 'aidoc'
  if (start === 'csv') return 'csv'
  if (start === 'templates' || start === 'library') return 'templates'
  return 'aitopic'
}

// Returns true when a ?start= param should auto-open the source modal.
// 'manual' and null both mean "blank canvas directly".
function isSourceStart(start: string | null): boolean {
  return start === 'aitopic' || start === 'aiurl' || start === 'aidoc' || start === 'csv' || start === 'templates' || start === 'library'
}

// ── QuizBuilder ───────────────────────────────────────────────────────────────

export interface QuizBuilderProps {
  editId?: string | null
}

export function QuizBuilder({ editId }: QuizBuilderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = isKnownQuestionType(searchParams.get('type')) ? (searchParams.get('type') as never) : null
  const start = searchParams.get('start')
  const initialMode = resolveMode(start)

  const builder = useQuizBuilder({ editId, initialType })
  // Canvas is always shown. Source modal auto-opens for deep-link ?start= values.
  const [sourceModalOpen, setSourceModalOpen] = useState(() => !editId && isSourceStart(start))
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [titleError, setTitleError] = useState(false)

  function handleBack() {
    const nav = resolveHostBackNavigation({
      returnTo: searchParams.get('returnTo'),
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      fallback: editId ? '/host/quizzes' : '/host',
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

  function handleSourceApply(questions: Partial<Question>[], meta?: { title?: string; subject?: string }) {
    builder.applyGeneratedQuestions(questions)
    if (meta?.title) builder.setTitle(meta.title)
    if (meta?.subject) builder.setSubject(meta.subject)
    setSourceModalOpen(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#F8F9FA' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b bg-white"
        style={{ borderColor: '#E5E7EB', height: 56 }}
      >
        {/* Circular back button */}
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
          autoFocus={!editId}
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

        {/* Generate / Import button */}
        <button
          type="button"
          onClick={() => setSourceModalOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:brightness-95"
          style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
          title="Generate questions or import from a source"
        >
          <SparkleIcon className="w-3.5 h-3.5" />
          Generate / Import
        </button>

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

      {/* ── Body: canvas always visible ────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question list */}
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

        {/* Center: QuestionCanvas */}
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

      {/* ── Source modal (Generate / Import) ──────────────────────────── */}
      {sourceModalOpen && (
        <SourceModal
          plan={builder.plan}
          initialMode={initialMode}
          onApply={handleSourceApply}
          onClose={() => setSourceModalOpen(false)}
        />
      )}

      {/* ── AI Generate panel (in-builder modal via QuestionList) ──────── */}
      {aiPanelOpen && (
        <AIGeneratePanel
          plan={builder.plan}
          onClose={() => setAiPanelOpen(false)}
          onGenerated={raw => {
            builder.applyGeneratedQuestions(raw)
            setAiPanelOpen(false)
          }}
        />
      )}
    </div>
  )
}
