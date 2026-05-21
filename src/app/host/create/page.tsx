'use client'

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveQuiz, loadQuizzes, setActiveSession } from '@/lib/quiz-storage'
import { draftKey, readDraft, writeDraft, clearDraft, formatDraftAge } from '@/lib/draft-storage'
import { useAutosave } from '@/lib/use-autosave'
import type { Question, QuestionType, BloomsLevel, Quiz, QuestionOption } from '@/lib/quiz-types'
import { getOptionText, getOptionImage, isScoredType, isSequenceRanking } from '@/lib/quiz-types'
import { ImageUpload } from '@/components/ImageUpload'
import { QuizThemePicker } from '@/components/host/QuizThemePicker'
import { getQuizTheme, type QuizThemeId } from '@/lib/quiz-themes'
import { formatQuizValidationIssues, hasQuizValidationErrors, validateQuizQuestions } from '@/lib/quiz-validation'
import QRCode from 'react-qr-code'
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

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc' | 'library' | 'csv'

const TIMER_OPTIONS: (10 | 15 | 20 | 30 | 60)[] = [10, 15, 20, 30, 60]
const POINTS_OPTIONS: (500 | 1000 | 2000)[] = [500, 1000, 2000]

const QUESTION_COUNT_OPTIONS: Record<string, number[]> = {
  free: [5, 8, 10],
  pro: [5, 10, 15, 20, 25],
}

type AudiencePresetId = 'classroom' | 'coaching' | 'corporate' | 'event'

interface AudiencePreset {
  id: AudiencePresetId
  label: string
  note: string
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
  difficulty: 'easy' | 'medium' | 'hard'
  selfPacedTimeLimitMinutes: number | null
  allowRetries: boolean
}

const AUDIENCE_PRESETS: AudiencePreset[] = [
  {
    id: 'classroom',
    label: 'Classroom',
    note: 'Readable pace for live teaching',
    timerSeconds: 20,
    points: 1000,
    difficulty: 'medium',
    selfPacedTimeLimitMinutes: null,
    allowRetries: false,
  },
  {
    id: 'coaching',
    label: 'Coaching test',
    note: 'Assessment pace with fewer repeats',
    timerSeconds: 30,
    points: 2000,
    difficulty: 'hard',
    selfPacedTimeLimitMinutes: 60,
    allowRetries: false,
  },
  {
    id: 'corporate',
    label: 'Corporate training',
    note: 'Calm timing with retakes',
    timerSeconds: 30,
    points: 1000,
    difficulty: 'medium',
    selfPacedTimeLimitMinutes: 45,
    allowRetries: true,
  },
  {
    id: 'event',
    label: 'Event pulse',
    note: 'Fast, lightweight engagement',
    timerSeconds: 15,
    points: 500,
    difficulty: 'easy',
    selfPacedTimeLimitMinutes: null,
    allowRetries: true,
  },
]

interface TypeMix {
  mcq: number
  multiselect: number
  truefalse: number
  poll: number
  openended: number
  wordcloud: number
  qa: number
  rating: number
  ranking: number
  case: number
}

const TYPE_MIX_LABELS: { key: keyof TypeMix; label: string; color: string; bg: string }[] = [
  { key: 'mcq', label: 'MCQ', color: '#2563EB', bg: '#EFF6FF' },
  { key: 'multiselect', label: 'Multi-select', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'truefalse', label: 'True / False', color: '#16A34A', bg: '#F0FDF4' },
  { key: 'poll', label: 'Poll', color: '#0F1B3D', bg: '#F3F4F6' },
  { key: 'openended', label: 'Open-ended', color: '#D97706', bg: '#FFFBEB' },
  { key: 'wordcloud', label: 'Word Cloud', color: '#FF8A47', bg: '#FFF7ED' },
  { key: 'qa', label: 'Q&A', color: '#0891B2', bg: '#ECFEFF' },
  { key: 'rating', label: 'Rating', color: '#EA580C', bg: '#FFF7ED' },
  { key: 'ranking', label: 'Ranking', color: '#4F46E5', bg: '#EEF2FF' },
  { key: 'case', label: 'Scenario', color: '#DC2626', bg: '#FFF1F2' },
]

const TYPE_PILLS: { value: QuestionType; label: string; color: string; bg: string; svg: React.ReactNode; tooltip: string }[] = [
  {
    value: 'mcq', label: 'MCQ', color: '#2563EB', bg: '#EFF6FF', tooltip: 'Classic quiz format — 2-4 options, one correct answer.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="3" width="14" height="14" rx="3" fill="#2563EB" fillOpacity="0.15" stroke="#2563EB" strokeWidth="1.5"/>
        <path d="M7 10l2.5 2.5L13 7.5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'multiselect', label: 'Multi-select', color: '#7C3AED', bg: '#F5F3FF', tooltip: 'Choose one or more correct answers.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="4" width="4" height="4" rx="1" fill="#7C3AED" fillOpacity="0.2" stroke="#7C3AED" strokeWidth="1.4"/>
        <rect x="3" y="12" width="4" height="4" rx="1" fill="#7C3AED" fillOpacity="0.2" stroke="#7C3AED" strokeWidth="1.4"/>
        <path d="M9 6h7M9 14h7" stroke="#7C3AED" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M4 6l1 1 1.5-2" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'truefalse', label: 'True/False', color: '#16A34A', bg: '#F0FDF4', tooltip: 'Simple binary choice.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <circle cx="10" cy="10" r="7.5" fill="#16A34A" fillOpacity="0.15" stroke="#16A34A" strokeWidth="1.5"/>
        <path d="M7 10l2 2 4-4" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'poll', label: 'Poll', color: '#0F1B3D', bg: '#F3F4F6', tooltip: 'Gather opinions — no right or wrong answer.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="12" width="3.5" height="5" rx="1" fill="#0F1B3D" fillOpacity="0.8"/>
        <rect x="8.25" y="8" width="3.5" height="9" rx="1" fill="#0F1B3D"/>
        <rect x="13.5" y="5" width="3.5" height="12" rx="1" fill="#0F1B3D" fillOpacity="0.5"/>
      </svg>
    ),
  },
  {
    value: 'openended', label: 'Open-ended', color: '#D97706', bg: '#FFFBEB', tooltip: 'Free-text responses.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M4 6h12M4 10h8M4 14h6" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 12l1.5 1.5L14 17l-1.5-1.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'wordcloud', label: 'Word Cloud', color: '#FF8A47', bg: '#FFF7ED', tooltip: 'Participants submit words forming a live cloud.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <ellipse cx="8" cy="11" rx="5" ry="3.5" fill="#FF8A47" fillOpacity="0.2" stroke="#FF8A47" strokeWidth="1.3"/>
        <ellipse cx="13" cy="9" rx="4" ry="2.8" fill="#FF8A47" fillOpacity="0.2" stroke="#FF8A47" strokeWidth="1.3"/>
        <ellipse cx="10" cy="7" rx="3.5" ry="2.5" fill="#FF8A47" fillOpacity="0.3" stroke="#FF8A47" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    value: 'qa', label: 'Q&A', color: '#0891B2', bg: '#ECFEFF', tooltip: 'Open Q&A — participants ask questions.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H8l-3 3v-3H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="#0891B2" fillOpacity="0.15" stroke="#0891B2" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 8.5a2 2 0 014 0c0 1-1 1.5-2 2v1" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="13.5" r="0.75" fill="#0891B2"/>
      </svg>
    ),
  },
  {
    value: 'rating', label: 'Rating', color: '#EA580C', bg: '#FFF7ED', tooltip: 'Star rating (1-5). Collect satisfaction scores.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M10 3l1.8 3.6 4 .6-2.9 2.8.7 4L10 12l-3.6 1.9.7-4L4.2 7.2l4-.6z" fill="#EA580C" fillOpacity="0.8" stroke="#EA580C" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'ranking', label: 'Ranking', color: '#4F46E5', bg: '#EEF2FF', tooltip: 'Drag-to-rank items in order.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="4" width="14" height="3" rx="1.5" fill="#4F46E5"/>
        <rect x="3" y="8.5" width="10" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.65"/>
        <rect x="3" y="13" width="7" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.35"/>
      </svg>
    ),
  },
  {
    value: 'case', label: 'Scenario', color: '#DC2626', bg: '#FFF1F2', tooltip: 'Present a real-world scenario with context.',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="4" y="3" width="12" height="14" rx="2" fill="#DC2626" fillOpacity="0.12" stroke="#DC2626" strokeWidth="1.5"/>
        <path d="M7 7.5h6M7 10.5h6M7 13.5h4" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const TOPIC_SUGGESTIONS = [
  'Indian History', 'Science & Space', 'Sports', 'General Knowledge',
  'Current Affairs', 'Technology', 'Geography', 'Bollywood',
]

const GLOBAL_LANGUAGES: { lang: string }[] = [
  { lang: 'English' }, { lang: 'Arabic' }, { lang: 'Bahasa' }, { lang: 'Bengali' },
  { lang: 'Filipino' }, { lang: 'French' }, { lang: 'German' }, { lang: 'Hindi' },
  { lang: 'Japanese' }, { lang: 'Korean' }, { lang: 'Mandarin' }, { lang: 'Marathi' },
  { lang: 'Portuguese' }, { lang: 'Russian' }, { lang: 'Spanish' }, { lang: 'Swahili' },
  { lang: 'Tamil' }, { lang: 'Telugu' }, { lang: 'Turkish' },
]

// ── Answer card colors — sourced from the canonical Kahoot palette ────────
// All answer-tile renderers (host builder, live view, participant, presentation)
// share src/lib/answer-colors.ts so tweaks propagate in one place.
import { ANSWER_COLORS } from '@/lib/answer-colors'

// ── Helpers ─────────────────────────────────────────────────────────────────────

function makeQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: undefined,
    timerSeconds: 20,
    points: 1000,
  }
}

function optionsForType(type: QuestionType): string[] | undefined {
  if (type === 'truefalse') return ['True', 'False']
  if (type === 'mcq') return ['', '', '', '']
  if (type === 'multiselect') return ['', '', '', '']
  if (type === 'rating') return ['1', '2', '3', '4', '5']
  if (type === 'case') return ['', '', '', '']
  if (type === 'poll') return ['', '', '', '']
  if (type === 'ranking') return ['', '', '']
  return undefined
}

function hasCorrectAnswer(type: QuestionType, question?: Question): boolean {
  if (type === 'mcq' || type === 'truefalse') return !!question?.correctAnswer
  if (type === 'multiselect') return (question?.correctAnswers?.length ?? 0) > 0
  if (type === 'ranking' && question?.correctOrder && question.correctOrder.length > 0) return true
  return false
}

function needsCorrectAnswer(type: QuestionType): boolean {
  return type === 'mcq' || type === 'truefalse' || type === 'multiselect'
}

// Picks a responsive Tailwind text size based on question length so long
// questions don't overflow the preview card / live-session header.
function questionTextSizeClass(text: string): string {
  const len = text.length
  if (len > 240) return 'text-base md:text-lg'
  if (len > 180) return 'text-lg md:text-xl'
  if (len > 120) return 'text-xl md:text-2xl'
  if (len > 70) return 'text-xl md:text-3xl'
  return 'text-2xl md:text-4xl'
}

function getTypePill(type: QuestionType) {
  return TYPE_PILLS.find(t => t.value === type) ?? TYPE_PILLS[0]
}

// ─── Sortable Ranking Option (for drag-to-sort in builder) ────────────────────

interface SortableRankingItemProps {
  id: string
  index: number
  text: string
  isOrdinal: boolean
}

