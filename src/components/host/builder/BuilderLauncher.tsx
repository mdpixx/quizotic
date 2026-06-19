'use client'

/**
 * BuilderLauncher — the quiz-creation start screen for /host/build.
 *
 * Shows a split layout:
 *   - Left rail (240px): 6 source options (Topic, PDF/DOCX, URL, CSV, Templates, Blank)
 *   - Right panel: contextual input / gallery for the selected source
 *
 * Rendered by QuizBuilder when editId is absent and start !== 'manual'.
 * Disappears (onApply / onBlank) once the user has provided a source.
 *
 * Reads the `start` query param via `initialMode` to preselect the right panel.
 */

import { useState, useCallback } from 'react'
import type { Question } from '@/lib/quiz-types'
import { QUIZ_TEMPLATES, type TemplateAudience } from '@/lib/quiz-templates'
import { parseCsvToQuestions, SAMPLE_CSV } from '@/lib/csv-import'
import { AIGenerateForm, type AIGenerateMode } from './AIGenerateForm'
import { SparkleIcon } from './SparkleIcon'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LauncherMode = 'aitopic' | 'aiurl' | 'aidoc' | 'csv' | 'templates' | 'blank'

export interface LauncherApplyMeta {
  title?: string
  subject?: string
}

interface BuilderLauncherProps {
  plan: 'free' | 'pro'
  initialMode?: LauncherMode
  onApply: (questions: Partial<Question>[], meta?: LauncherApplyMeta) => void
  onBlank: () => void
  /** Optional close handler (used when launcher is inside a modal). */
  onClose?: () => void
}

// ── Left rail config ──────────────────────────────────────────────────────────

interface RailItem {
  mode: LauncherMode
  label: string
  sublabel: string
  icon: React.ReactNode
}

function IconSparkle() {
  return <SparkleIcon className="w-4 h-4" />
}
function IconDocument() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h7l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M13 2v4h3M7 9h6M7 12h6M7 15h4" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12a4 4 0 005.6.4l2-2a4 4 0 00-5.6-5.6l-1.1 1.1" />
      <path d="M12 8a4 4 0 00-5.6-.4l-2 2a4 4 0 005.6 5.6l1.1-1.1" />
    </svg>
  )
}
function IconTable() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="13" rx="2" />
      <path d="M2 8h16M7 8v9" />
    </svg>
  )
}
function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconPencil() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3l4 4L6 18H2v-4L13 3z" />
    </svg>
  )
}

const RAIL_ITEMS: RailItem[] = [
  { mode: 'aitopic',   label: 'Topic',       sublabel: 'Generate with AI', icon: <IconSparkle /> },
  { mode: 'aidoc',     label: 'PDF / DOCX',  sublabel: 'Upload notes',      icon: <IconDocument /> },
  { mode: 'aiurl',     label: 'Web URL',     sublabel: 'Read a page',       icon: <IconLink /> },
  { mode: 'csv',       label: 'CSV bank',    sublabel: 'Import questions',  icon: <IconTable /> },
  { mode: 'templates', label: 'Templates',   sublabel: 'Ready-made sets',   icon: <IconGrid /> },
  { mode: 'blank',     label: 'Blank quiz',  sublabel: 'Start from scratch',icon: <IconPencil /> },
]

const AI_MODES: LauncherMode[] = ['aitopic', 'aiurl', 'aidoc']

// ── Template panel ─────────────────────────────────────────────────────────────

