'use client'

/**
 * QuestionCanvas — the full-width center editing area in the new Slido-style builder.
 *
 * Layout: question header (type chip, timer, points, gear) → inline-editable
 * question text with ✨ AI button → option tiles → add-option row.
 *
 * Ported and restructured from QuestionPreview (host/create/page.tsx:505-803).
 * Key differences from the old preview:
 *   - No right panel — type, timer, points are in the canvas header.
 *   - AI sparkle buttons on question field and options row.
 *   - Gear icon opens QuestionSettingsPopover (replaces right panel sections).
 */

import React, { useRef, useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Question, QuestionType } from '@/lib/quiz-types'
import { getOptionText, getOptionImage, isScoredQuestion, isSequenceRanking } from '@/lib/quiz-types'
import {
  ANSWER_COLORS,
  TYPE_PILLS,
  QUESTION_TYPE_GROUPS,
  TIMER_OPTIONS,
  POINTS_OPTIONS,
  QUESTION_CHAR_LIMIT,
  OPTION_CHAR_LIMIT,
  hasCorrectAnswer,
  needsCorrectAnswer,
  questionTextSizeClass,
  getTypePill,
} from '@/lib/quiz-builder-logic'
import { getTypeIcon } from '@/lib/quiz-type-icons'
import { QuestionSettingsPopover } from './QuestionSettingsPopover'
import { SparkleIcon } from './SparkleIcon'

// ── AutoGrowTextarea ─────────────────────────────────────────────────────────

function AutoGrowTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }
) {
  const { minRows = 1, value, ...rest } = props
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} value={value} rows={minRows} {...rest} />
}

// ── CharCount badge ──────────────────────────────────────────────────────────

function CharCount({ value, limit }: { value: string; limit: number }) {
  const remaining = limit - value.length
  const isOver = remaining < 0
  const isWarning = !isOver && remaining <= 20
  return (
    <span
      className="absolute top-1.5 right-2 text-[10px] font-bold tabular-nums pointer-events-none select-none z-10 rounded px-1 py-0.5 leading-none"
      style={{
        color: isOver ? '#fff' : isWarning ? '#15803d' : '#94A3B8',
        background: isOver ? '#DC2626' : isWarning ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.05)',
      }}
    >
      {remaining}
    </span>
  )
}

// ── Sortable ranking item ────────────────────────────────────────────────────

function SortableRankItem({
  id, index, text, isOrdinal, onChange, canRemove, onRemove,
}: {
  id: string; index: number; text: string; isOrdinal: boolean
  onChange: (v: string) => void; canRemove: boolean; onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
  const badge = isOrdinal ? (ordinals[index] ?? `${index + 1}th`) : String(index + 1)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5"
    >
      <span
        className="cursor-grab active:cursor-grabbing w-5 text-gray-300 select-none"
        {...attributes}
        {...listeners}
      >
        &#8801;
      </span>
      <span className="w-7 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: '#4F46E5', color: '#fff' }}>
        {badge}
      </span>
      <input
        type="text"
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder={`Item ${index + 1}`}
        className="flex-1 text-sm font-medium bg-transparent outline-none border-0"
        style={{ color: '#374151' }}
      />
      {canRemove && (
        <button type="button" onClick={onRemove} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
          &times;
        </button>
      )}
    </div>
  )
}

// ── Type dropdown ─────────────────────────────────────────────────────────────