function SortableRankingItem({ id, index, text, isOrdinal }: SortableRankingItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
  const badge = isOrdinal ? ordinals[index] || `${index + 1}th` : (index + 1).toString()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: '#4F46E5', color: '#fff' }}>
        {badge}
      </span>
      <span className="flex-1 text-sm font-medium" style={{ color: '#374151' }}>
        {text || '(empty)'}
      </span>
      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 19h8M8 5h8M5 10h14M5 14h14" />
      </svg>
    </div>
  )
}

// ─── Autosave Badge ──────────────────────────────────────────────────────────

function AutosaveBadge({ state }: { state: { status: 'idle' | 'saving' | 'saved' | 'error'; lastSavedAt: number | null } }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (state.status !== 'saved' || !state.lastSavedAt) return
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [state.status, state.lastSavedAt])

  if (state.status === 'idle') return null

  const base = 'hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md'
  if (state.status === 'saving') {
    return (
      <span className={base} style={{ background: '#FEF3C7', color: '#92400E' }}>
        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        Saving…
      </span>
    )
  }
  if (state.status === 'error') {
    return (
      <span className={base} title="We'll retry automatically" style={{ background: '#FEE2E2', color: '#991B1B' }}>
        Couldn&apos;t save — retrying
      </span>
    )
  }
  // saved
  const secs = state.lastSavedAt ? Math.max(1, Math.round((now - state.lastSavedAt) / 1000)) : 0
  const label = secs < 60 ? `Saved ${secs}s ago` : `Saved ${Math.round(secs / 60)}m ago`
  return (
    <span className={base} style={{ background: '#DCFCE7', color: '#14532D' }}>
      {label}
    </span>
  )
}

// ─── Visual Preview Card (Center Panel) ────────────────────────────────────────

