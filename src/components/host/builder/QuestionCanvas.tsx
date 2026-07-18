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
  QUESTION_TYPE_GROUPS,
  TIMER_OPTIONS,
  POINTS_OPTIONS,
  QUESTION_CHAR_LIMIT,
  OPTION_CHAR_LIMIT,
  hasCorrectAnswer,
  needsCorrectAnswer,
  questionTextSizeClass,
  getTypePill,
  addOptionPatch,
  removeOptionPatch,
} from '@/lib/quiz-builder-logic'
import { getTypeIcon, getTypeIllustration } from '@/lib/quiz-type-icons'
import { QuestionSettingsPopover } from './QuestionSettingsPopover'
import { SparkleIcon } from './SparkleIcon'
import { ImageUpload } from '@/components/ImageUpload'

// ── AutoGrowTextarea ─────────────────────────────────────────────────────────

// CSS-only auto-grow: an invisible replica of the text sizes the grid cell and
// the textarea stretches to fill it. Unlike the old scrollHeight-in-JS
// approach, the height can never go stale — it tracks font-size breakpoint
// changes and hidden→visible container switches (mobile pager vs desktop
// canvas) with zero measurement code, so the text is never clipped.
function AutoGrowTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    minRows?: number
    wrapperClassName?: string
  }
) {
  const { minRows = 1, value, className, style, wrapperClassName = 'w-full', ...rest } = props
  const text = String(value ?? '')
  // Replica falls back to the placeholder so the empty state reserves the same
  // height the placeholder text renders at; trailing space keeps a trailing
  // newline from collapsing.
  const replica = (text.length > 0 ? text : rest.placeholder ?? '') + ' '
  // grid-cols-[minmax(0,1fr)] + overflow-wrap:anywhere: a long unbroken string
  // must not widen the grid track (break-word wraps visually but keeps the full
  // word as the min-content width, which let a spaceless question stretch the
  // textarea past the viewport and clip from the left).
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] min-w-0 ${wrapperClassName}`}>
      <div
        aria-hidden
        className={`${className ?? ''} invisible whitespace-pre-wrap [overflow-wrap:anywhere] pointer-events-none select-none`}
        style={{ ...style, gridArea: '1 / 1' }}
      >
        {replica}
      </div>
      <textarea
        value={value}
        rows={minRows}
        className={`${className ?? ''} h-full overflow-y-auto [overflow-wrap:anywhere]`}
        style={{ ...style, gridArea: '1 / 1' }}
        {...rest}
      />
    </div>
  )
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
          className="absolute top-full left-0 mt-1 z-50 rounded-xl border bg-white overflow-y-auto overscroll-contain"
          style={{ width: 260, maxHeight: 'min(60vh, 360px)', borderColor: '#E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 16px 40px rgba(15,27,61,0.14)' }}
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
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border bg-white py-1.5" style={{ minWidth: 110, borderColor: '#E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 16px 40px rgba(15,27,61,0.14)' }}>
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

// ── Title-band detail chip (Add image / Add explanation) ─────────────────────

// Quiet, always-visible entry points for the per-question details that used to
// hide behind the settings icon. `open` is controlled so the media region's
// "Replace" pill can reopen the image popover from outside the chip.
function TitleBandChip({
  open,
  onOpenChange,
  isSet,
  idleLabel,
  setLabel,
  icon,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSet: boolean
  idleLabel: string
  setLabel: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, onOpenChange])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border backdrop-blur-sm transition-[opacity,border-color,color,transform] duration-150 active:scale-[0.97] ${
          isSet
            ? 'text-green-700 bg-green-50/90 border-green-200'
            : 'text-gray-500 bg-white/70 border-[#E3E5E9] opacity-75 hover:opacity-100 hover:text-gray-900'
        }`}
      >
        {icon}
        {isSet ? setLabel : idleLabel}
      </button>
      {open && (
        <>
          {/* Mobile: viewport-level overlay so the card can never overflow
              either screen edge (the chip sits in the bottom-right corner,
              so a right-anchored popover ran off the left edge on phones).
              Desktop keeps the original anchored popover, unchanged. */}
          <div
            className="md:hidden fixed inset-0 z-[60] flex items-end justify-center p-3"
            style={{ background: 'rgba(15,27,61,0.25)' }}
            onClick={() => onOpenChange(false)}
          >
            <div
              className="w-[calc(100vw-1.5rem)] max-w-[360px] rounded-xl bg-white p-3 text-left"
              style={{ border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 16px 40px rgba(15,27,61,0.14)' }}
              onClick={e => e.stopPropagation()}
            >
              {children}
            </div>
          </div>
          <div
            className="hidden md:block absolute right-0 top-full mt-1.5 z-50 rounded-xl bg-white p-3 text-left"
            style={{ width: 280, border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 16px 40px rgba(15,27,61,0.14)' }}
          >
            {children}
          </div>
        </>
      )}
    </div>
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
  const [imageChipOpen, setImageChipOpen] = useState(false)
  const [explanationChipOpen, setExplanationChipOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Status row state — always mounted (fixed height) so marking a correct
  // answer flips the row's colors in place instead of collapsing it, which
  // used to shift the option grid up by ~40px.
  const needsAnswer = needsCorrectAnswer(question.type)
  const answerMarked = hasCorrectAnswer(question.type, question)

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

  // Add/remove go through the pure patch helpers so the index remapping of
  // correctAnswer/correctAnswers/correctOrder stays unit-tested — removing an
  // option without remapping silently moved the correct answer to a neighbour.
  function handleAddOption() {
    const patch = addOptionPatch(question)
    if (patch) onChange(patch)
  }

  function handleRemoveOption(i: number) {
    const patch = removeOptionPatch(question, i)
    if (patch) onChange(patch)
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
    const patch = removeOptionPatch(question, i)
    if (patch) onChange(patch)
  }

  // ── Fill-in-the-blank handlers ───────────────────────────────────────────

  const blankAnswers = question.blankAnswers ?? ['']
  function handleBlankChange(i: number, value: string) {
    const next = [...blankAnswers]
    next[i] = value
    onChange({ blankAnswers: next })
  }
  function handleBlankAdd() {
    if (blankAnswers.length >= 6) return
    onChange({ blankAnswers: [...blankAnswers, ''] })
  }
  function handleBlankRemove(i: number) {
    if (blankAnswers.length <= 1) return
    onChange({ blankAnswers: blankAnswers.filter((_, idx) => idx !== i) })
  }

  // ── Matching handlers ────────────────────────────────────────────────────

  const matchPairs = question.matchPairs ?? [{ left: '', right: '' }, { left: '', right: '' }]
  function handlePairChange(i: number, side: 'left' | 'right', value: string) {
    const next = matchPairs.map((p, idx) => (idx === i ? { ...p, [side]: value } : p))
    onChange({ matchPairs: next })
  }
  function handlePairAdd() {
    if (matchPairs.length >= 8) return
    onChange({ matchPairs: [...matchPairs, { left: '', right: '' }] })
  }
  function handlePairRemove(i: number) {
    if (matchPairs.length <= 2) return
    onChange({ matchPairs: matchPairs.filter((_, idx) => idx !== i) })
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

  // ── Leaderboard flow slide ─────────────────────────────────────────────────
  // A non-answerable slide. No options, no timer/points — just a heading and a
  // "show top N" control. The standings are computed live when the host reaches
  // this slide during the session (see server.mjs leaderboard_slide_show).
  if (question.type === 'leaderboard') {
    const topN = question.topN ?? 5
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl" style={{ boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 8px 24px rgba(15,27,61,0.06)', border: '1px solid #E8EAED' }}>
        {/* Header: type dropdown + actions */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 border-b sm:gap-2 sm:px-4 rounded-t-2xl" style={{ borderColor: '#F3F4F6', background: '#FAFAFA' }}>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <TypeDropdown type={question.type} onChange={onTypeChange} />
          </div>
          <div className="flex items-center flex-shrink-0">
            <span className="text-xs text-gray-400 font-medium tabular-nums hidden sm:block mr-1">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onDuplicate}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Duplicate slide"
            >
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 sm:w-[18px] sm:h-[18px]"><rect x="6" y="6" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14V5a1 1 0 011-1h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            {total > 1 && (
              <button
                type="button"
                onClick={onDelete}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
                title="Delete slide"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 sm:w-[18px] sm:h-[18px]"><path d="M7 8v7m3-7v7m3-7v7M4 5h12M8 5V4h4v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Body: podium + heading + top-N stepper */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center gap-5 text-center">
          <div style={{ width: 220, maxWidth: '70%' }}>{getTypeIllustration('leaderboard')}</div>
          <div>
            <p className="text-lg font-black" style={{ color: '#0F1B3D' }}>Leaderboard</p>
            <p className="text-sm text-gray-500 mt-1 mx-auto" style={{ maxWidth: 340 }}>
              When you reach this slide while presenting, it reveals the current standings. Players see the rankings here — there&apos;s nothing to answer.
            </p>
          </div>

          <input
            type="text"
            value={question.text}
            onChange={e => onChange({ text: e.target.value })}
            placeholder="Optional heading (e.g. Standings so far)"
            maxLength={QUESTION_CHAR_LIMIT}
            className="w-full max-w-sm text-sm font-medium text-center rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-200"
            style={{ border: '1px solid #E2E8F0', color: '#0F1B3D' }}
          />

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: '#374151' }}>Show top</span>
            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1" style={{ background: '#F3F4F6' }}>
              <button
                type="button"
                onClick={() => onChange({ topN: Math.max(3, topN - 1) })}
                disabled={topN <= 3}
                className="w-7 h-7 flex items-center justify-center rounded-md text-base font-bold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Show fewer players"
              >
                &minus;
              </button>
              <span className="w-6 text-center text-sm font-black tabular-nums" style={{ color: '#0F1B3D' }}>{topN}</span>
              <button
                type="button"
                onClick={() => onChange({ topN: Math.min(10, topN + 1) })}
                disabled={topN >= 10}
                className="w-7 h-7 flex items-center justify-center rounded-md text-base font-bold text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Show more players"
              >
                +
              </button>
            </div>
            <span className="text-sm" style={{ color: '#374151' }}>players</span>
          </div>
        </div>

        {plan === 'free' && (
          <div className="flex-shrink-0 border-t px-4 py-2 flex justify-end rounded-b-2xl" style={{ borderColor: '#F3F4F6' }}>
            <span className="text-[9px] font-bold opacity-30" style={{ color: '#0F1B3D' }}>quizotic.live</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl" style={{ boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 8px 24px rgba(15,27,61,0.06)', border: '1px solid #E8EAED' }}>

      {/* ── Canvas header: type + timer + points + gear + actions ─────────── */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 border-b sm:gap-2 sm:px-4 rounded-t-2xl" style={{ borderColor: '#F3F4F6', background: '#FAFAFA' }}>
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
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Duplicate question"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 sm:w-[18px] sm:h-[18px]"><rect x="6" y="6" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14V5a1 1 0 011-1h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>

        {/* Delete */}
        {total > 1 && (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all"
            title="Delete question"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 sm:w-[18px] sm:h-[18px]"><path d="M7 8v7m3-7v7m3-7v7M4 5h12M8 5V4h4v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}

        {/* Sliders → question details popover */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen(o => !o)}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] transition-colors hover:bg-gray-100"
            style={{ color: settingsOpen ? '#7C3AED' : '#6B7280' }}
            title="Question details"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 sm:w-[18px] sm:h-[18px]"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7.5" cy="6" r="2.1" fill="#FAFAFA" stroke="currentColor" strokeWidth="1.5"/><circle cx="13" cy="10" r="2.1" fill="#FAFAFA" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="14" r="2.1" fill="#FAFAFA" stroke="currentColor" strokeWidth="1.5"/></svg>
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
      {/* Fixed-height band: the question sits in the same place on every slide
          regardless of type or text length. The font scales down with length
          (questionTextSizeClass) so the full text fits without scrolling. */}
      <div
        className="flex-shrink-0 relative px-3 md:px-6 py-4 flex items-stretch gap-3 md:gap-5 min-w-0 max-w-full"
        style={{ background: '#FAFAF8', borderBottom: '1px solid #EDE8E0', height: 'clamp(132px, 24vh, 208px)' }}
      >
        <CharCount value={question.text} limit={QUESTION_CHAR_LIMIT} />

        {/* Inline image — left third of the band. The band keeps its fixed
            height, so attaching an image never pushes the answers down. */}
        {question.imageUrl && (
          <div
            className="relative group flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center w-[clamp(80px,34%,150px)] md:w-[clamp(110px,30%,300px)]"
            style={{ background: '#F5F6F8', boxShadow: 'inset 0 0 0 1px rgba(15,27,61,0.06)' }}
          >
            <img src={question.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
            <button
              type="button"
              onClick={() => onChange({ imageUrl: undefined })}
              className="md:hidden absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center shadow-md backdrop-blur-sm transition-colors"
              aria-label="Remove image"
              title="Remove image"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
            <div className="absolute top-1.5 right-1.5 hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setImageChipOpen(true)}
                className="text-[10px] font-semibold text-gray-700 hover:text-gray-900 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm transition-colors"
                style={{ border: '1px solid #E3E5E9' }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange({ imageUrl: undefined })}
                className="text-[10px] font-semibold text-gray-700 hover:text-red-600 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm transition-colors"
                style={{ border: '1px solid #E3E5E9' }}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Question text — full width without an image, right two-thirds with one */}
        <div className="flex-1 min-w-0 max-h-full flex flex-col justify-center text-center">
          <AutoGrowTextarea
            value={question.text}
            onChange={e => onChange({ text: e.target.value })}
            placeholder="What would you like to ask?"
            minRows={1}
            maxLength={160}
            wrapperClassName="w-full max-h-full overflow-hidden"
            className={`w-full font-bold text-center bg-transparent outline-none resize-none border border-transparent hover:border-blue-200 hover:bg-blue-50/40 focus:border-transparent focus:ring-2 focus:ring-blue-100 rounded-lg transition-all leading-snug cursor-text ${questionTextSizeClass(question.text)}`}
            style={{ color: '#0F1B3D' }}
          />
        </div>

        {/* Detail chips — bottom-right, absolute so they consume no band height */}
        <div className="absolute bottom-2 right-3 flex gap-1.5 z-10">
          <TitleBandChip
            open={imageChipOpen}
            onOpenChange={setImageChipOpen}
            isSet={!!question.imageUrl}
            idleLabel="Add image"
            setLabel="Image ✓"
            icon={
              <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 flex-shrink-0"><rect x="1" y="2" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.8" cy="5.5" r="1.2" stroke="currentColor" strokeWidth="1.1"/><path d="M1.5 10.5l3-3 2.5 2.5 2.5-3 3 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Image</p>
            <ImageUpload
              imageUrl={question.imageUrl}
              onUpload={url => { onChange({ imageUrl: url }); setImageChipOpen(false) }}
              onRemove={() => onChange({ imageUrl: undefined })}
              variant="question"
            />
          </TitleBandChip>
          <TitleBandChip
            open={explanationChipOpen}
            onOpenChange={setExplanationChipOpen}
            isSet={!!question.explanation?.trim()}
            idleLabel={question.type === 'case' ? 'Add debrief' : 'Add explanation'}
            setLabel={question.type === 'case' ? 'Debrief ✓' : 'Explanation ✓'}
            icon={
              <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 flex-shrink-0"><path d="M3 1.5h6.5L12 4v8.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M4.5 6.5h5M4.5 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            }
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#9CA3AF' }}>
              {question.type === 'case' ? 'Debrief' : 'Explanation'}
            </p>
            <p className="text-[11px] text-gray-400 mb-2">Shown after participants answer.</p>
            <textarea
              value={question.explanation ?? ''}
              onChange={e => onChange({ explanation: e.target.value || undefined })}
              placeholder={
                question.type === 'case'
                  ? "Expert reasoning — what's the right call and why?"
                  : 'Why is this the correct answer?'
              }
              rows={3}
              maxLength={500}
              autoFocus
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </TitleBandChip>
        </div>
      </div>

      {/* ── Options / type body ───────────────────────────────────────────── */}
      {/* Top-aligned (no justify-center) so answers start at the same y on
          every slide instead of floating with the leftover space. */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-3 min-w-0">

        {/* MCQ / multi-select / T-F / Poll / Case — coloured option tiles */}
        {(question.type === 'mcq' || question.type === 'multiselect' || question.type === 'truefalse' || question.type === 'poll' || question.type === 'case') && opts.length > 0 && (
          <>
            {/* Always mounted with a fixed height: marking a correct answer
                flips the colors in place — the option grid never moves. */}
            {needsAnswer && (
              <div
                className="flex-shrink-0 flex items-center gap-2 rounded-[10px] px-3 text-xs font-medium overflow-hidden"
                style={{
                  height: 38,
                  background: answerMarked ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${answerMarked ? '#BBF7D0' : '#FDE68A'}`,
                  color: answerMarked ? '#166534' : '#92400E',
                  transition: 'background-color .18s ease, border-color .18s ease, color .18s ease',
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: answerMarked ? '#22C55E' : '#F59E0B', color: '#fff', transition: 'background-color .18s ease' }}
                >
                  {answerMarked ? '✓' : '!'}
                </span>
                <span className="truncate">
                  {answerMarked
                    ? (question.type === 'multiselect'
                        ? `${(question.correctAnswers ?? []).length} correct marked`
                        : 'Correct answer set')
                    : (question.type === 'multiselect'
                        ? 'Mark every correct option below.'
                        : 'Mark the correct answer with the check button.')}
                </span>
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
                    className="relative overflow-hidden rounded-xl min-h-[clamp(72px,12vh,96px)] flex"
                    style={{
                      background: c.hex,
                      boxShadow: isCorrect
                        ? `0 0 0 3px #FDE047, 0 2px 0 ${c.hexDark}`
                        : `0 2px 0 ${c.hexDark}`,
                      transition: 'box-shadow .18s ease',
                    }}
                  >
                    <CharCount value={optText} limit={OPTION_CHAR_LIMIT} />
                    <div className="flex items-stretch gap-3 px-3 py-2 w-full">
                      {/* Correct-answer toggle — poll/case have no correct
                          answer, so they get a plain letter chip instead of a
                          button that would silently do nothing. */}
                      {needsCorrectAnswer(question.type) ? (
                        <button
                          type="button"
                          onClick={() => handleCorrectToggle(i)}
                          className="self-center w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 transition-all hover:scale-110"
                          style={{ background: 'rgba(255,255,255,0.25)', border: isCorrect ? '2px solid #FDE047' : '2px solid transparent' }}
                          title="Mark correct"
                        >
                          {isCorrect ? '✓' : c.letter}
                        </button>
                      ) : (
                        <span
                          className="self-center w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.25)' }}
                        >
                          {c.letter}
                        </span>
                      )}
                      {/* Option text — the hover/focus cue lives on this full-height
                          wrapper so the whole area reads (and works) as a text field,
                          while the textarea inside stays vertically centered. */}
                      <div
                        onClick={e => e.currentTarget.querySelector('textarea')?.focus()}
                        className={`flex-1 min-w-0 self-stretch flex items-center rounded-lg border border-transparent px-2 py-1.5 ${
                          question.type === 'truefalse'
                            ? ''
                            : 'cursor-text transition-[background-color,border-color] duration-150 hover:border-white/45 hover:bg-white/[0.14] focus-within:border-white/45 focus-within:bg-white/[0.14]'
                        }`}
                      >
                        <AutoGrowTextarea
                          value={optText}
                          onChange={e => handleOptionChange(i, e.target.value.replace(/\n/g, ''))}
                          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                          placeholder={`Option ${c.letter}`}
                          disabled={question.type === 'truefalse'}
                          maxLength={100}
                          wrapperClassName="w-full min-w-0"
                          className="w-full text-sm font-bold bg-transparent outline-none border-0 text-white placeholder:text-white/60 disabled:opacity-70 resize-none leading-snug cursor-text"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                        />
                      </div>
                      {/* Remove option button (not for truefalse, min 2 options) */}
                      {question.type !== 'truefalse' && opts.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="self-center text-white/50 hover:text-white transition-colors text-lg leading-none flex-shrink-0"
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
            <div className="rounded-xl p-5 text-center" style={{ border: '1px dashed #D3D7DD' }}>
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

        {/* Fill-in-the-blank — accepted answers */}
        {question.type === 'fillblank' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: '#0D9488' }}>
              Accepted answers <span className="font-normal text-gray-400">— matching is case-insensitive. Add spelling variants to accept them all.</span>
            </p>
            {blankAnswers.map((ans, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: '#F0FDFA', border: '1px solid #99F6E4' }}>
                <span className="text-sm flex-shrink-0" style={{ color: '#0D9488' }}>✓</span>
                <input
                  type="text"
                  value={ans}
                  onChange={e => handleBlankChange(i, e.target.value)}
                  placeholder={i === 0 ? 'Correct answer' : 'Also accept…'}
                  maxLength={120}
                  className="flex-1 text-sm font-medium bg-transparent outline-none border-0"
                  style={{ color: '#134E4A' }}
                />
                {blankAnswers.length > 1 && (
                  <button type="button" onClick={() => handleBlankRemove(i)} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                    &times;
                  </button>
                )}
              </div>
            ))}
            {blankAnswers.length < 6 && (
              <button
                type="button"
                onClick={handleBlankAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#F9FAFB', color: '#374151', border: '1px dashed #D3D7DD' }}
              >
                <span className="text-sm leading-none">+</span> Add accepted answer
              </button>
            )}
            <p className="text-[11px] text-gray-400">Tip: write <code className="px-1 rounded bg-gray-100">_____</code> in your question where the blank goes.</p>
          </div>
        )}

        {/* Matching — left ↔ right pairs */}
        {question.type === 'matching' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: '#DB2777' }}>
              Matching pairs <span className="font-normal text-gray-400">— the right column is shuffled for participants.</span>
            </p>
            {matchPairs.map((pair, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.left}
                  onChange={e => handlePairChange(i, 'left', e.target.value)}
                  placeholder={`Item ${i + 1}`}
                  maxLength={100}
                  className="flex-1 min-w-0 text-sm font-medium rounded-lg px-3 py-2 outline-none"
                  style={{ background: '#FDF2F8', border: '1px solid #FBCFE8', color: '#831843' }}
                />
                <span className="flex-shrink-0 text-gray-300 font-bold">↔</span>
                <input
                  type="text"
                  value={pair.right}
                  onChange={e => handlePairChange(i, 'right', e.target.value)}
                  placeholder={`Match ${i + 1}`}
                  maxLength={100}
                  className="flex-1 min-w-0 text-sm font-medium rounded-lg px-3 py-2 outline-none"
                  style={{ background: '#FDF2F8', border: '1px solid #FBCFE8', color: '#831843' }}
                />
                {matchPairs.length > 2 && (
                  <button type="button" onClick={() => handlePairRemove(i)} className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                    &times;
                  </button>
                )}
              </div>
            ))}
            {matchPairs.length < 8 && (
              <button
                type="button"
                onClick={handlePairAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#F9FAFB', color: '#374151', border: '1px dashed #D3D7DD' }}
              >
                <span className="text-sm leading-none">+</span> Add pair
              </button>
            )}
          </div>
        )}

        {/* Add option + AI options row */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {showAddOption && (
            <button
              type="button"
              onClick={handleAddOption}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#F9FAFB', color: '#374151', border: '1px dashed #D3D7DD' }}
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
        <div className="flex-shrink-0 border-t px-4 py-2 flex justify-end rounded-b-2xl" style={{ borderColor: '#F3F4F6' }}>
          <span className="text-[9px] font-bold opacity-30" style={{ color: '#0F1B3D' }}>quizotic.live</span>
        </div>
      )}
    </div>
  )
}