function TypeDropdown({ type, onChange }: { type: QuestionType; onChange: (t: QuestionType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pill = getTypePill(type)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors hover:brightness-95 min-w-0 max-w-full"
        style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.color}22` }}
      >
        <span className="flex-shrink-0 w-4 h-4">{getTypeIcon(type)}</span>
        {/* Compact label on mobile so a long type name can't push the action icons off-screen */}
        <span className="sm:hidden truncate">{pill.shortLabel ?? pill.label}</span>
        <span className="hidden sm:inline truncate">{pill.label}</span>
        <span className="text-[10px] opacity-60 flex-shrink-0">&#9660;</span>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-xl border bg-white overflow-hidden"
          style={{ width: 260, borderColor: '#E5E7EB' }}
        >
          {QUESTION_TYPE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: '#9CA3AF' }}>{group.label}</p>
              {group.types.map(t => {
                const p = getTypePill(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { onChange(t); setOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors text-left"
                    style={{ color: t === type ? p.color : '#374151', background: t === type ? p.bg : undefined }}
                  >
                    <span className="w-4 h-4 flex-shrink-0">{getTypeIcon(t)}</span>
                    {p.label}
                    {t === type && <span className="ml-auto text-[10px]">&#10003;</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timer / Points chips ──────────────────────────────────────────────────────

function ChipPicker<T extends number>({
  value, options, onChange, icon, formatter,
}: {
  value: T; options: readonly T[]; onChange: (v: T) => void
  icon: React.ReactNode; formatter: (v: T) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors hover:bg-gray-100"
        style={{ color: '#374151', background: '#F3F4F6' }}
      >
        {icon}
        {formatter(value)}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-xl border bg-white py-1.5" style={{ minWidth: 110, borderColor: '#E5E7EB' }}>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full px-3 py-1.5 text-xs font-semibold text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              style={{ color: opt === value ? '#2563EB' : '#374151' }}
            >
              {formatter(opt)}
              {opt === value && <span>&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AI sparkle button ─────────────────────────────────────────────────────────

function SparkleButton({ label, onClick, loading = false }: { label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1 text-[11px] font-semibold rounded-lg px-2.5 py-1.5 transition-all hover:brightness-95 disabled:opacity-50"
      style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      ) : (
        <SparkleIcon className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  )
}

// ── Main QuestionCanvas component ─────────────────────────────────────────────

export interface QuestionCanvasProps {
  question: Question
  index: number
  total: number
  plan: 'free' | 'pro'
  onChange: (partial: Partial<Question>) => void
  onTypeChange: (type: QuestionType) => void
  onDuplicate: () => void
  onDelete: () => void
}

export function QuestionCanvas({
  question,
  index,
  total,
  plan,
  onChange,
  onTypeChange,
  onDuplicate,
  onDelete,
}: QuestionCanvasProps) {
  const opts = question.options ?? []
  const scored = isScoredQuestion(question)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOptionsLoading, setAiOptionsLoading] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const rankingSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Close settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return
    function close(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [settingsOpen])

  function handleOptionChange(i: number, value: string) {
    const next = [...opts]
    const existing = next[i]
    const img = getOptionImage(existing ?? '')
    next[i] = img ? { text: value, imageUrl: img } : value
    onChange({ options: next })
  }

  function handleAddOption() {
    if (opts.length >= 6) return
    onChange({ options: [...opts, ''] })
  }

  function handleRemoveOption(i: number) {
    if (opts.length <= 2) return
    const next = opts.filter((_, idx) => idx !== i)
    onChange({ options: next })
  }

  function handleCorrectToggle(i: number) {
    if (question.type === 'multiselect') {
      const cur = new Set(question.correctAnswers ?? [])
      if (cur.has(String(i))) cur.delete(String(i))
      else cur.add(String(i))
      onChange({ correctAnswer: undefined, correctAnswers: Array.from(cur).sort() })
    } else if (needsCorrectAnswer(question.type)) {
      onChange({ correctAnswer: String(i) })
    }
  }

  // ── Inline AI: generate options ──────────────────────────────────────────

  async function handleAiOptions() {
    if (!question.text.trim()) { alert('Write a question first, then generate options.'); return }
    setAiOptionsLoading(true)
    try {
      const res = await fetch('/api/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: question.text, type: question.type }),
      })
      if (!res.ok) { alert('AI unavailable. Try again.'); return }
      const data = await res.json()
      if (data.options) onChange({ options: data.options, correctAnswer: data.correctAnswer, correctAnswers: data.correctAnswers })
    } catch {
      alert('Network error.')
    } finally {
      setAiOptionsLoading(false)
    }
  }

  // ── Ranked option handlers ───────────────────────────────────────────────

  function handleRankItemChange(i: number, value: string) {
    const next = [...opts]
    next[i] = value
    onChange({ options: next })
  }

  function handleRankItemRemove(i: number) {
    if (opts.length <= 2) return
    const next = opts.filter((_, idx) => idx !== i)
    const newCorrectOrder = next.map((_, ni) => String(ni))
    onChange({ options: next, correctOrder: isSequenceRanking(question) ? newCorrectOrder : undefined })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const showOptionsAI = (
    question.type === 'mcq' ||
    question.type === 'multiselect' ||
    question.type === 'poll'
  )

  const showAddOption = (
    question.type !== 'truefalse' &&
    question.type !== 'rating' &&
    opts.length < 6 &&
    (question.type === 'mcq' || question.type === 'multiselect' || question.type === 'poll' || question.type === 'ranking' || question.type === 'case')
  )

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 32px rgba(15,27,61,0.08)', border: '1px solid #E5E7EB' }}>

      {/* ── Canvas header: type + timer + points + gear + actions ─────────── */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 border-b sm:gap-2 sm:px-4" style={{ borderColor: '#F3F4F6', background: '#FAFAFA' }}>
        {/* Left cluster: type + timer + points. Shrinks (type label ellipsizes) so the
            action icons on the right are never pushed off-screen on narrow phones. */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
        {/* Type dropdown */}
        <TypeDropdown type={question.type} onChange={onTypeChange} />

        {/* Timer chip */}
        <ChipPicker
          value={question.timerSeconds}
          options={TIMER_OPTIONS}
          onChange={v => onChange({ timerSeconds: v })}
          formatter={v => `${v}s`}
          icon={<span className="text-[12px]">&#9201;</span>}
        />

        {/* Points chip — only for scored types */}
        {scored && (
          <ChipPicker
            value={question.points}
            options={POINTS_OPTIONS}
            onChange={v => onChange({ points: v })}
            formatter={v => `${v} pts`}
            icon={<span className="text-[12px]">&#11088;</span>}
          />
        )}

        </div>

        {/* Action cluster: pinned to the right, never shrinks or clips */}
        <div className="flex items-center flex-shrink-0">
        {/* Question number */}
        <span className="text-xs text-gray-400 font-medium tabular-nums hidden sm:block mr-1">
          {index + 1} / {total}
        </span>

        {/* Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Duplicate question"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><rect x="6" y="6" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14V5a1 1 0 011-1h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>

        {/* Delete */}
        {total > 1 && (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
            title="Delete question"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M7 8v7m3-7v7m3-7v7M4 5h12M8 5V4h4v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}

        {/* Gear → settings popover */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: settingsOpen ? '#7C3AED' : '#9CA3AF' }}
            title="Question settings"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2.5v1m0 13v1M2.5 10h1m13 0h1M4.1 4.1l.7.7m10.1 10.1.7.7M4.1 15.9l.7-.7M14.9 5.1l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          {settingsOpen && (
            <QuestionSettingsPopover
              question={question}
              onChange={onChange}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
        </div>
      </div>

      {/* ── Question text ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative px-6 pt-6 pb-3 text-center" style={{ background: '#FAFAF8', borderBottom: '1px solid #EDE8E0' }}>
        <CharCount value={question.text} limit={QUESTION_CHAR_LIMIT} />
        <AutoGrowTextarea
          value={question.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="What would you like to ask?"
          minRows={1}
          maxLength={160}
          className={`w-full font-bold text-center bg-transparent outline-none resize-none border border-transparent hover:border-blue-200 hover:bg-blue-50/40 focus:border-transparent focus:ring-2 focus:ring-blue-100 rounded-lg transition-all leading-snug cursor-text ${questionTextSizeClass(question.text)}`}
          style={{ color: '#0F1B3D' }}
        />
      </div>

      {/* ── Image preview (if set) ──────────────────────────────────────── */}
      {question.imageUrl && (
        <div className="flex-shrink-0 flex items-center justify-center bg-gray-50 border-b" style={{ height: 'clamp(140px, 32vh, 420px)', borderColor: '#E5E7EB' }}>
          <img src={question.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* ── Options / type body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 justify-center">

        {/* MCQ / multi-select / T-F / Poll / Case — coloured option tiles */}
        {(question.type === 'mcq' || question.type === 'multiselect' || question.type === 'truefalse' || question.type === 'poll' || question.type === 'case') && opts.length > 0 && (
          <>
            {needsCorrectAnswer(question.type) && !hasCorrectAnswer(question.type, question) && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: '#F59E0B', color: '#fff' }}>!</span>
                {question.type === 'multiselect'
                  ? 'Mark every correct option using the check buttons.'
                  : 'Mark the one correct answer using the check button.'}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {opts.map((opt, i) => {
                const c = ANSWER_COLORS[i] ?? ANSWER_COLORS[0]!
                const optText = getOptionText(opt)
                const isCorrect = question.type === 'multiselect'
                  ? (question.correctAnswers ?? []).includes(String(i))
                  : question.correctAnswer === String(i) && hasCorrectAnswer(question.type, question)
                return (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-xl min-h-[100px] flex"
                    style={{
                      background: c.hex,
                      boxShadow: isCorrect
                        ? `0 0 0 3px #FDE047, 0 2px 0 ${c.hexDark}`
                        : `0 2px 0 ${c.hexDark}`,
                    }}
                  >
                    <CharCount value={optText} limit={OPTION_CHAR_LIMIT} />
                    <div className="flex items-center gap-3 px-3 py-3 w-full">
                      {/* Correct-answer toggle */}
                      <button
                        type="button"
                        onClick={() => handleCorrectToggle(i)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 transition-all hover:scale-110"
                        style={{ background: 'rgba(255,255,255,0.25)', border: isCorrect ? '2px solid #FDE047' : '2px solid transparent' }}
                        title={needsCorrectAnswer(question.type) ? 'Mark correct' : undefined}
                      >
                        {isCorrect ? '✓' : c.letter}
                      </button>
                      {/* Option text */}
                      <AutoGrowTextarea
                        value={optText}
                        onChange={e => handleOptionChange(i, e.target.value.replace(/\n/g, ''))}
                        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                        placeholder={`Option ${c.letter}`}
                        disabled={question.type === 'truefalse'}
                        maxLength={100}
                        className="flex-1 min-w-0 text-sm font-bold bg-transparent outline-none border border-transparent hover:border-white/40 hover:bg-white/10 focus:border-white/40 focus:bg-white/10 text-white placeholder:text-white/60 disabled:opacity-70 resize-none leading-snug rounded transition-all cursor-text"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                      />
                      {/* Remove option button (not for truefalse, min 2 options) */}
                      {question.type !== 'truefalse' && opts.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="text-white/50 hover:text-white transition-colors text-lg leading-none flex-shrink-0"
                          title="Remove option"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Rating stars */}
        {question.type === 'rating' && (
          <div className="flex items-center justify-center gap-3 py-8">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className="text-4xl" style={{ color: '#EA580C' }}>&#9733;</span>
            ))}
            <p className="ml-3 text-sm text-gray-400">Participants rate 1–5 stars</p>
          </div>
        )}

        {/* Ranking */}
        {question.type === 'ranking' && opts.length > 0 && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <input
                type="checkbox"
                checked={isSequenceRanking(question)}
                onChange={e => {
                  onChange({ correctOrder: e.target.checked ? opts.map((_, i) => String(i)) : undefined })
                }}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-semibold" style={{ color: '#15803D' }}>Scored sequence — participants must match this order</span>
            </label>
            <DndContext
              sensors={rankingSensors}
              collisionDetection={closestCenter}
              onDragEnd={event => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const from = opts.findIndex((_, i) => String(i) === active.id)
                  const to = opts.findIndex((_, i) => String(i) === over.id)
                  const reordered = arrayMove(opts, from, to)
                  onChange({
                    options: reordered,
                    correctOrder: isSequenceRanking(question) ? reordered.map((_, i) => String(i)) : undefined,
                  })
                }
              }}
            >
              <SortableContext items={opts.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                {opts.map((opt, i) => (
                  <SortableRankItem
                    key={i}
                    id={String(i)}
                    index={i}
                    text={getOptionText(opt)}
                    isOrdinal={isSequenceRanking(question)}
                    onChange={v => handleRankItemChange(i, v)}
                    canRemove={opts.length > 2}
                    onRemove={() => handleRankItemRemove(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Word cloud placeholder */}
        {question.type === 'wordcloud' && (
          <div className="py-8 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 px-4">
            {['Ideas', 'Creativity', 'Team', 'Growth', 'Vision', 'Focus', 'Innovation', 'Energy'].map((w, i) => (
              <span key={i} className="font-bold text-gray-200" style={{ fontSize: [22, 15, 26, 13, 19, 11, 17, 12][i] }}>{w}</span>
            ))}
            <p className="w-full text-center text-xs text-gray-300 mt-2">Participant words appear here live</p>
          </div>
        )}

        {/* Open-ended placeholder */}
        {question.type === 'openended' && (
          <div className="py-6 px-4">
            <div className="rounded-xl p-5 text-center" style={{ border: '1.5px dashed #D1D5DB' }}>
              <p className="text-sm text-gray-300">Free-text responses appear here during the session</p>
            </div>
          </div>
        )}

        {/* Q&A placeholder */}
        {question.type === 'qa' && (
          <div className="py-4 space-y-2">
            {['How does this work?', 'Can you explain more?', 'What about...'].map((q, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50">
                <span className="text-[10px] font-bold text-gray-300">Q</span>
                <span className="text-xs text-gray-300">{q}</span>
              </div>
            ))}
            <p className="text-xs text-gray-300 text-center pt-1">Participant questions appear here</p>
          </div>
        )}

        {/* Add option + AI options row */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {showAddOption && (
            <button
              type="button"
              onClick={handleAddOption}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#F3F4F6', color: '#374151', border: '1px dashed #D1D5DB' }}
            >
              <span className="text-sm leading-none">+</span> Add option
            </button>
          )}
          {showOptionsAI && (
            <SparkleButton
              label="Add options with AI"
              onClick={handleAiOptions}
              loading={aiOptionsLoading}
            />
          )}
        </div>
      </div>

      {/* ── Footer: branding (free plan) ──────────────────────────────────── */}
      {plan === 'free' && (
        <div className="flex-shrink-0 border-t px-4 py-2 flex justify-end" style={{ borderColor: '#F3F4F6' }}>
          <span className="text-[9px] font-bold opacity-30" style={{ color: '#0F1B3D' }}>quizotic.live</span>
        </div>
      )}
    </div>
  )
}