function QuestionPreview({
  question,
  index,
  total,
  onChange,
  plan,
}: {
  question: Question
  index: number
  total: number
  onChange: (q: Question) => void
  plan: 'free' | 'pro'
}) {
  const pill = getTypePill(question.type)
  const opts = question.options ?? []
  const rankingSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleOptionChange(i: number, value: string) {
    const options = [...(question.options ?? [])]
    const existing = options[i]
    const existingImage = getOptionImage(existing ?? '')
    options[i] = existingImage ? { text: value, imageUrl: existingImage } : value
    onChange({ ...question, options })
  }

  function handleAddOption() {
    const options = [...(question.options ?? []), '']
    onChange({ ...question, options })
  }

  function handleRemoveOption(i: number) {
    const options = question.options?.filter((_, idx) => idx !== i) ?? []
    onChange({ ...question, options })
  }

  return (
    <div className="w-full max-w-[1280px] rounded-2xl overflow-hidden h-full max-h-full flex flex-col" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.10)' }}>
      {/* Header — inline-editable question text */}
      <div className="flex-shrink-0 px-6 md:px-10 py-4 md:py-5 text-center" style={{ background: '#FAFAF8', borderBottom: '1px solid #EDE8E0' }}>
        <p className="text-xs md:text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
          Question {index + 1} of {total}
        </p>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder="Type your question here..."
          rows={question.text.length > 140 ? 4 : question.text.length > 60 ? 3 : 2}
          maxLength={300}
          className={`w-full font-extrabold leading-snug text-center bg-transparent outline-none resize-none border-0 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all ${questionTextSizeClass(question.text)}`}
          style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}
        />
      </div>

      {/* Image area */}
      {question.imageUrl && (
        <div className="w-full flex-shrink-0 flex items-center justify-center" style={{ background: '#F0EDE8', height: 'clamp(120px, 22vh, 240px)' }}>
          <img src={question.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Options — inline-editable with bar visualization */}
      <div className="bg-white p-4 md:p-5 flex-1 min-h-0 overflow-y-auto">
        {(question.type === 'mcq' || question.type === 'multiselect' || question.type === 'truefalse' || question.type === 'poll' || question.type === 'case') && opts.length > 0 && (
          <div>
            {needsCorrectAnswer(question.type) && (
              <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black" style={{ background: '#F59E0B', color: '#fff' }}>!</span>
                <p className="text-xs font-bold">
                  {question.type === 'multiselect'
                    ? 'Mark every correct option using the check buttons.'
                    : 'Mark the one correct answer using the check button.'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
            {opts.map((opt, i) => {
              const c = ANSWER_COLORS[i] ?? ANSWER_COLORS[0]
              const isCorrect = question.type === 'multiselect'
                ? (question.correctAnswers ?? []).includes(String(i))
                : question.correctAnswer === String(i) && hasCorrectAnswer(question.type, question)
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-xl transition-all"
                  style={{
                    background: c.hex,
                    boxShadow: isCorrect
                      ? `0 0 0 3px #FDE047, 0 2px 0 ${c.hexDark}, 0 0 16px rgba(253,224,71,0.5)`
                      : `0 2px 0 ${c.hexDark}`,
                  }}
                >
                  <div className="relative flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (question.type === 'multiselect') {
                          const current = new Set(question.correctAnswers ?? [])
                          if (current.has(String(i))) current.delete(String(i))
                          else current.add(String(i))
                          onChange({ ...question, correctAnswer: undefined, correctAnswers: Array.from(current).sort() })
                        } else if (needsCorrectAnswer(question.type)) {
                          onChange({ ...question, correctAnswer: String(i) })
                        }
                      }}
                      className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 transition-all hover:scale-110 click-bounce-sm"
                      style={{ background: 'rgba(255,255,255,0.25)', border: isCorrect ? '2px solid #FDE047' : '2px solid transparent' }}
                      title={needsCorrectAnswer(question.type) ? 'Click to mark correct' : undefined}
                    >
                      {isCorrect ? <span className="text-base">&#10003;</span> : c.letter}
                    </button>
                    <textarea
                      value={getOptionText(opt)}
                      onChange={e => handleOptionChange(i, e.target.value.replace(/\n/g, ''))}
                      onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                      placeholder={`Option ${c.letter}`}
                      disabled={question.type === 'truefalse'}
                      rows={1}
                      maxLength={150}
                      className="flex-1 min-h-[44px] text-lg md:text-2xl font-black bg-transparent outline-none border-0 text-white placeholder:text-white/60 disabled:opacity-70 resize-none overflow-hidden"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                    />
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )}

        {question.type === 'rating' && (
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className="text-3xl" style={{ color: '#EA580C' }}>&#9733;</span>
            ))}
          </div>
        )}

        {question.type === 'ranking' && opts.length > 0 && (
          <div className="space-y-4 py-2">
            {/* Correct Sequence toggle */}
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <input
                type="checkbox"
                id="correct-seq-toggle"
                checked={isSequenceRanking(question)}
                onChange={e => {
                  if (e.target.checked) {
                    onChange({ ...question, correctOrder: opts.map((_, i) => String(i)) })
                  } else {
                    onChange({ ...question, correctOrder: undefined })
                  }
                }}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="correct-seq-toggle" className="flex-1 text-xs font-semibold cursor-pointer" style={{ color: '#15803D' }}>
                Correct Sequence (scored)
              </label>
            </div>

            {/* Items list with add/remove buttons */}
            <div className="space-y-2">
              {isSequenceRanking(question) ? (
                <DndContext
                  sensors={rankingSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event
                    if (over && active.id !== over.id) {
                      const oldIndex = opts.findIndex((_, i) => String(i) === active.id)
                      const newIndex = opts.findIndex((_, i) => String(i) === over.id)
                      const reorderedOpts = arrayMove(opts, oldIndex, newIndex)
                      onChange({ ...question, options: reorderedOpts, correctOrder: reorderedOpts.map((_, i) => String(i)) })
                    }
                  }}
                >
                  <SortableContext items={opts.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                    {opts.map((opt, i) => (
                      <SortableRankingItem
                        key={i}
                        id={String(i)}
                        index={i}
                        text={getOptionText(opt)}
                        isOrdinal={true}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                opts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: '#4F46E5', color: '#fff' }}>{i + 1}</span>
                    <input
                      type="text"
                      value={getOptionText(opt)}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      placeholder={`Item ${i + 1}`}
                      className="flex-1 text-sm font-medium bg-transparent outline-none border-0"
                      style={{ color: '#374151' }}
                    />
                    {opts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove item"
                      >
                        <span className="text-lg leading-none">×</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add/Remove buttons */}
            <div className="flex gap-2 pt-1">
              {opts.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#F3F4F6', color: '#0F1B3D', border: '1px dashed #D1D5DB' }}
                >
                  + Add item
                </button>
              )}
            </div>

            {/* Info text for correct sequence mode */}
            {isSequenceRanking(question) && (
              <p className="text-[10px]" style={{ color: '#64748B' }}>
                Drag items to set correct order. Participants will see these jumbled.
              </p>
            )}
          </div>
        )}

        {question.type === 'wordcloud' && (
          <div className="py-6 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 px-8">
            {['Ideas', 'Creativity', 'Team', 'Growth', 'Vision', 'Focus', 'Innovation', 'Energy'].map((w, i) => (
              <span key={i} className="font-bold" style={{
                color: '#9CA3AF',
                fontSize: [22, 15, 26, 13, 19, 11, 17, 12][i],
              }}>{w}</span>
            ))}
          </div>
        )}

        {question.type === 'openended' && (
          <div className="py-4 px-6">
            <div className="rounded-xl p-4 text-center" style={{ border: '1.5px dashed #D1D5DB' }}>
              <span className="text-sm text-gray-300">Audience responses will appear here...</span>
            </div>
          </div>
        )}

        {question.type === 'qa' && (
          <div className="py-4 px-6 space-y-1.5">
            {['How does this work?', 'Can you explain more?', 'What about...'].map((q, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50">
                <span className="text-[10px] font-bold text-gray-300">Q</span>
                <span className="text-xs text-gray-300">{q}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#F1F5F9', color: '#64748B' }}>
          &#9201; {question.timerSeconds}s
        </div>
        {plan === 'free' && (
          <span className="text-[9px] font-bold opacity-40" style={{ color: '#0F1B3D' }}>quizotic.live</span>
        )}
        {question.bloomsLevel && (
          <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide" style={{ background: '#EEF2FF', color: '#6366F1' }}>
            {question.bloomsLevel}
          </div>
        )}
        <div className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#0F1B3D', color: '#F5E642' }}>
          {question.points} pts
        </div>
      </div>
    </div>
  )
}

// ─── Question Editor (Right Panel) ─────────────────────────────────────────────

function QuestionEditor({
  question,
  onChange,
  onDelete,
  onDuplicate,
}: {
  question: Question
  onChange: (q: Question) => void
  onDelete: () => void
  onDuplicate: () => void
}) {


  function handleTypeChange(type: QuestionType) {
    const options = optionsForType(type)
    onChange({
      ...question,
      type,
      options,
      correctAnswer: undefined,
      correctAnswers: type === 'multiselect' ? [] : undefined,
    })
  }

  function handleOptionChange(i: number, value: string) {
    const options = [...(question.options ?? [])]
    const existing = options[i]
    const existingImage = getOptionImage(existing ?? '')
    options[i] = existingImage ? { text: value, imageUrl: existingImage } : value
    onChange({ ...question, options })
  }

  function handleOptionImageUpload(i: number, imageUrl: string) {
    const options = [...(question.options ?? [])]
    const text = getOptionText(options[i] ?? '')
    options[i] = { text, imageUrl }
    onChange({ ...question, options })
  }

  function handleOptionImageRemove(i: number) {
    const options = [...(question.options ?? [])]
    const text = getOptionText(options[i] ?? '')
    options[i] = text
    onChange({ ...question, options })
  }

  function handleAddOption() {
    const options = [...(question.options ?? []), '']
    onChange({ ...question, options })
  }

  function handleRemoveOption(i: number) {
    const options = question.options?.filter((_, idx) => idx !== i) ?? []
    const correctAnswers = question.correctAnswers
      ?.filter(answer => answer !== String(i))
      .map(answer => {
        const n = Number(answer)
        return Number.isInteger(n) && n > i ? String(n - 1) : answer
      })
    const correctAnswer = question.correctAnswer === String(i)
      ? undefined
      : Number.isInteger(Number(question.correctAnswer)) && Number(question.correctAnswer) > i
        ? String(Number(question.correctAnswer) - 1)
        : question.correctAnswer
    onChange({ ...question, options, correctAnswer, correctAnswers })
  }

  return (
    <div className="space-y-5">
      {/* Actions row */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onDuplicate} className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-gray-50">Duplicate</button>
        <button onClick={onDelete} className="text-xs text-gray-500 hover:text-red-500 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-red-50">Remove</button>
      </div>

      {/* Question Type — Change type of this question */}
      <div className="rounded-xl p-2.5" style={{ background: '#F8F9FA', border: '1px solid #E2E8F0' }}>
        <label className="text-[9px] font-black uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#94A3B8' }}>
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3"><path d="M2 8h9M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Change Type
        </label>
        <div className="flex flex-wrap gap-1">
          {TYPE_PILLS.map(t => {
            const active = question.type === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                title={t.tooltip}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all"
                style={
                  active
                    ? { border: `1.5px solid ${t.color}`, background: t.bg, color: t.color }
                    : { border: '1.5px solid transparent', background: '#fff', color: '#94A3B8' }
                }
              >
                <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{t.svg}</span>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scenario fields */}
      {question.type === 'case' && (
        <div className="space-y-2.5 rounded-lg p-3" style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#0F1B3D' }}>Scenario Block</p>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Scenario Narrative</label>
            <textarea
              value={question.scenarioText ?? ''}
              onChange={e => onChange({ ...question, scenarioText: e.target.value || undefined })}
              placeholder="Describe the situation..."
              rows={3}
              maxLength={600}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Supporting Detail (optional)</label>
            <input
              type="text"
              value={question.supportingDetail ?? ''}
              onChange={e => onChange({ ...question, supportingDetail: e.target.value || undefined })}
              placeholder="e.g., '72% of employees face this...'"
              maxLength={200}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      )}

      {/* Quality checklist — at-a-glance readiness. Read-only, derived from
          question fields. Helps creators see what's missing before going live. */}
      {(() => {
        const hasAnswer = needsCorrectAnswer(question.type) ? hasCorrectAnswer(question.type, question) : true
        const hasExplanation = !!(question.explanation && question.explanation.trim().length > 0)
        const hasBloom = !!(question.bloomsLevel && question.bloomsLevel.length > 0)
        const hasReasonableTimer = question.timerSeconds >= 10 && question.timerSeconds <= 60
        const hasImage = !!question.imageUrl
        const checklist = [
          { ok: hasAnswer, label: needsCorrectAnswer(question.type) ? (question.type === 'multiselect' ? 'Has correct options selected' : 'Has a correct answer') : 'No correct answer needed (interactive)' },
          { ok: hasExplanation, label: question.type === 'case' ? 'Debrief written' : 'Explanation written' },
          { ok: hasBloom, label: 'Learning goal set' },
          { ok: hasReasonableTimer, label: `Timer is set (${question.timerSeconds}s)` },
        ]
        const okCount = checklist.filter(c => c.ok).length
        return (
          <div className="rounded-lg p-3" style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-line)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Quality checklist</p>
              <span className="text-[10px] font-bold" style={{ color: okCount === checklist.length ? 'var(--color-accent-green)' : 'var(--color-text-muted)' }}>
                {okCount} / {checklist.length}
              </span>
            </div>
            {checklist.map((c, i) => (
              <div key={i} className={`q-check-row ${c.ok ? 'ok' : 'open'}`}>
                <span className="q-check-ring">
                  {c.ok ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="12" cy="12" r="10"/></svg>
                  )}
                </span>
                <span>{c.label}</span>
              </div>
            ))}
            <div className={`q-check-row ${hasImage ? 'ok' : 'open'}`} style={{ opacity: 0.7 }}>
              <span className="q-check-ring">
                {hasImage ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><circle cx="12" cy="12" r="10"/></svg>
                )}
              </span>
              <span>Image (optional)</span>
            </div>
          </div>
        )
      })()}

      {/* Inline editing hint */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#16A34A' }}>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p className="text-[10px] font-semibold" style={{ color: '#64748B' }}>Edit the question and answers directly on the preview.</p>
      </div>

      {/* Image */}
      <details className="insp-section">
        <summary>
          <span>Image</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </summary>
        <div id="q-image-upload-wrapper">
          <ImageUpload
            imageUrl={question.imageUrl}
            onUpload={url => onChange({ ...question, imageUrl: url })}
            onRemove={() => onChange({ ...question, imageUrl: undefined })}
            variant="question"
          />
        </div>
      </details>

      {/* Timing & scoring */}
      <details className="insp-section" open>
        <summary>
          <span>Timing &amp; scoring</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </summary>
        <div className="flex gap-3 pt-1">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Timer</label>
            <div className="flex gap-1 flex-wrap">
              {TIMER_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ ...question, timerSeconds: t })}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all"
                  style={
                    question.timerSeconds === t
                      ? { background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }
                      : { background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0' }
                  }
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              {isScoredType(question.type) ? 'Points' : 'Scoring'}
            </label>
            {isScoredType(question.type) ? (
              <div className="flex gap-1 flex-wrap">
                {POINTS_OPTIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChange({ ...question, points: p })}
                    className="px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all"
                    style={
                      question.points === p
                        ? { background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }
                        : { background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0' }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold"
                style={{ background: '#F3F4F6', color: '#475569', border: '1.5px solid #E2E8F0' }}
                title="Interactive question types are not scored. Participants earn no points — responses are collected for engagement and insight."
              >
                Participation only
              </span>
            )}
          </div>
        </div>
      </details>

      {/* Learning goal (Bloom) — promoted to first-class with rationale */}
      <details className="insp-section">
        <summary>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent-violet)' }} />
            Learning goal
          </span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </summary>
        <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
          What cognitive skill does this question test? Shows up in your Bloom&apos;s coverage report.
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            { value: '', label: 'None', color: '#94A3B8' },
            { value: 'remember', label: 'Remember', color: '#2563EB' },
            { value: 'understand', label: 'Understand', color: '#0891B2' },
            { value: 'apply', label: 'Apply', color: '#16A34A' },
            { value: 'analyse', label: 'Analyse', color: '#D97706' },
            { value: 'evaluate', label: 'Evaluate', color: '#DC2626' },
            { value: 'create', label: 'Create', color: '#7C3AED' },
          ].map(b => {
            const active = (question.bloomsLevel ?? '') === b.value
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => onChange({ ...question, bloomsLevel: (b.value as BloomsLevel) || undefined })}
                className="px-2 py-1 rounded-md text-[9px] font-bold transition-all"
                style={active
                  ? { background: b.color, color: '#fff', border: `1.5px solid ${b.color}` }
                  : { background: '#fff', color: b.color, border: `1.5px solid ${b.color}40` }
                }
              >
                {b.label}
              </button>
            )
          })}
        </div>
      </details>

      {/* Explanation */}
      <details className="insp-section">
        <summary>
          <span>{question.type === 'case' ? 'Debrief' : 'Explanation'}</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </summary>
        <p className="text-[10px] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Shown after participants answer.</p>
        <textarea
          value={question.explanation ?? ''}
          onChange={e => onChange({ ...question, explanation: e.target.value || undefined })}
          placeholder={question.type === 'case' ? 'Expert reasoning — what\'s the right call and why?' : 'Why is this the correct answer?'}
          rows={2}
          maxLength={500}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none hover:border-blue-300 hover:bg-white transition-colors cursor-text"
        />
      </details>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function CreateQuizPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [tab, setTab] = useState<Tab>('manual')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [theme, setThemeState] = useState<string | undefined>(undefined)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([makeQuestion()])
  const [saveError, setSaveError] = useState('')
  const [savedQuiz, setSavedQuiz] = useState<Quiz | null>(null)
  const [recoveredDraft, setRecoveredDraft] = useState<{ savedAt: number; quizId: string } | null>(null)
  const pendingLiveRef = useRef(false)
  // Stable id for the quiz being edited — used by autosave to write the draft key.
  // Pre-mint for new quizzes so the autosave hook has a key before the user hits Save.
  const quizIdRef = useRef<string>('')
  if (!quizIdRef.current) quizIdRef.current = editId || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `tmp-${Date.now()}`)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState<{ x: number; y: number } | null>(null)
  const [kebabMenuOpen, setKebabMenuOpen] = useState<{ x: number; y: number } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [selfPacedShare, setSelfPacedShare] = useState<{ open: boolean; loading: boolean; url: string; error: string; copied: boolean; questionCount: number; responseCount: number }>({
    open: false,
    loading: false,
    url: '',
    error: '',
    copied: false,
    questionCount: 0,
    responseCount: 0,
  })
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [mobileSlidesOpen, setMobileSlidesOpen] = useState(false)
  const [mobileAddOpen, setMobileAddOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [audiencePreset, setAudiencePreset] = useState<AudiencePresetId>('classroom')
  const activePreset = AUDIENCE_PRESETS.find(p => p.id === audiencePreset) ?? AUDIENCE_PRESETS[0]

  // Navigate to live session when savedQuiz is set after "Start Live"
  useEffect(() => {
    if (savedQuiz && pendingLiveRef.current) {
      pendingLiveRef.current = false
      setActiveSession(savedQuiz)
      router.push('/host/session')
    }
  }, [savedQuiz, router])

  // Plan state
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

  // AI usage / rate limit
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number; plan: string } | null>(null)
  const refreshAiUsage = useCallback(() => {
    fetch('/api/user/ai-usage').then(r => r.json()).then(d => {
      if (d.used !== undefined) setAiUsage({ used: d.used, limit: d.limit, plan: d.plan })
    }).catch(() => {})
  }, [])
  useEffect(() => { refreshAiUsage() }, [refreshAiUsage])
  const aiLimitReached = aiUsage !== null && aiUsage.used >= aiUsage.limit

  // Shared AI settings
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [typeMix, setTypeMix] = useState<TypeMix>({ mcq: 5, multiselect: 0, truefalse: 0, poll: 0, openended: 0, wordcloud: 0, qa: 0, rating: 0, ranking: 0, case: 0 })
  const [quizLanguage, setQuizLanguage] = useState('English')

  useEffect(() => {
    setTypeMix({ mcq: aiCount, multiselect: 0, truefalse: 0, poll: 0, openended: 0, wordcloud: 0, qa: 0, rating: 0, ranking: 0, case: 0 })
  }, [aiCount])

  // AI generation state
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGenError, setAiGenError] = useState('')
  // Surfaces non-error feedback after successful generation — currently
  // used to flag OCR-based extraction so the host knows the questions are
  // grounded in PDF imagery rather than embedded text and should be reviewed.
  const [aiGenNotice, setAiGenNotice] = useState('')
  const [translating, setTranslating] = useState(false)

  // Tab-specific inputs
  const [aiTopic, setAiTopic] = useState('')
  const [aiUrl, setAiUrl] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)

  // Generation tracking
  const [generatedOnTab, setGeneratedOnTab] = useState<Tab | null>(null)
  const [translatedTo, setTranslatedTo] = useState<string | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())

  // Library quizzes
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([])
  useEffect(() => {
    if (tab === 'library') setSavedQuizzes(loadQuizzes())
  }, [tab])

  // Title modal
  const [showTitleModal, setShowTitleModal] = useState(!editId)
  const [modalTitle, setModalTitle] = useState('')
  const [modalSubject, setModalSubject] = useState('')

  // Load existing quiz when editing — prefer newer draft, then localStorage, then DB
  useEffect(() => {
    if (!editId) return
    quizIdRef.current = editId
    const dk = draftKey('quiz', editId)
    const draft = readDraft<{ title: string; subject: string; questions: Question[] }>(dk)
    const saved = loadQuizzes().find(q => q.id === editId)
    if (draft && saved && draft.savedAt > new Date(saved.updatedAt).getTime()) {
      setTitle(draft.value.title)
      setSubject(draft.value.subject)
      setQuestions(draft.value.questions)
      setRecoveredDraft({ savedAt: draft.savedAt, quizId: editId })
      setShowTitleModal(false)
      return
    }
    if (saved) {
      setTitle(saved.title)
      setSubject(saved.subject ?? '')
      setThemeState(saved.theme)
      setQuestions(saved.questions)
      setShowTitleModal(false)
      return
    }
    // Not in this browser's localStorage — load authoritative copy from the DB
    fetch(`/api/quizzes/${editId}`)
      .then(r => r.json())
      .then((json: { success: boolean; data?: { title: string; subject?: string; theme?: string; updatedAt: string; questions: Question[] } }) => {
        if (!json.success || !json.data) return
        const q = json.data
        if (draft && draft.savedAt > new Date(q.updatedAt).getTime()) {
          setTitle(draft.value.title)
          setSubject(draft.value.subject)
          setQuestions(draft.value.questions)
          setRecoveredDraft({ savedAt: draft.savedAt, quizId: editId })
        } else {
          setTitle(q.title ?? '')
          setSubject(q.subject ?? '')
          setThemeState(q.theme ?? undefined)
          setQuestions(q.questions ?? [])
        }
        setShowTitleModal(false)
      })
      .catch(() => { /* silent — editor stays at title modal so user can re-enter */ })
  }, [editId])

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modalTitle.trim()) return
    setTitle(modalTitle.trim())
    if (modalSubject.trim()) setSubject(modalSubject.trim())
    setShowTitleModal(false)
  }

  // Drag-to-reorder ref
  const dragIndex = useRef<number | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const isAiTab = tab === 'aitopic' || tab === 'aiurl' || tab === 'aidoc'
  const settingsLocked = generatedOnTab !== null
  const typeMixSum = Object.values(typeMix).reduce((a, b) => a + b, 0)
  const typeMixValid = typeMixSum === aiCount
  const countOptions = QUESTION_COUNT_OPTIONS[plan] ?? QUESTION_COUNT_OPTIONS.free

  function handleTypeMixChange(key: keyof TypeMix, val: number) {
    setTypeMix(prev => ({ ...prev, [key]: val }))
  }

  function maxForType(key: keyof TypeMix): number {
    const remaining = aiCount - typeMixSum
    return typeMix[key] + Math.max(0, remaining)
  }

  function handleIncrement(key: keyof TypeMix) {
    if (typeMixSum >= aiCount) {
      // At cap — steal 1 from another type (MCQ first, then others in order)
      const stealOrder: (keyof TypeMix)[] = ['mcq', 'multiselect', 'truefalse', 'poll', 'openended', 'wordcloud', 'qa', 'rating', 'ranking', 'case']
      const donor = stealOrder.find(k => k !== key && typeMix[k] > 0)
      if (!donor) return
      setTypeMix(prev => ({ ...prev, [donor]: prev[donor] - 1, [key]: prev[key] + 1 }))
      return
    }
    setTypeMix(prev => ({ ...prev, [key]: prev[key] + 1 }))
  }

  function handleDecrement(key: keyof TypeMix) {
    if (typeMix[key] <= 0) return
    setTypeMix(prev => ({ ...prev, [key]: prev[key] - 1 }))
  }

  function handleAutoFill() {
    const remaining = aiCount - typeMixSum
    if (remaining <= 0) return
    const activeKeys = (Object.keys(typeMix) as (keyof TypeMix)[]).filter(k => typeMix[k] > 0)
    if (activeKeys.length === 0) {
      setTypeMix(prev => ({ ...prev, mcq: prev.mcq + remaining }))
    } else {
      const each = Math.floor(remaining / activeKeys.length)
      const extra = remaining % activeKeys.length
      setTypeMix(prev => {
        const next = { ...prev }
        activeKeys.forEach((k, i) => { next[k] += each + (i < extra ? 1 : 0) })
        return next
      })
    }
  }

  function applyAudiencePreset(preset: AudiencePreset) {
    setAudiencePreset(preset.id)
    setAiDifficulty(preset.difficulty)
    setQuestions(prev => prev.map(q => ({
      ...q,
      timerSeconds: preset.timerSeconds,
      points: isScoredType(q.type) ? preset.points : q.points,
    })))
  }

  // ── Question mutations ──────────────────────────────────────────────────────

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  function processCsvText(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { alert('The CSV file appears to be empty or has only a header row.'); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const qIdx = headers.findIndex(h => h === 'question')
    if (qIdx === -1) {
      alert('This file does not match the Quizotic template.\n\nPlease download the template, fill it in, and upload that file.\n\nRequired column: "question"')
      return
    }
    const aIdx = headers.findIndex(h => h === 'optiona' || h === 'option_a' || h === 'a')
    const bIdx = headers.findIndex(h => h === 'optionb' || h === 'option_b' || h === 'b')
    const cIdx = headers.findIndex(h => h === 'optionc' || h === 'option_c' || h === 'c')
    const dIdx = headers.findIndex(h => h === 'optiond' || h === 'option_d' || h === 'd')
    const correctIdx = headers.findIndex(h => h === 'correctanswer' || h === 'correct_answer' || h === 'correct' || h === 'answer')
    const timerIdx = headers.findIndex(h => h === 'timer' || h === 'time')
    const pointsIdx = headers.findIndex(h => h === 'points')
    const parsed: Question[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const questionText = cols[qIdx]
      if (!questionText) continue
      const options: string[] = []
      if (aIdx >= 0 && cols[aIdx]) options.push(cols[aIdx])
      if (bIdx >= 0 && cols[bIdx]) options.push(cols[bIdx])
      if (cIdx >= 0 && cols[cIdx]) options.push(cols[cIdx])
      if (dIdx >= 0 && cols[dIdx]) options.push(cols[dIdx])
      const correctLetter = correctIdx >= 0 ? cols[correctIdx]?.toUpperCase() : undefined
      const correctIndex = correctLetter ? ({ A: '0', B: '1', C: '2', D: '3' } as Record<string, string>)[correctLetter] : undefined
      const timer = timerIdx >= 0 ? parseInt(cols[timerIdx]) : 20
      const validTimer = [10, 15, 20, 30, 60].includes(timer) ? timer : 20
      const pts = pointsIdx >= 0 ? parseInt(cols[pointsIdx]) : 1000
      const validPts = [500, 1000, 2000].includes(pts) ? pts : 1000
      parsed.push({
        id: crypto.randomUUID(),
        type: options.length > 0 ? 'mcq' : 'openended',
        text: questionText,
        options: options.length > 0 ? options : undefined,
        correctAnswer: correctIndex,
        timerSeconds: validTimer as 10 | 15 | 20 | 30 | 60,
        points: validPts as 500 | 1000 | 2000,
      })
    }
    if (parsed.length === 0) { alert('No valid questions found in the CSV. Make sure rows have content in the "question" column.'); return }
    setQuestions(prev => [...prev, ...parsed])
    setTab('manual')
    setActiveIndex(0)
  }

  function addQuestion(type: QuestionType = 'mcq') {
    const opts = optionsForType(type)
    const base = makeQuestion()
    const newQ: Question = {
      ...base,
      type,
      options: opts,
      correctAnswer: undefined,
      correctAnswers: type === 'multiselect' ? [] : undefined,
    }
    setQuestions(prev => [...prev, newQ])
    setActiveIndex(questions.length)
  }

  function updateQuestion(index: number, q: Question) {
    setQuestions(prev => prev.map((item, i) => i === index ? q : item))
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
    if (activeIndex >= questions.length - 1) {
      setActiveIndex(Math.max(0, questions.length - 2))
    } else if (activeIndex > index) {
      setActiveIndex(activeIndex - 1)
    }
  }

  function duplicateQuestion(index: number) {
    const copy = { ...questions[index], id: crypto.randomUUID() }
    setQuestions(prev => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)])
    setActiveIndex(index + 1)
  }

  function moveQuestion(from: number, direction: 'up' | 'down') {
    const to = direction === 'up' ? from - 1 : from + 1
    if (to < 0 || to >= questions.length) return
    const reordered = [...questions]
    ;[reordered[from], reordered[to]] = [reordered[to], reordered[from]]
    setQuestions(reordered)
    setActiveIndex(to)
  }

  function applyGeneratedQuestions(raw: Question[], forTab: Tab): Question[] {
    const withIds = raw.map(q => {
      const base = { ...q, id: crypto.randomUUID() }
      // Backfill options for types where the AI legitimately omits them but the
      // live session UI needs them to render option cards (notably rating).
      if ((!base.options || base.options.length === 0)) {
        const defaults = optionsForType(base.type)
        if (defaults) return { ...base, options: defaults }
      }
      return base
    })
    setQuestions(withIds)
    setGeneratedOnTab(forTab)
    setSelectedQuestions(new Set(withIds.map(q => q.id)))
    setActiveIndex(0)
    setTab('manual')
    return withIds
  }

  function toggleSelect(id: string) {
    setSelectedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetGeneration() {
    setGeneratedOnTab(null)
    setSelectedQuestions(new Set())
    setTranslatedTo(null)
    setAiGenError('')
    setAiGenNotice('')
  }

  // ── Unified AI generate handler ─────────────────────────────────────────────

  async function handleGenerate() {
    setAiGenError('')
    setAiGenNotice('')

    if (tab === 'aitopic' && !aiTopic.trim()) { setAiGenError('Enter a topic first'); return }
    if (tab === 'aiurl' && !aiUrl.startsWith('https://')) { setAiGenError('URL must start with https://'); return }
    if (tab === 'aidoc' && !docFile) { setAiGenError('Select a file first'); return }

    if (!typeMixValid) { setAiGenError(`Type mix must add up to ${aiCount} (currently ${typeMixSum})`); return }

    if (generatedOnTab) resetGeneration()

    setAiGenerating(true)

    try {
      let res: Response

      if (tab === 'aidoc') {
        const formData = new FormData()
        formData.append('file', docFile!)
        formData.append('questionCount', String(aiCount))
        formData.append('difficulty', aiDifficulty)
        formData.append('typeMix', JSON.stringify(typeMix))
        res = await fetch('/api/generate-quiz', { method: 'POST', body: formData })
      } else {
        const body: Record<string, unknown> = {
          mode: tab === 'aitopic' ? 'topic' : 'url',
          questionCount: aiCount,
          difficulty: aiDifficulty,
          typeMix,
        }
        if (tab === 'aitopic') body.topic = aiTopic
        if (tab === 'aiurl') body.url = aiUrl

        res = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) { setAiGenError(data.error ?? 'Generation failed'); return }

      // Surface the extraction provenance so the host knows when a non-text
      // tier was used. OCR and vision both have failure modes (recognition
      // errors, diagram-as-text interpretations) so the questions deserve a
      // review pass before publishing.
      const extractionSource = res.headers.get('x-quizotic-extraction-source')
      const ocrPages = Number(res.headers.get('x-quizotic-ocr-pages') ?? 0)
      const visionPages = Number(res.headers.get('x-quizotic-vision-pages') ?? 0)
      if (extractionSource === 'vision') {
        setAiGenNotice(`Read this PDF using AI vision (${visionPages} page${visionPages === 1 ? '' : 's'}) — some content was interpreted from diagrams. Please review the questions before publishing.`)
      } else if (extractionSource === 'ocr') {
        setAiGenNotice(`Read this PDF using OCR (${ocrPages} page${ocrPages === 1 ? '' : 's'}) — please review the questions before publishing.`)
      } else {
        setAiGenNotice('')
      }

      const generated = applyGeneratedQuestions(data, tab)

      refreshAiUsage()

      if (quizLanguage !== 'English') {
        setTranslating(true)
        try {
          const tRes = await fetch('/api/translate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: generated, targetLanguage: quizLanguage }),
          })
          const tData = await tRes.json()
          if (tRes.ok) {
            setQuestions(tData)
            setTranslatedTo(quizLanguage)
            refreshAiUsage()
          }
        } catch { /* translation failed silently */ }
        finally { setTranslating(false) }
      }
    } catch {
      setAiGenError('Network error. Try again.')
    } finally {
      setAiGenerating(false)
    }
  }

  // ── Selective regeneration ──────────────────────────────────────────────────

  const deselectedCount = generatedOnTab ? questions.filter(q => !selectedQuestions.has(q.id)).length : 0

  async function handleSelectiveRegenerate() {
    const deselectedIds = new Set(
      questions.filter(q => !selectedQuestions.has(q.id)).map(q => q.id)
    )
    if (deselectedIds.size === 0) return

    setAiGenerating(true)
    setAiGenError('')
    setAiGenNotice('')

    try {
      let res: Response
      const regenCount = deselectedIds.size

      if (generatedOnTab === 'aidoc' && docFile) {
        const formData = new FormData()
        formData.append('file', docFile)
        formData.append('questionCount', String(regenCount))
        formData.append('difficulty', aiDifficulty)
        res = await fetch('/api/generate-quiz', { method: 'POST', body: formData })
      } else {
        const body: Record<string, unknown> = {
          mode: generatedOnTab === 'aitopic' ? 'topic' : 'url',
          questionCount: regenCount,
          difficulty: aiDifficulty,
        }
        if (generatedOnTab === 'aitopic') body.topic = aiTopic
        if (generatedOnTab === 'aiurl') body.url = aiUrl

        res = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) { setAiGenError(data.error ?? 'Regeneration failed'); return }

      const extractionSource = res.headers.get('x-quizotic-extraction-source')
      const ocrPages = Number(res.headers.get('x-quizotic-ocr-pages') ?? 0)
      const visionPages = Number(res.headers.get('x-quizotic-vision-pages') ?? 0)
      if (extractionSource === 'vision') {
        setAiGenNotice(`Regenerated using AI vision (${visionPages} page${visionPages === 1 ? '' : 's'}) — please review the questions before publishing.`)
      } else if (extractionSource === 'ocr') {
        setAiGenNotice(`Regenerated using OCR (${ocrPages} page${ocrPages === 1 ? '' : 's'}) — please review the questions before publishing.`)
      } else {
        setAiGenNotice('')
      }

      const newQs: Question[] = (data as Question[]).map(q => ({ ...q, id: crypto.randomUUID() }))
      let newIdx = 0
      const merged = questions.map(q => {
        if (deselectedIds.has(q.id) && newIdx < newQs.length) {
          return newQs[newIdx++]
        }
        return q
      })

      setQuestions(merged)
      setSelectedQuestions(new Set(merged.map(q => q.id)))
      refreshAiUsage()

      if (translatedTo && translatedTo !== 'English') {
        setTranslating(true)
        try {
          const tRes = await fetch('/api/translate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: merged, targetLanguage: translatedTo }),
          })
          const tData = await tRes.json()
          if (tRes.ok) {
            setQuestions(tData)
            refreshAiUsage()
          }
        } catch {}
        finally { setTranslating(false) }
      }
    } catch {
      setAiGenError('Network error. Try again.')
    } finally {
      setAiGenerating(false)
    }
  }

  // ── Manual translate ──────────────────────────────────────────────────────

  async function handleManualTranslate() {
    if (questions.length === 0 || quizLanguage === 'English') return
    setTranslating(true)
    setAiGenError('')
    try {
      const res = await fetch('/api/translate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, targetLanguage: quizLanguage }),
      })
      const data = await res.json()
      if (!res.ok) { setAiGenError(data.error ?? 'Translation failed'); return }
      setQuestions(data)
      setTranslatedTo(quizLanguage)
      refreshAiUsage()
    } catch {
      setAiGenError('Network error. Try again.')
    } finally {
      setTranslating(false)
    }
  }

  // ── Autosave draft (3s debounce) ────────────────────────────────────────────
  // Snapshot for dirty-check to power the beforeunload warn
  const lastSavedSnapshotRef = useRef('')

  const autosaveState = useAutosave(
    { title, subject, questions },
    (snap) => {
      if (!quizIdRef.current) return false
      try {
        writeDraft(draftKey('quiz', quizIdRef.current), snap)
        return true
      } catch {
        return false
      }
    },
    { delayMs: 5000 },
  )

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const current = JSON.stringify({ title, subject, questions })
      if (current !== lastSavedSnapshotRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [title, subject, questions])

  // ── Save ────────────────────────────────────────────────────────────────────

  function showSaveError(msg: string) { setSaveError(msg); setTimeout(() => setSaveError(''), 4000) }

  async function handleSave(): Promise<Quiz | null> {
    if (!title.trim()) { showSaveError('Quiz title is required'); return null }
    if (questions.length === 0) { showSaveError('Add at least one question'); return null }
    const validationIssues = validateQuizQuestions(questions)
    if (hasQuizValidationErrors(validationIssues)) {
      const first = validationIssues[0]
      if (first) {
        setActiveIndex(first.questionIndex)
        setTab('manual')
      }
      showSaveError(formatQuizValidationIssues(validationIssues))
      return null
    }
    setSaveError('')
    setSaving(true)

    const now = new Date().toISOString()
    const existing = editId ? loadQuizzes().find(q => q.id === editId) : null
    // Reuse the pre-minted ref so draft key, handleSave, and the server all
    // agree on the same id. Previously each Save minted a fresh UUID which
    // orphaned the draft and could create duplicate server rows.
    const stableId = editId ?? quizIdRef.current
    const quizData = {
      id: stableId,
      title: title.trim(),
      subject: subject.trim() || undefined,
      language: translatedTo ?? existing?.language ?? 'English',
      theme: theme || existing?.theme,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      questions,
    }

    saveQuiz(quizData)

    let finalQuiz = quizData as Quiz
    let dbSaveFailed = false
    let dbSaveError = ''
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quizData.id,
          title: quizData.title,
          subject: quizData.subject,
          language: quizData.language,
          theme: quizData.theme,
          questions: quizData.questions,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data?.id) {
          finalQuiz = { ...quizData, id: data.id, updatedAt: data.updatedAt ?? quizData.updatedAt } as Quiz
          saveQuiz(finalQuiz)
        }
      } else {
        dbSaveFailed = true
        try {
          const payload = await res.json()
          dbSaveError = Array.isArray(payload?.issues)
            ? formatQuizValidationIssues(payload.issues)
            : payload?.error ?? `Server returned ${res.status}`
        } catch {
          dbSaveError = `Server returned ${res.status}`
        }
        console.error('[quiz:save] API rejected:', res.status, dbSaveError)
      }
    } catch (err) {
      dbSaveFailed = true
      dbSaveError = err instanceof Error ? err.message : 'Network error'
      console.error('[quiz:save] network/fetch error:', err)
    }

    if (dbSaveFailed) {
      // Keep localStorage as fallback but SURFACE the error so the host knows
      // the quiz didn't land in their library.
      showSaveError(`Couldn't save to server: ${dbSaveError}. Quiz kept locally — try Save again.`)
    }

    // Clear draft — quiz is now properly saved
    const savedId = finalQuiz.id
    clearDraft(draftKey('quiz', savedId))
    quizIdRef.current = savedId
    setRecoveredDraft(null)
    lastSavedSnapshotRef.current = JSON.stringify({ title: quizData.title, subject: quizData.subject ?? '', questions: quizData.questions })

    setSaving(false)
    setSavedQuiz(finalQuiz)
    return dbSaveFailed ? null : finalQuiz
  }

  async function handleShareSelfPaced() {
    setSelfPacedShare(prev => ({ ...prev, open: true, loading: true, error: '', copied: false }))
    const quiz = savedQuiz ?? await handleSave()
    if (!quiz) {
      setSelfPacedShare(prev => ({ ...prev, loading: false, error: 'Save this quiz to the server before creating a self-paced link.' }))
      return
    }
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLimitMinutes: activePreset.selfPacedTimeLimitMinutes }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const issueMessage = Array.isArray(json.issues) ? formatQuizValidationIssues(json.issues) : ''
        setSelfPacedShare(prev => ({ ...prev, loading: false, error: issueMessage || json.error || 'Could not create self-paced link.' }))
        return
      }
      await fetch(`/api/quizzes/${quiz.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowRetries: activePreset.allowRetries,
          timeLimitMinutes: activePreset.selfPacedTimeLimitMinutes,
        }),
      }).catch(() => {})
      const url = `${window.location.origin}/q/${json.data.shareSlug}`
      setSelfPacedShare({
        open: true,
        loading: false,
        url,
        error: '',
        copied: false,
        questionCount: json.data.questionCount ?? 0,
        responseCount: json.data.responseCount ?? 0,
      })
    } catch {
      setSelfPacedShare(prev => ({ ...prev, loading: false, error: 'Network error. Please try again.' }))
    }
  }

  function copySelfPacedLink() {
    if (!selfPacedShare.url) return
    navigator.clipboard.writeText(selfPacedShare.url).catch(() => {})
    setSelfPacedShare(prev => ({ ...prev, copied: true }))
    setTimeout(() => setSelfPacedShare(prev => ({ ...prev, copied: false })), 2000)
  }

  // ── Sidebar stats ───────────────────────────────────────────────────────────

  const totalSeconds = questions.reduce((s, q) => s + q.timerSeconds, 0)
  const estMinutes = Math.max(1, Math.round(totalSeconds / 60))

  // Keep activeIndex in bounds
  const safeIndex = Math.min(activeIndex, Math.max(0, questions.length - 1))
  const activeQuestion = questions[safeIndex]

  // Scroll question into view in left panel
  const questionListRef = useRef<HTMLDivElement>(null)
  const scrollToQuestion = useCallback((index: number) => {
    setActiveIndex(index)
    setTab('manual')
    const el = document.getElementById(`qthumb-${index}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-paper)' }}>

      {/* ── Draft recovery banner ── */}
      {recoveredDraft && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium" style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
          <span>Unsaved draft recovered from {formatDraftAge(recoveredDraft.savedAt)}</span>
          <button
            onClick={() => {
              clearDraft(draftKey('quiz', recoveredDraft.quizId))
              setRecoveredDraft(null)
              // Reload saved version
              const saved = loadQuizzes().find(q => q.id === recoveredDraft.quizId)
              if (saved) {
                setTitle(saved.title)
                setSubject(saved.subject ?? '')
                setQuestions(saved.questions)
              }
            }}
            className="underline text-xs opacity-75 hover:opacity-100 flex-shrink-0"
          >
            Discard draft
          </button>
        </div>
      )}

      {/* ── Title-first modal ── */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => router.push('/host')}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => router.push('/host')} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg" aria-label="Cancel">x</button>
            <h2 className="text-xl font-black mb-1" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Name your quiz</h2>
            <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>You can edit this any time.</p>
            <form onSubmit={handleModalSubmit} className="space-y-3">
              <input type="text" placeholder="Quiz title *" value={modalTitle} onChange={e => setModalTitle(e.target.value)} autoFocus className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <input type="text" placeholder="Subject / tag (optional)" value={modalSubject} onChange={e => setModalSubject(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <button type="submit" disabled={!modalTitle.trim()} className="w-full py-3 font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40" style={{ background: '#F5E642', color: '#0D0D0D' }}>Start building</button>
              <button type="button" onClick={() => router.push('/host')} className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
        <Link
          href="/host"
          aria-label="Quizotic home"
          className="flex items-center gap-1.5 flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black" style={{ background: '#F5E642', color: '#0D0D0D' }}>Q</div>
          <span className="text-sm font-extrabold hidden sm:inline" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Quizotic</span>
        </Link>
        <button onClick={() => router.push('/host')} className="w-9 h-9 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Quiz title"
            className="w-full text-base font-extrabold bg-transparent outline-none truncate"
            style={{ color: '#0F1B3D' }}
          />
          <p className="hidden sm:block text-xs text-gray-400">{questions.length} questions &middot; {subject || 'No subject'} &middot; ~{estMinutes} min</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden md:inline-flex">
            <AutosaveBadge state={autosaveState} />
          </span>
          {/* + Add question button */}
          <button
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              setAddMenuOpen(addMenuOpen ? null : { x: rect.left, y: rect.bottom + 6 })
              setKebabMenuOpen(null)
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all hover:bg-gray-50 click-bounce"
            style={{ borderColor: '#E2E8F0', color: '#0F1B3D' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Add question
          </button>
          {/* ⋯ kebab menu */}
          <button
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              setKebabMenuOpen(kebabMenuOpen ? null : { x: rect.right - 176, y: rect.bottom + 6 })
              setAddMenuOpen(null)
            }}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg border text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#E2E8F0' }}
            title="More options"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
          </button>
          {/* Themes — opens full-screen picker for quiz-wide theming */}
          <button
            onClick={() => setThemePickerOpen(true)}
            title="Pick a theme"
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-bold border transition-all hover:bg-gray-50 click-bounce"
            style={{ borderColor: '#E2E8F0', color: '#0F1B3D' }}
          >
            <span
              aria-hidden
              className="w-4 h-4 rounded-md overflow-hidden border border-gray-200 inline-flex"
            >
              {getQuizTheme(theme).swatch.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="hidden sm:inline">Theme</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Saving...
              </span>
            ) : 'Save'}
          </button>
          <button
            onClick={() => {
              if (savedQuiz) { setActiveSession(savedQuiz); router.push('/host/session') }
              else { pendingLiveRef.current = true; handleSave() }
            }}
            className="btn-golive"
          >
            <span className="play-dot">
              <svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2.5 h-2.5" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            </span>
            Host live
          </button>
        </div>
      </header>

      {/* ── Three-Panel Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Question List ── */}
        <div ref={questionListRef} className="hidden md:flex md:w-60 lg:w-64 flex-shrink-0 bg-white border-r overflow-y-auto flex-col" style={{ borderColor: '#E2E8F0' }}>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Questions ({questions.length})</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1.5">
            {questions.map((q, i) => {
              const pill = getTypePill(q.type)
              const isActive = i === safeIndex
              const isSelected = generatedOnTab ? selectedQuestions.has(q.id) : true
              return (
                <div
                  key={q.id}
                  id={`qthumb-${i}`}
                  draggable
                  onDragStart={() => { dragIndex.current = i }}
                  onDragOver={e => { e.preventDefault() }}
                  onDrop={() => {
                    const from = dragIndex.current
                    if (from === null || from === i) return
                    const reordered = [...questions]
                    const [moved] = reordered.splice(from, 1)
                    reordered.splice(i, 0, moved)
                    setQuestions(reordered)
                    dragIndex.current = null
                  }}
                  onClick={() => scrollToQuestion(i)}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ index: i, x: e.clientX, y: e.clientY }) }}
                  className={`relative group flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer transition-all click-bounce-sm ${isActive ? '' : 'hover:bg-gray-50'}`}
                  style={
                    isActive
                      ? { background: '#EEF2FF', border: '2px solid #6366F1' }
                      : { border: '2px solid transparent', opacity: isSelected ? 1 : 0.5 }
                  }
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                    style={isActive ? { background: '#6366F1', color: '#fff' } : { background: '#E2E8F0', color: '#64748B' }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: pill.bg, color: pill.color }}>
                      {pill.label}
                    </div>
                    <p className="text-sm text-gray-600 truncate leading-tight">{q.text.slice(0, 50) || 'Untitled question'}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setContextMenu({ index: i, x: r.right, y: r.bottom }) }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 shadow-sm text-gray-400 hover:text-gray-700 text-sm font-bold"
                  >&#8230;</button>
                </div>
              )
            })}
          </div>

          {/* Bottom: Add Question by Type */}
          <div className="p-2 border-t" style={{ borderColor: '#E2E8F0', background: '#F8F9FF' }}>
            <div className="flex items-center justify-center gap-1 mb-2">
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3" style={{ color: '#0F1B3D' }}>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#0F1B3D' }}>New Question</p>
            </div>
            <div className="grid grid-cols-3 gap-1 mb-1.5">
              {TYPE_PILLS.map(t => (
                <button
                  key={t.value}
                  onClick={() => addQuestion(t.value)}
                  title={`Add new ${t.label} question`}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all hover:scale-105 hover:shadow-md group relative click-bounce-sm"
                  style={{ border: `1.5px solid ${t.color}30`, background: t.bg }}
                >
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-black text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: t.color }}>+</span>
                  <span style={{ color: t.color }}>{t.svg}</span>
                  <span className="text-[7px] font-bold text-center leading-tight" style={{ color: t.color }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            {generatedOnTab && deselectedCount > 0 && (
              <button
                onClick={handleSelectiveRegenerate}
                disabled={aiGenerating}
                className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#F5E642', color: '#0D0D0D', border: '1.5px solid #0D0D0D' }}
              >
                {aiGenerating ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    Regenerating...
                  </span>
                ) : `Regen ${deselectedCount}`}
              </button>
            )}
          </div>
        </div>

        {/* Context menu dropdown */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null) }} />
            <div
              className="fixed z-50 w-44 py-1 bg-white rounded-xl shadow-xl border"
              style={{ left: contextMenu.x, top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight - 200 : 600)), borderColor: '#E2E8F0' }}
            >
              {[
                { label: 'Duplicate', icon: '\u2398', action: () => duplicateQuestion(contextMenu.index), disabled: false, danger: false },
                { label: 'Move Up', icon: '\u2191', action: () => moveQuestion(contextMenu.index, 'up'), disabled: contextMenu.index === 0, danger: false },
                { label: 'Move Down', icon: '\u2193', action: () => moveQuestion(contextMenu.index, 'down'), disabled: contextMenu.index >= questions.length - 1, danger: false },
                { label: 'Delete', icon: '\u2715', action: () => removeQuestion(contextMenu.index), disabled: questions.length <= 1, danger: true },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setContextMenu(null) }}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors click-bounce-sm disabled:opacity-30 disabled:cursor-not-allowed ${item.danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-50'}`}
                  style={{ color: item.danger ? '#EF4444' : '#374151' }}
                >
                  <span className="w-4 text-center text-[11px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* + Add question dropdown */}
        {addMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(null)} />
            <div
              className="fixed z-50 w-52 py-1 bg-white rounded-xl shadow-xl border"
              style={{ left: addMenuOpen.x, top: addMenuOpen.y, borderColor: '#E2E8F0' }}
            >
              {[
                { label: 'Manual', tabKey: 'manual', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                { label: 'AI from topic', tabKey: 'aitopic', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/><path d="M13 10l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></svg> },
                { label: 'AI from URL', tabKey: 'aiurl', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9a3.5 3.5 0 005.25.38l2-2A3.5 3.5 0 009.3 2.43l-1.14 1.13"/><path d="M9 7a3.5 3.5 0 00-5.25-.38l-2 2A3.5 3.5 0 006.7 13.57l1.14-1.13"/></svg> },
                { label: 'AI from PDF', tabKey: 'aidoc', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1H4a1.5 1.5 0 00-1.5 1.5v11A1.5 1.5 0 004 15h8a1.5 1.5 0 001.5-1.5V6L9 1z"/><path d="M9 1v5h4.5"/></svg> },
                { label: 'CSV import', tabKey: 'csv', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M6 2v12M2 6h12"/></svg> },
                { label: 'Library', tabKey: 'library', icon: <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 13A1.5 1.5 0 014 12h10"/><path d="M4 1.5H13v13H4A1.5 1.5 0 012.5 13V3A1.5 1.5 0 014 1.5z"/></svg> },
              ].map(item => (
                <button
                  key={item.tabKey}
                  onClick={() => { setTab(item.tabKey as typeof tab); setAddMenuOpen(null) }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-gray-50 click-bounce-sm"
                  style={{ color: '#374151' }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ⋯ Kebab dropdown (Preview, Inspector, Share self-paced) */}
        {kebabMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setKebabMenuOpen(null)} />
            <div
              className="fixed z-50 w-44 py-1 bg-white rounded-xl shadow-xl border"
              style={{ left: kebabMenuOpen.x, top: kebabMenuOpen.y, borderColor: '#E2E8F0' }}
            >
              <button
                onClick={() => { setTab('manual'); setMobileEditorOpen(false); setMobileSlidesOpen(false); setKebabMenuOpen(null) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-gray-50 click-bounce-sm"
                style={{ color: '#374151' }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2-4 7-4 7 4 7 4-2 4-7 4-7-4-7-4Z"/><circle cx="8" cy="8" r="2"/></svg>
                Preview
              </button>
              <button
                onClick={() => { setInspectorOpen(o => !o); setKebabMenuOpen(null) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-gray-50 click-bounce-sm"
                style={{ color: inspectorOpen ? '#0F1B3D' : '#374151' }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h8M2 12h12"/></svg>
                Inspector {inspectorOpen ? '(on)' : '(off)'}
              </button>
              <button
                onClick={() => { handleShareSelfPaced(); setKebabMenuOpen(null) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors hover:bg-gray-50 click-bounce-sm"
                style={{ color: '#374151' }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8v5a1 1 0 001 1h8a1 1 0 001-1V8M10 4L8 2 6 4M8 2v8"/></svg>
                Share self-paced
              </button>
            </div>
          </>
        )}

        {/* ── CENTER PANEL: Preview / AI Settings / CSV / Library ──
            Manual tab uses overflow-hidden so QuestionPreview fills height;
            other tabs scroll naturally. */}
        <div className={tab === 'manual' ? 'flex-1 overflow-hidden flex items-center justify-center px-4 md:px-6 py-4 md:py-6' : 'flex-1 overflow-y-auto'} style={{ background: 'var(--color-paper)' }}>
        <div className={tab === 'manual' ? 'h-full w-full max-w-5xl' : 'min-h-full flex items-start md:items-center justify-center px-4 md:px-6 lg:px-8 pt-8 pb-10'}>

          {/* Manual tab → show preview */}
          {tab === 'manual' && activeQuestion && (
            <QuestionPreview question={activeQuestion} index={safeIndex} total={questions.length} onChange={u => updateQuestion(safeIndex, u)} plan={plan} />
          )}

          {/* AI Tabs → show settings */}
          {isAiTab && (
            <div className="w-full max-w-5xl space-y-4">
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                {tab === 'aitopic' ? 'Generate from Topic' : tab === 'aiurl' ? 'Generate from URL' : 'Generate from Document'}
              </h3>

              {/* Rate limit */}
              {aiUsage && (
                <div className="rounded-xl p-3 border bg-white" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700 font-medium">AI Questions: {aiUsage.used} of {aiUsage.limit} this month</span>
                    <span className="text-xs text-gray-500 capitalize">{aiUsage.plan} plan</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%`, background: aiUsage.used >= aiUsage.limit ? '#EF4444' : aiUsage.used >= aiUsage.limit * 0.7 ? '#F59E0B' : '#0F1B3D' }} />
                  </div>
                </div>
              )}

              {/* Tab input */}
              {tab === 'aitopic' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Topic</label>
                  <input type="text" placeholder='e.g. "Indian Independence Movement"' value={aiTopic} onChange={e => setAiTopic(e.target.value)} className="w-full bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ borderColor: '#E2E8F0' }} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TOPIC_SUGGESTIONS.map(chip => (
                      <button key={chip} type="button" onClick={() => setAiTopic(chip)} className="px-3 py-1 rounded-full text-xs font-medium border hover:bg-gray-50 transition-colors" style={{ background: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' }}>{chip}</button>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'aiurl' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">URL (must start with https://)</label>
                  <input type="url" placeholder="https://example.com/article" value={aiUrl} onChange={e => setAiUrl(e.target.value)} className="w-full bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ borderColor: '#E2E8F0' }} />
                </div>
              )}
              {tab === 'aidoc' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5 block">Upload PDF or DOCX (max 20MB)</label>
                  {docFile ? (
                    <div
                      className="w-full bg-white border-2 rounded-2xl px-5 py-6 flex items-center gap-4"
                      style={{ borderColor: '#16A34A', background: '#F0FDF4' }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#DCFCE7' }}>
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: '#166534' }}>{docFile.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#15803D' }}>
                          {(docFile.size / 1024 / 1024).toFixed(2)} MB &middot; ready to generate
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocFile(null)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/50 transition-colors flex-shrink-0"
                        style={{ color: '#166534' }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label
                        htmlFor="aidoc-file-input"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:translate-y-px"
                        style={{
                          background: '#F5E642',
                          color: '#0D0D0D',
                          border: '2px solid #0D0D0D',
                          boxShadow: '3px 3px 0 #0D0D0D',
                          fontFamily: 'var(--font-heading)',
                        }}
                      >
                        <span aria-hidden="true">⇡</span>
                        Choose file
                      </label>
                      <p className="text-xs" style={{ color: '#64748B' }}>Accepts PDF / DOCX · up to 20 MB</p>
                      <input
                        id="aidoc-file-input"
                        type="file"
                        accept=".pdf,.docx"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null
                          if (f && f.size > 20 * 1024 * 1024) {
                            setAiGenError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max is 20 MB`)
                            e.target.value = ''
                            return
                          }
                          setAiGenError('')
                          setDocFile(f)
                        }}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Settings panel */}
              <div className="rounded-xl border bg-white p-4 space-y-4" style={{ borderColor: '#E2E8F0' }}>
                {settingsLocked && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Settings locked after generation.</p>
                    <button onClick={resetGeneration} className="text-xs text-blue-600 font-medium hover:underline">Start new</button>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5 block">
                      Length {plan === 'free' && <span className="text-blue-500 text-[10px] normal-case">(up to 25 with Pro)</span>}
                    </label>
                    <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} disabled={settingsLocked} className="w-full bg-white border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>
                      {countOptions.map(n => <option key={n} value={n}>Around {n} questions</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5 block">Skill Level</label>
                    <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} disabled={settingsLocked} className="w-full bg-white border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>
                      <option value="easy">Beginner</option>
                      <option value="medium">Intermediate</option>
                      <option value="hard">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Type Breakdown</label>
                    <div className="flex items-center gap-2">
                      {!settingsLocked && !typeMixValid && (
                        <button onClick={handleAutoFill} className="text-xs font-bold px-3 py-1 rounded-lg transition-colors hover:opacity-80" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                          Auto-fill
                        </button>
                      )}
                      <span className="text-xs font-bold px-3 py-1 rounded-lg" style={typeMixValid ? { color: '#16A34A', background: '#F0FDF4' } : { color: '#D97706', background: '#FFFBEB' }}>
                        {typeMixSum}/{aiCount} {typeMixValid ? '\u2713' : `(${aiCount - typeMixSum} left)`}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {TYPE_MIX_LABELS.map(({ key, label, color, bg }) => {
                      const count = typeMix[key]
                      const hasCount = count > 0
                      return (
                        <div key={key} className="rounded-xl p-3 transition-all" style={{ border: `1.5px solid ${hasCount ? color : '#E2E8F0'}`, background: hasCount ? bg : '#FAFBFC' }}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            <span className="text-xs font-bold truncate" style={{ color: '#0F1B3D' }}>{label}</span>
                          </div>
                          <div className="flex items-stretch rounded-lg overflow-hidden" style={{ border: `1.5px solid ${hasCount ? color : '#E2E8F0'}`, background: '#fff' }}>
                            <button type="button" onClick={() => handleDecrement(key)} disabled={settingsLocked || count <= 0} className="flex-1 py-2 flex items-center justify-center text-lg font-bold transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: '#94A3B8' }}>&#8722;</button>
                            <span className="w-10 text-center text-sm font-extrabold border-l border-r flex items-center justify-center" style={{ color: hasCount ? color : '#0F1B3D', borderColor: hasCount ? color : '#E2E8F0', fontFamily: 'var(--font-heading)' }}>{count}</span>
                            <button type="button" onClick={() => handleIncrement(key)} disabled={settingsLocked || (typeMixSum >= aiCount && !Object.keys(typeMix).some(k => k !== key && typeMix[k as keyof TypeMix] > 0))} className="flex-1 py-2 flex items-center justify-center text-lg font-bold transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: '#94A3B8' }}>&#43;</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-center mt-2.5 text-xs font-semibold rounded-lg py-1.5" style={typeMixValid ? { color: '#16A34A', background: '#F0FDF4' } : { color: '#D97706', background: '#FFFBEB' }}>
                    {typeMixValid ? `All ${aiCount} questions allocated \u2713` : `${aiCount - typeMixSum} questions remaining \u2014 tap + to allocate`}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5 block">Language</label>
                  <div className="flex gap-2">
                    <select value={quizLanguage} onChange={e => setQuizLanguage(e.target.value)} className="flex-1 bg-white border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ borderColor: '#E2E8F0' }}>
                      {GLOBAL_LANGUAGES.map(({ lang }) => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    {generatedOnTab && quizLanguage !== 'English' && quizLanguage !== translatedTo && (
                      <button onClick={handleManualTranslate} disabled={translating} className="px-4 py-2 rounded-xl text-xs font-bold border-2 transition-colors disabled:opacity-40 whitespace-nowrap" style={{ borderColor: '#0F1B3D', color: '#0F1B3D', background: '#F3F4F6' }}>
                        {translating ? 'Translating...' : 'Translate'}
                      </button>
                    )}
                  </div>
                  {translatedTo && <p className="text-xs text-green-600 font-medium mt-1">Translated to {translatedTo}</p>}
                </div>
              </div>

              {/* Error */}
              {aiGenError && (
                <div className="rounded-xl p-4 border" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                  <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>{aiGenError}</p>
                </div>
              )}

              {/* OCR / extraction-provenance notice — shown when the PDF
                  was image-based and we had to OCR it. Recognition is
                  imperfect so the host should sanity-check the questions. */}
              {aiGenNotice && (
                <div className="rounded-xl p-4 border" style={{ background: '#FEF9C3', borderColor: '#FDE68A' }}>
                  <p className="text-sm font-semibold" style={{ color: '#92400E' }}>{aiGenNotice}</p>
                </div>
              )}

              {/* Generate button */}
              {!generatedOnTab && (
                <button
                  onClick={handleGenerate}
                  disabled={aiGenerating || !typeMixValid || aiLimitReached}
                  title={aiLimitReached ? 'Monthly AI limit reached. Resets on the 1st.' : undefined}
                  className="w-full py-4 font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  style={{ background: '#F5E642', color: '#0D0D0D' }}
                >
                  {aiGenerating && <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                  {aiLimitReached
                    ? 'Monthly AI limit reached'
                    : aiGenerating ? 'Generating...' : translating ? 'Translating...' : `Generate ${aiCount} Questions`}
                </button>
              )}

              {/* Post-generation: show preview in center, switch to manual editing */}
              {generatedOnTab && (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-3">Generated {questions.length} questions. Edit them in the question list.</p>
                  <button onClick={() => setTab('manual')} className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90" style={{ background: '#0F1B3D', color: '#F5E642' }}>
                    Edit Questions
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CSV Tab */}
          {tab === 'csv' && (
            <div className="w-full max-w-5xl space-y-4">
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Import from CSV</h3>

              {/* Step 1: Download template */}
              <div className="rounded-xl p-5 border" style={{ borderColor: '#0891B2', background: '#F0FDFE' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm text-white" style={{ background: '#0891B2' }}>1</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: '#0F1B3D' }}>Download the Quizotic template</p>
                    <p className="text-xs mb-3" style={{ color: '#475569', lineHeight: 1.6 }}>
                      Fill in this template exactly — do not rename or remove any columns. Supports MCQ, True/False, and Open-ended questions.
                    </p>
                    <button
                      onClick={() => {
                        const csv = [
                          'question,optionA,optionB,optionC,optionD,correctAnswer,timer,points',
                          '"What is 2+2?",3,4,5,6,B,20,1000',
                          '"Is the Earth round?",True,False,,,A,15,500',
                          '"Describe the water cycle.",,,,,,30,1000',
                        ].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'quizotic-template.csv'
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: '#0891B2', color: '#fff' }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                        <path d="M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 13h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Download Template (.csv)
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div className="rounded-xl p-5 border bg-white" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm text-white" style={{ background: '#0F1B3D' }}>2</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: '#0F1B3D' }}>Upload your filled CSV</p>
                    <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Only files using the Quizotic template format will be accepted.</p>

                    {/* Styled drop zone */}
                    <label
                      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors p-8 hover:border-blue-400 hover:bg-blue-50"
                      style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const file = e.dataTransfer.files?.[0]
                        if (!file) return
                        const event = { target: { files: e.dataTransfer.files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>
                        void event
                        const reader = new FileReader()
                        reader.onload = () => {
                          const text = reader.result as string
                          processCsvText(text)
                        }
                        reader.readAsText(file)
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" style={{ color: '#94A3B8' }}>
                        <path d="M12 16V8M9 11l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M20 16.7A4 4 0 0018 9h-1A6 6 0 104 14.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: '#475569' }}>Drag your CSV here, or click to browse</p>
                        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Only .csv files accepted</p>
                      </div>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => processCsvText(reader.result as string)
                          reader.readAsText(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Template column reference */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
                <div className="px-4 py-2.5 border-b" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                  <p className="text-xs font-bold" style={{ color: '#374151' }}>Required columns</p>
                </div>
                <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                  {[
                    { col: 'question', desc: 'The question text', required: true },
                    { col: 'optionA – optionD', desc: 'Answer options (leave empty for open-ended)', required: false },
                    { col: 'correctAnswer', desc: 'A, B, C or D (leave empty for polls)', required: false },
                    { col: 'timer', desc: '10, 15, 20, 30 or 60 seconds', required: false },
                    { col: 'points', desc: '500, 1000 or 2000', required: false },
                  ].map(row => (
                    <div key={row.col} className="flex items-start gap-3 px-4 py-2.5">
                      <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#EEF2FF', color: '#4F46E5' }}>{row.col}</code>
                      <span className="text-xs flex-1" style={{ color: '#6B7280' }}>{row.desc}</span>
                      <span className="text-[9px] font-bold flex-shrink-0" style={{ color: row.required ? '#DC2626' : '#94A3B8' }}>{row.required ? 'REQUIRED' : 'optional'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Library Tab */}
          {tab === 'library' && (
            <div className="w-full max-w-4xl space-y-3">
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Your Quiz Library</h3>
              {savedQuizzes.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-400 text-sm">No saved quizzes yet</p>
                  <p className="text-gray-300 text-xs mt-1">Create a quiz first, then find it here</p>
                </div>
              ) : (
                savedQuizzes.map(quiz => (
                  <button
                    key={quiz.id}
                    onClick={() => {
                      setTitle(quiz.title)
                      setSubject(quiz.subject ?? '')
                      setQuestions(quiz.questions)
                      setGeneratedOnTab(null)
                      setTab('manual')
                      setActiveIndex(0)
                    }}
                    className="w-full text-left bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <p className="font-semibold text-sm" style={{ color: '#0F1B3D' }}>{quiz.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{quiz.questions.length} questions &middot; {quiz.language ?? 'English'} &middot; {new Date(quiz.createdAt).toLocaleDateString()}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        </div>

        {/* ── RIGHT PANEL: Question Editor ── */}
        {(tab === 'manual' || generatedOnTab) && activeQuestion && (
          <div className={`${inspectorOpen ? 'hidden md:flex md:w-72' : 'hidden'} flex-shrink-0 bg-white border-l overflow-y-auto flex-col p-4`} style={{ borderColor: '#E2E8F0' }}>
            {generatedOnTab && (
              <div className="mb-3 flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(activeQuestion.id)}
                    onChange={() => toggleSelect(activeQuestion.id)}
                    className="w-3.5 h-3.5 rounded accent-blue-600"
                  />
                  <span className="text-[10px] font-medium text-gray-500">
                    {selectedQuestions.has(activeQuestion.id) ? 'Keep' : 'Replace on regen'}
                  </span>
                </label>
              </div>
            )}
            <details className="insp-section" open>
              <summary>
                <span>Audience</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </summary>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {AUDIENCE_PRESETS.map(preset => {
                  const active = preset.id === audiencePreset
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyAudiencePreset(preset)}
                      title={preset.note}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap"
                      style={{
                        background: active ? '#0F1B3D' : '#F8FAFC',
                        color: active ? '#F5E642' : '#475569',
                        borderColor: active ? '#0F1B3D' : '#E2E8F0',
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[10px]" style={{ color: '#64748B' }}>{activePreset.note} · {activePreset.timerSeconds}s · {activePreset.points} pts</p>
            </details>
            <QuestionEditor
              question={activeQuestion}
              onChange={u => updateQuestion(safeIndex, u)}
              onDelete={() => removeQuestion(safeIndex)}
              onDuplicate={() => duplicateQuestion(safeIndex)}
            />
          </div>
        )}
      </div>

      {/* ── Mobile Bottom Bar (portrait) ── */}
      <div className="md:hidden flex-shrink-0 border-t flex items-center gap-2 px-3 py-2.5"
        style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold disabled:opacity-30 transition-colors"
            style={{ color: '#0F1B3D', background: '#fff', border: '1.5px solid #E2E8F0' }}>
            &lsaquo;
          </button>
          <span className="text-sm font-bold px-2 py-2 rounded-xl text-center"
            style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0', minWidth: 56 }}>
            {safeIndex + 1}/{questions.length}
          </span>
          <button
            onClick={() => setActiveIndex(i => Math.min(i + 1, questions.length - 1))}
            disabled={safeIndex === questions.length - 1}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold disabled:opacity-30 transition-colors"
            style={{ color: '#0F1B3D', background: '#fff', border: '1.5px solid #E2E8F0' }}>
            &rsaquo;
          </button>
        </div>
        <button
          onClick={() => setMobileSlidesOpen(true)}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
          style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0' }}>
          ☰ Slides
        </button>
        <button
          onClick={() => setMobileAddOpen(true)}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl font-bold text-sm transition-all"
          style={{ background: '#0F1B3D', color: '#fff' }}>
          <span>+</span> Add
        </button>
        {activeQuestion && (tab === 'manual' || generatedOnTab) && (
          <button
            onClick={() => setMobileEditorOpen(true)}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
            style={{ background: '#F5E642', color: '#0D0D0D', border: '1.5px solid rgba(15,27,61,0.2)' }}>
            ✏️ Edit
          </button>
        )}
      </div>

      {/* ── Mobile Slides List Bottom Sheet ── */}
      {mobileSlidesOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMobileSlidesOpen(false) }}>
          <div className="rounded-t-2xl overflow-hidden flex flex-col" style={{ background: '#fff', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
              <span className="font-black text-base" style={{ color: '#0F1B3D' }}>Questions ({questions.length})</span>
              <button
                onClick={() => setMobileSlidesOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F1F5F9' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {questions.map((q, i) => {
                const pill = getTypePill(q.type)
                const isActive = i === safeIndex
                return (
                  <div
                    key={q.id}
                    onClick={() => { setActiveIndex(i); setMobileSlidesOpen(false) }}
                    className="flex items-center gap-2 px-3 py-3 rounded-lg transition-colors"
                    style={
                      isActive
                        ? { background: '#EEF2FF', border: '1.5px solid #6366F1' }
                        : { border: '1.5px solid #E2E8F0', background: '#fff' }
                    }
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                      style={isActive ? { background: '#6366F1', color: '#fff' } : { background: '#E2E8F0', color: '#64748B' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: pill.bg, color: pill.color }}>
                        {pill.label}
                      </div>
                      <p className="text-sm text-gray-700 truncate leading-tight">{q.text.slice(0, 60) || 'Untitled question'}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeQuestion(i); if (questions.length <= 1) setMobileSlidesOpen(false) }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 flex-shrink-0 hover:bg-red-50"
                      aria-label="Delete question">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M8.75 1a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5zM5 5a1 1 0 011-1h8a1 1 0 011 1v1H5V5zm.5 2.5a.5.5 0 00-.5.5v9a2 2 0 002 2h6a2 2 0 002-2v-9a.5.5 0 00-.5-.5h-9z"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: '#E2E8F0' }}>
              <button
                onClick={() => { setMobileSlidesOpen(false); setMobileAddOpen(true) }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: '#0F1B3D', color: '#fff' }}>
                <span>+</span> Add question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Add-Question Type Picker Sheet ── */}
      {mobileAddOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMobileAddOpen(false) }}>
          <div className="rounded-t-2xl overflow-hidden flex flex-col" style={{ background: '#fff', maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
              <div>
                <span className="font-black text-base block" style={{ color: '#0F1B3D' }}>Add a question</span>
                <span className="text-xs" style={{ color: '#94A3B8' }}>Pick a question type</span>
              </div>
              <button
                onClick={() => setMobileAddOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#F1F5F9' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {TYPE_PILLS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => {
                      addQuestion(t.value)
                      setMobileAddOpen(false)
                      setMobileEditorOpen(true)
                    }}
                    className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                    style={{ border: `1.5px solid ${t.color}30`, background: t.bg }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: t.color }}>{t.svg}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight" style={{ color: t.color }}>{t.label}</p>
                      <p className="text-[10px] mt-0.5 leading-snug" style={{ color: '#64748B' }}>{t.tooltip}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Editor Bottom Sheet ── */}
      {mobileEditorOpen && activeQuestion && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMobileEditorOpen(false) }}>
          <div className="rounded-t-2xl overflow-y-auto p-4" style={{ background: '#fff', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-black text-base" style={{ color: '#0F1B3D' }}>Edit Question</span>
              <button
                onClick={() => setMobileEditorOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F1F5F9' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>
            <QuestionEditor
              question={activeQuestion}
              onChange={u => updateQuestion(safeIndex, u)}
              onDelete={() => { removeQuestion(safeIndex); setMobileEditorOpen(false) }}
              onDuplicate={() => { duplicateQuestion(safeIndex); setMobileEditorOpen(false) }}
            />
          </div>
        </div>
      )}

      {/* ── Post-Save Success Modal ── */}
      {savedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-5">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#0F1B3D' }}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Quiz Saved!</h2>
              <p className="text-gray-500 mt-1">{savedQuiz.title} &middot; {savedQuiz.questions.length} question{savedQuiz.questions.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setActiveSession(savedQuiz); router.push('/host/session') }}
                className="py-4 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: '#0F1B3D', color: '#F5E642', fontFamily: 'var(--font-heading)' }}
              >
                Host live
              </button>
              <button
                onClick={handleShareSelfPaced}
                className="py-4 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
                style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
              >
                Share self-paced
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push('/host')} className="py-3 text-sm font-semibold rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">Go to Dashboard</button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/join`
                  navigator.clipboard.writeText(url)
                  const btn = document.activeElement as HTMLButtonElement
                  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Join Page' }, 1500) }
                }}
                className="py-3 text-sm font-semibold rounded-xl border-2 transition-colors"
                style={{ borderColor: '#E5E7EB', color: '#0F1B3D' }}
              >
                Copy Join Page
              </button>
            </div>
            <button onClick={() => setSavedQuiz(null)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">Continue editing</button>
          </div>
        </div>
      )}

      {/* ── Self-paced Share Modal ── */}
      {selfPacedShare.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSelfPacedShare(prev => ({ ...prev, open: false }))} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Share self-paced quiz</h3>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Participants can take it anytime. {activePreset.allowRetries ? 'Retakes are on for this preset.' : 'One attempt by default.'}
                </p>
              </div>
              <button onClick={() => setSelfPacedShare(prev => ({ ...prev, open: false }))} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 text-sm">&times;</button>
            </div>

            {selfPacedShare.loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#0F1B3D" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round"/></svg>
                <span className="ml-3 text-sm" style={{ color: '#64748B' }}>Saving and publishing...</span>
              </div>
            ) : selfPacedShare.error ? (
              <div className="rounded-xl p-4" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                <p className="text-sm font-semibold">{selfPacedShare.error}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Questions</p>
                    <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{selfPacedShare.questionCount}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Responses</p>
                    <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{selfPacedShare.responseCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <span className="flex-1 text-sm truncate" style={{ color: '#0F1B3D', fontFamily: 'monospace' }}>{selfPacedShare.url}</span>
                  <button onClick={copySelfPacedLink} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: selfPacedShare.copied ? '#16A34A' : '#0F1B3D', color: '#fff' }}>
                    {selfPacedShare.copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => router.push('/host/quizzes')} className="w-full py-3 rounded-xl text-sm font-bold" style={{ background: '#F5E642', color: '#0D0D0D' }}>
                  Manage link settings
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShareOpen(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Share Quiz</h3>
              <button onClick={() => setShareOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 text-sm">&times;</button>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
              <p className="text-2xl mb-2">🔗</p>
              <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>Share after starting</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>A 6-digit code is generated when you start a live session</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Join Page</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/join` : 'quizotic.live/join'}
                  className="flex-1 text-sm font-medium px-3 py-2 rounded-lg border bg-gray-50 outline-none"
                  style={{ borderColor: '#E2E8F0', color: '#374151' }}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join`); }}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 click-bounce"
                  style={{ background: '#0F1B3D', color: '#F5E642' }}
                >Copy</button>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2.5 text-xs text-gray-500 bg-amber-50 border border-amber-200">
              Start a live session to get a unique 6-digit access code for participants.
            </div>
            <button
              onClick={() => { setShareOpen(false); if (savedQuiz) { setActiveSession(savedQuiz); router.push('/host/session') } else { handleSave() } }}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 click-bounce"
              style={{ background: '#0F1B3D', color: '#F5E642' }}
            >&#9654; Start Live Session</button>
          </div>
        </>
      )}

      {/* ── Save Error Toast ── */}
      {saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg" style={{ background: '#DC2626', color: '#fff' }}>
          <p className="text-sm font-semibold">{saveError}</p>
        </div>
      )}

      {/* ── Quiz theme picker ── */}
      <QuizThemePicker
        open={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        value={(theme as QuizThemeId) ?? undefined}
        onChange={(id) => setThemeState(id)}
      />
    </div>
  )
}

export default function CreateQuizPage() {
  return (
    <Suspense>
      <CreateQuizPageInner />
    </Suspense>
  )
}