const AUDIENCE_COLORS: Record<TemplateAudience, { bg: string; text: string; border: string }> = {
  Schools:   { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  Corporate: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  Both:      { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
}

const AUDIENCE_FILTERS: Array<TemplateAudience | 'All'> = ['All', 'Schools', 'Corporate', 'Both']

function TemplatesPanel({ onApply }: { onApply: BuilderLauncherProps['onApply'] }) {
  const [filter, setFilter] = useState<TemplateAudience | 'All'>('All')

  const filtered = filter === 'All'
    ? QUIZ_TEMPLATES
    : QUIZ_TEMPLATES.filter(t => t.audience === filter)

  function handleUse(id: string) {
    const template = QUIZ_TEMPLATES.find(t => t.id === id)
    if (!template) return
    onApply(
      template.quiz.questions,
      { title: template.quiz.title, subject: template.quiz.subject },
    )
  }

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {AUDIENCE_FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-bold border transition-all"
            style={
              filter === f
                ? { background: '#0F1B3D', color: '#fff', borderColor: '#0F1B3D' }
                : { background: '#fff', color: '#64748B', borderColor: '#E2E8F0' }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(t => {
          const colors = AUDIENCE_COLORS[t.audience]
          return (
            <div
              key={t.id}
              className="rounded-xl border bg-white p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow"
              style={{ borderColor: '#E2E8F0' }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em]"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {t.audience}
                </span>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: '#94A3B8' }}>
                  {t.questionCount}Q
                </span>
              </div>
              <div>
                <p className="text-sm font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                  {t.title}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>
                  {t.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUse(t.id)}
                className="mt-auto self-end px-3 py-1.5 rounded-lg text-xs font-black transition-colors hover:opacity-80"
                style={{ background: '#FBD13B', color: '#0F1B3D' }}
              >
                Use &rarr;
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CSV panel ──────────────────────────────────────────────────────────────────

function CsvPanel({ onApply }: { onApply: BuilderLauncherProps['onApply'] }) {
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  function processFile(file: File) {
    if (!file.name.match(/\.csv$/i)) {
      setError('Please upload a .csv file.')
      return
    }
    setFileName(file.name)
    setImporting(true)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const result = parseCsvToQuestions(text)
      setImporting(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setError('')
      onApply(result.questions, { title: file.name.replace(/\.csv$/i, '') })
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quizotic-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 max-w-md">
      <button
        type="button"
        onClick={downloadTemplate}
        className="flex items-center gap-2 text-sm font-bold transition-opacity hover:opacity-70"
        style={{ color: '#7C3AED' }}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M4 7l4 4 4-4M3 13h10" />
        </svg>
        Download CSV template
      </button>

      <label
        className="flex flex-col items-center gap-3 border-2 border-dashed rounded-xl p-8 transition-all"
        style={{
          borderColor: dragging ? '#7C3AED' : importing ? '#C4B5FD' : '#CBD5E1',
          background: dragging ? '#F5F3FF' : importing ? '#FAF5FF' : '#F8FAFC',
          cursor: importing ? 'default' : 'pointer',
          pointerEvents: importing ? 'none' : 'auto',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {importing ? (
          <svg className="animate-spin w-8 h-8" viewBox="0 0 16 16" fill="none" stroke="#7C3AED" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" opacity="0.3" />
            <path d="M14 8a6 6 0 00-6-6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none" stroke={dragging ? '#7C3AED' : '#94A3B8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="8" width="32" height="26" rx="3" />
            <path d="M4 15h32M13 15v19M4 22h9M4 29h9" />
          </svg>
        )}
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
            {importing ? 'Importing questions…' : fileName || 'Drop your CSV here, or click to browse'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            Columns: question, optionA–D, correctAnswer, timer, points
          </p>
        </div>
        <input type="file" accept=".csv,.CSV" className="hidden" onChange={handleFileChange} />
      </label>

      {error && (
        <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Right panel header ─────────────────────────────────────────────────────────

const PANEL_HEADERS: Record<LauncherMode, { title: string; sub: string }> = {
  aitopic:   { title: 'Generate from a topic',   sub: 'AI writes questions on any subject you name.' },
  aiurl:     { title: 'Generate from a URL',      sub: 'Paste a web page link — AI reads and builds questions.' },
  aidoc:     { title: 'Generate from a document', sub: 'Upload a PDF or DOCX — AI extracts the key content.' },
  csv:       { title: 'Import from CSV',           sub: 'Upload a question bank in spreadsheet format.' },
  templates: { title: 'Start from a template',    sub: '8 ready-made question sets — edit to fit your content.' },
  blank:     { title: 'Blank quiz',               sub: 'Build your questions manually, one by one.' },
}

// ── BuilderLauncher ────────────────────────────────────────────────────────────

export function BuilderLauncher({ plan, initialMode = 'aitopic', onApply, onBlank, onClose }: BuilderLauncherProps) {
  const [mode, setMode] = useState<LauncherMode>(initialMode)

  const handleApply = useCallback(
    (questions: Partial<Question>[], meta?: LauncherApplyMeta) => {
      onApply(questions, meta)
    },
    [onApply],
  )

  const header = PANEL_HEADERS[mode]
  const isAI = AI_MODES.includes(mode)

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Left rail ── */}
      <div
        className="flex-shrink-0 flex flex-col overflow-y-auto border-r"
        style={{ width: 232, background: '#fff', borderColor: '#E5E7EB' }}
      >
        <p
          className="px-4 pt-5 pb-2 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{ color: '#9CA3AF' }}
        >
          Start from
        </p>

        <ul className="px-2 pb-4 space-y-0.5">
          {RAIL_ITEMS.map(item => {
            const active = mode === item.mode
            return (
              <li key={item.mode}>
                <button
                  type="button"
                  onClick={() => setMode(item.mode)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={
                    active
                      ? { background: '#fff', color: '#0F1B3D', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }
                      : { color: '#6B7280', border: '1px solid transparent' }
                  }
                >
                  <span
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
                    style={
                      active
                        ? { background: '#F5F3FF', color: '#7C3AED' }
                        : { background: '#F3F4F6', color: '#9CA3AF' }
                    }
                  >
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-xs font-black" style={{ color: active ? '#0F1B3D' : '#374151' }}>
                      {item.label}
                    </span>
                    <span className="block text-[11px]" style={{ color: active ? '#6B7280' : '#9CA3AF' }}>
                      {item.sublabel}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex-1 overflow-y-auto p-6 md:p-8"
        style={{ background: 'var(--color-paper, #F8F9FA)' }}
      >
        {/* Header */}
        <div className="mb-6 max-w-2xl">
          <h2
            className="text-2xl font-black"
            style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}
          >
            {header.title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
            {header.sub}
          </p>
        </div>

        {/* Panel content */}
        {isAI && (
          <div className="max-w-md">
            <AIGenerateForm
              key={mode}
              initialMode={mode as AIGenerateMode}
              plan={plan}
              onGenerated={raw => onApply(raw)}
            />
          </div>
        )}

        {mode === 'csv' && (
          <CsvPanel onApply={handleApply} />
        )}

        {mode === 'templates' && (
          <TemplatesPanel onApply={handleApply} />
        )}

        {mode === 'blank' && (
          <div className="max-w-sm">
            <div
              className="rounded-2xl border bg-white p-6 space-y-4"
              style={{ borderColor: '#E2E8F0' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F1F5F9', color: '#475569' }}>
                <IconPencil />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#475569' }}>
                  No AI, no import — just you and a blank canvas. Add questions one by one and customise every detail.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose ?? onBlank}
                className="w-full py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90"
                style={{ background: '#0F1B3D', color: '#FBD13B' }}
              >
                {onClose ? 'Close and build manually →' : 'Open blank builder →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
