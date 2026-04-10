'use client'

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveQuiz, loadQuizzes, setActiveSession } from '@/lib/quiz-storage'
import type { Question, QuestionType, BloomsLevel, Quiz, QuestionOption } from '@/lib/quiz-types'
import { getOptionText, getOptionImage } from '@/lib/quiz-types'
import { ImageUpload } from '@/components/ImageUpload'

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc' | 'library' | 'csv'

const TIMER_OPTIONS: (10 | 15 | 20 | 30 | 60)[] = [10, 15, 20, 30, 60]
const POINTS_OPTIONS: (500 | 1000 | 2000)[] = [500, 1000, 2000]

const QUESTION_COUNT_OPTIONS: Record<string, number[]> = {
  free: [5, 8, 10],
  pro: [5, 10, 15, 20, 25],
}

interface TypeMix {
  mcq: number
  truefalse: number
  poll: number
  openended: number
}

const TYPE_MIX_LABELS: { key: keyof TypeMix; label: string; color: string }[] = [
  { key: 'mcq', label: 'MCQ (4 options)', color: '#2563EB' },
  { key: 'truefalse', label: 'True / False', color: '#16A34A' },
  { key: 'poll', label: 'Poll', color: '#0F1B3D' },
  { key: 'openended', label: 'Open-ended', color: '#D97706' },
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

// ── Answer card colors ─────────────────────────────────────────────────────────

const OPTION_COLORS = [
  { letter: 'A', bg: 'linear-gradient(135deg, #FFF1F0 0%, #FFE4E1 100%)', text: '#C0392B', border: '#E74C3C', badge: 'linear-gradient(135deg, #E74C3C, #C0392B)' },
  { letter: 'B', bg: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)', text: '#1A56DB', border: '#3B82F6', badge: 'linear-gradient(135deg, #3B82F6, #1A56DB)' },
  { letter: 'C', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', text: '#B45309', border: '#F59E0B', badge: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  { letter: 'D', bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', text: '#047857', border: '#10B981', badge: 'linear-gradient(135deg, #10B981, #047857)' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────────

function makeQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '0',
    timerSeconds: 20,
    points: 1000,
  }
}

function optionsForType(type: QuestionType): string[] | undefined {
  if (type === 'truefalse') return ['True', 'False']
  if (type === 'mcq') return ['', '', '', '']
  if (type === 'rating') return ['1', '2', '3', '4', '5']
  if (type === 'case') return ['', '', '', '']
  if (type === 'poll') return ['', '', '', '']
  if (type === 'ranking') return ['', '', '']
  return undefined
}

function hasCorrectAnswer(type: QuestionType): boolean {
  return type === 'mcq' || type === 'truefalse'
}

function getTypePill(type: QuestionType) {
  return TYPE_PILLS.find(t => t.value === type) ?? TYPE_PILLS[0]
}

// ─── Visual Preview Card (Center Panel) ────────────────────────────────────────

function QuestionPreview({
  question,
  index,
  total,
}: {
  question: Question
  index: number
  total: number
}) {
  const pill = getTypePill(question.type)
  const opts = question.options ?? []

  return (
    <div className="w-full max-w-[640px] rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div className="px-6 py-5 text-center" style={{ background: '#0F1B3D' }}>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>
          Question {index + 1} of {total}
        </p>
        <p className="text-lg font-extrabold leading-snug" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
          {question.text || 'Your question will appear here...'}
        </p>
      </div>

      {/* Image area */}
      {question.imageUrl ? (
        <div className="w-full h-44 bg-gray-800">
          <img src={question.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-44 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a365d 0%, #334155 100%)' }}>
          <div className="text-center">
            <div className="text-2xl mb-1 opacity-40">&#128444;&#65039;</div>
            <p className="text-xs" style={{ color: '#64748B' }}>Click to add image or let AI suggest</p>
          </div>
        </div>
      )}

      {/* Options */}
      <div className="bg-white p-4">
        {(question.type === 'mcq' || question.type === 'truefalse' || question.type === 'poll' || question.type === 'case') && opts.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {opts.map((opt, i) => {
              const c = OPTION_COLORS[i] ?? OPTION_COLORS[0]
              const isCorrect = question.correctAnswer === String(i) && hasCorrectAnswer(question.type)
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
                  style={{
                    background: c.bg,
                    borderLeft: `4px solid ${c.border}`,
                    color: c.text,
                    outline: isCorrect ? '2.5px solid #16A34A' : 'none',
                    outlineOffset: '-2px',
                    boxShadow: isCorrect ? '0 0 12px rgba(16,185,129,0.25)' : 'none',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: c.badge }}
                  >
                    {c.letter}
                  </div>
                  <span className="text-sm font-bold truncate">{getOptionText(opt) || `Option ${c.letter}`}</span>
                  {isCorrect && <span className="ml-auto text-base font-black text-green-600">&#10003;</span>}
                </div>
              )
            })}
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
          <div className="space-y-2 py-2">
            {opts.map((opt, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: '#4F46E5', color: '#fff' }}>{i + 1}</span>
                <span className="text-sm font-medium text-gray-700">{getOptionText(opt) || `Item ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}

        {(question.type === 'openended' || question.type === 'wordcloud' || question.type === 'qa') && (
          <div className="py-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50">
              {pill.svg}
              <span className="text-sm font-semibold" style={{ color: pill.color }}>{pill.label} — participants respond live</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#F1F5F9', color: '#64748B' }}>
          &#9201; {question.timerSeconds}s
        </div>
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
  const [showAdvanced, setShowAdvanced] = useState(false)

  function handleTypeChange(type: QuestionType) {
    const options = optionsForType(type)
    const correctAnswer = hasCorrectAnswer(type) ? '0' : undefined
    onChange({ ...question, type, options, correctAnswer })
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

  return (
    <div className="space-y-5">
      {/* Actions row */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onDuplicate} className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-gray-50">Duplicate</button>
        <button onClick={onDelete} className="text-xs text-gray-500 hover:text-red-500 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-red-50">Remove</button>
      </div>

      {/* Question Type */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">Question Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TYPE_PILLS.map(t => {
            const active = question.type === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                title={t.tooltip}
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-semibold transition-all"
                style={
                  active
                    ? { border: `2px solid ${t.color}`, background: t.bg, color: t.color }
                    : { border: '1.5px solid #E2E8F0', background: '#FAFBFC', color: '#64748B' }
                }
              >
                <span className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 24, height: 24, background: active ? t.bg : '#f3f4f6' }}>
                  {t.svg}
                </span>
                <span className="text-center leading-tight">{t.label}</span>
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

      {/* Question text */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
          {question.type === 'case' ? 'Decision Question' : 'Question'}
        </label>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder={question.type === 'case' ? 'e.g., "What should you do?"' : 'Enter your question...'}
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
        />
      </div>

      {/* Options editor */}
      {question.options && question.type !== 'rating' && question.type !== 'ranking' && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">
            Answers {hasCorrectAnswer(question.type) && <span className="normal-case text-green-600">&#9679; = correct</span>}
          </label>
          <div className="space-y-1.5">
            {question.options.map((opt, i) => {
              const c = OPTION_COLORS[i] ?? OPTION_COLORS[0]
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white"
                    style={{ background: c.badge }}
                  >
                    {c.letter}
                  </div>
                  {getOptionImage(opt) && (
                    <ImageUpload
                      imageUrl={getOptionImage(opt)}
                      onUpload={url => handleOptionImageUpload(i, url)}
                      onRemove={() => handleOptionImageRemove(i)}
                      variant="option"
                    />
                  )}
                  <input
                    type="text"
                    value={getOptionText(opt)}
                    onChange={e => handleOptionChange(i, e.target.value)}
                    placeholder={`Option ${c.letter}`}
                    disabled={question.type === 'truefalse'}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                  />
                  {hasCorrectAnswer(question.type) && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...question, correctAnswer: String(i) })}
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={
                        question.correctAnswer === String(i)
                          ? { borderColor: '#16A34A', background: '#16A34A' }
                          : { borderColor: '#CBD5E1', background: 'transparent' }
                      }
                    >
                      {question.correctAnswer === String(i) && (
                        <span className="text-white text-[10px] font-bold">&#10003;</span>
                      )}
                    </button>
                  )}
                  {!getOptionImage(opt) && question.type !== 'truefalse' && (
                    <ImageUpload
                      imageUrl={undefined}
                      onUpload={url => handleOptionImageUpload(i, url)}
                      onRemove={() => handleOptionImageRemove(i)}
                      variant="option"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rating preview */}
      {question.type === 'rating' && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">Rating Scale (1-5 stars)</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className="text-xl" style={{ color: '#EA580C' }}>&#9733;</span>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Participants rate on a 1-5 scale. Results shown as average.</p>
        </div>
      )}

      {/* Ranking items editor */}
      {question.type === 'ranking' && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Items to Rank</label>
          <div className="space-y-1.5">
            {(question.options ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-gray-100 text-gray-500">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={getOptionText(item)}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Item ${i + 1}`}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...question, options: (question.options ?? []).filter((_, j) => j !== i) })}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          {(question.options ?? []).length < 6 && (
            <button
              type="button"
              onClick={() => onChange({ ...question, options: [...(question.options ?? []), ''] })}
              className="mt-2 text-xs font-medium transition-colors"
              style={{ color: '#0F1B3D' }}
            >
              + Add item
            </button>
          )}
        </div>
      )}

      {/* Image */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Image</label>
        <ImageUpload
          imageUrl={question.imageUrl}
          onUpload={url => onChange({ ...question, imageUrl: url })}
          onRemove={() => onChange({ ...question, imageUrl: undefined })}
          variant="question"
        />
      </div>

      {/* Timer & Points */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 block">Settings</label>
        <div className="flex gap-3">
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
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Points</label>
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
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
          {question.type === 'case' ? 'Debrief' : 'Explanation'} <span className="normal-case text-gray-300 font-normal">(shown after answer)</span>
        </label>
        <textarea
          value={question.explanation ?? ''}
          onChange={e => onChange({ ...question, explanation: e.target.value || undefined })}
          placeholder={question.type === 'case' ? 'Expert reasoning — what\'s the right call and why?' : 'Why is this the correct answer?'}
          rows={2}
          maxLength={500}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
        />
      </div>

      {/* Advanced */}
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(s => !s)}
          className="text-xs font-semibold flex items-center gap-1.5 transition-colors"
          style={{ color: showAdvanced ? '#0F1B3D' : '#9CA3AF' }}
        >
          <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Advanced
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bloom&apos;s Level</label>
            <select
              value={question.bloomsLevel ?? ''}
              onChange={e => onChange({ ...question, bloomsLevel: (e.target.value as BloomsLevel) || undefined })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">None</option>
              <option value="remember">Remember</option>
              <option value="understand">Understand</option>
              <option value="apply">Apply</option>
              <option value="analyse">Analyse</option>
              <option value="evaluate">Evaluate</option>
              <option value="create">Create</option>
            </select>
          </div>
        )}
      </div>
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
  const [questions, setQuestions] = useState<Question[]>([makeQuestion()])
  const [saveError, setSaveError] = useState('')
  const [savedQuiz, setSavedQuiz] = useState<Quiz | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // Plan state
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

  // AI usage / rate limit
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number; plan: string } | null>(null)
  useEffect(() => {
    fetch('/api/user/ai-usage').then(r => r.json()).then(d => {
      if (d.used !== undefined) setAiUsage(d)
    }).catch(() => {})
  }, [])

  // Shared AI settings
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [typeMix, setTypeMix] = useState<TypeMix>({ mcq: 5, truefalse: 0, poll: 0, openended: 0 })
  const [quizLanguage, setQuizLanguage] = useState('English')

  useEffect(() => {
    setTypeMix({ mcq: aiCount, truefalse: 0, poll: 0, openended: 0 })
  }, [aiCount])

  // AI generation state
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGenError, setAiGenError] = useState('')
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

  // Load existing quiz when editing
  useEffect(() => {
    if (!editId) return
    const quiz = loadQuizzes().find(q => q.id === editId)
    if (!quiz) return
    setTitle(quiz.title)
    setSubject(quiz.subject ?? '')
    setQuestions(quiz.questions)
    setShowTitleModal(false)
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
  const typeMixSum = typeMix.mcq + typeMix.truefalse + typeMix.poll + typeMix.openended
  const typeMixValid = typeMixSum === aiCount
  const countOptions = QUESTION_COUNT_OPTIONS[plan] ?? QUESTION_COUNT_OPTIONS.free

  function handleTypeMixChange(key: keyof TypeMix, val: number) {
    setTypeMix(prev => ({ ...prev, [key]: val }))
  }

  function maxForType(key: keyof TypeMix): number {
    const remaining = aiCount - typeMixSum
    return typeMix[key] + Math.max(0, remaining)
  }

  // ── Question mutations ──────────────────────────────────────────────────────

  function addQuestion() {
    const newQ = makeQuestion()
    setQuestions(prev => [...prev, newQ])
    setActiveIndex(questions.length) // select the new question
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

  function applyGeneratedQuestions(raw: Question[], forTab: Tab): Question[] {
    const withIds = raw.map(q => ({ ...q, id: crypto.randomUUID() }))
    setQuestions(withIds)
    setGeneratedOnTab(forTab)
    setSelectedQuestions(new Set(withIds.map(q => q.id)))
    setActiveIndex(0)
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
  }

  // ── Unified AI generate handler ─────────────────────────────────────────────

  async function handleGenerate() {
    setAiGenError('')

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

      const generated = applyGeneratedQuestions(data, tab)

      setAiUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev)

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
      setAiUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev)

      if (translatedTo && translatedTo !== 'English') {
        setTranslating(true)
        try {
          const tRes = await fetch('/api/translate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: merged, targetLanguage: translatedTo }),
          })
          const tData = await tRes.json()
          if (tRes.ok) setQuestions(tData)
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
    } catch {
      setAiGenError('Network error. Try again.')
    } finally {
      setTranslating(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!title.trim()) { setSaveError('Quiz title is required'); return }
    if (questions.length === 0) { setSaveError('Add at least one question'); return }
    setSaveError('')
    setSaving(true)

    const now = new Date().toISOString()
    const existing = editId ? loadQuizzes().find(q => q.id === editId) : null
    const quizData = {
      id: editId ?? crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim() || undefined,
      language: translatedTo ?? existing?.language ?? 'English',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      questions,
    }

    saveQuiz(quizData)

    let finalQuiz = quizData as Quiz
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId || undefined,
          title: quizData.title,
          subject: quizData.subject,
          language: quizData.language,
          questions: quizData.questions,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data?.id && data.id !== quizData.id) {
          finalQuiz = { ...quizData, id: data.id } as Quiz
          saveQuiz(finalQuiz)
        }
      }
    } catch {
      // DB save failed silently — localStorage is fallback
    }

    setSaving(false)
    setSavedQuiz(finalQuiz)
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
    const el = document.getElementById(`qthumb-${index}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'manual',  label: 'Manual', icon: '&#9998;' },
    { id: 'aitopic', label: 'AI Topic', icon: '&#10024;' },
    { id: 'aiurl',   label: 'AI URL', icon: '&#128279;' },
    { id: 'aidoc',   label: 'AI PDF', icon: '&#128196;' },
    { id: 'csv',     label: 'CSV', icon: '&#128202;' },
    { id: 'library', label: 'Library', icon: '&#128218;' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#F0F2F5' }}>

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
          <p className="text-[11px] text-gray-400">{questions.length} questions &middot; {subject || 'No subject'} &middot; ~{estMinutes} min</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#F5E642', color: '#0D0D0D', border: '1.5px solid #0D0D0D' }}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Saving...
              </span>
            ) : 'Save'}
          </button>
          <button
            onClick={() => { if (savedQuiz) { setActiveSession(savedQuiz); router.push('/host/session') } else { handleSave() } }}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
            style={{ background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }}
          >
            &#9654; Start Live
          </button>
        </div>
      </header>

      {/* ── Source Tabs ── */}
      <div className="flex gap-1 px-4 py-2 border-b" style={{ background: '#FAFBFC', borderColor: '#E2E8F0' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'manual' && questions.length > 0) setActiveIndex(0) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={
              tab === t.id
                ? { background: '#EEF2FF', border: '1.5px solid #6366F1', color: '#4F46E5' }
                : { background: 'transparent', border: '1.5px solid transparent', color: '#64748B' }
            }
          >
            <span dangerouslySetInnerHTML={{ __html: t.icon }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Three-Panel Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Question List ── */}
        <div ref={questionListRef} className="w-56 flex-shrink-0 bg-white border-r overflow-y-auto flex flex-col" style={{ borderColor: '#E2E8F0' }}>
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Questions ({questions.length})</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
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
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition-all ${isActive ? '' : 'hover:bg-gray-50'}`}
                  style={
                    isActive
                      ? { background: '#EEF2FF', border: '1.5px solid #6366F1' }
                      : { border: '1.5px solid transparent', opacity: isSelected ? 1 : 0.5 }
                  }
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                    style={isActive ? { background: '#6366F1', color: '#fff' } : { background: '#E2E8F0', color: '#64748B' }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-block mb-0.5" style={{ background: pill.bg, color: pill.color }}>
                      {pill.label}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate leading-tight">{q.text.slice(0, 40) || 'Untitled question'}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom actions */}
          <div className="p-2 border-t space-y-1" style={{ borderColor: '#E2E8F0' }}>
            <button onClick={addQuestion} className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all hover:bg-gray-50" style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>
              + Add
            </button>
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

        {/* ── CENTER PANEL: Preview / AI Settings / CSV / Library ── */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6" style={{ background: '#F0F2F5' }}>

          {/* Manual tab → show preview */}
          {tab === 'manual' && activeQuestion && (
            <QuestionPreview question={activeQuestion} index={safeIndex} total={questions.length} />
          )}

          {/* AI Tabs → show settings */}
          {isAiTab && (
            <div className="w-full max-w-lg space-y-4">
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
                  <label className="text-xs text-gray-500 mb-1 block">Upload PDF or DOCX (max 5MB)</label>
                  <input type="file" accept=".pdf,.docx" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="w-full bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-600 file:text-sm" style={{ borderColor: '#E2E8F0' }} />
                  {docFile && <p className="text-xs text-gray-500 mt-1">{docFile.name} ({(docFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
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
                    <label className="text-xs text-gray-500 mb-1 block">Questions {plan === 'free' && <span className="text-blue-500 text-[10px]">(up to 25 with Pro)</span>}</label>
                    <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} disabled={settingsLocked} className="w-full bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>
                      {countOptions.map(n => <option key={n} value={n}>{n} questions</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Difficulty</label>
                    <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} disabled={settingsLocked} className="w-full bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Type breakdown</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_MIX_LABELS.map(({ key, label, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{label}</span>
                        <select value={typeMix[key]} onChange={e => handleTypeMixChange(key, Number(e.target.value))} disabled={settingsLocked} className="w-14 bg-gray-50 border rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>
                          {Array.from({ length: maxForType(key) + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium ${typeMixValid ? 'text-green-600' : 'text-amber-600'}`}>Total: {typeMixSum}/{aiCount}</span>
                    {typeMixValid && <span className="text-green-500 text-xs">&#10003;</span>}
                    {!typeMixValid && <span className="text-amber-500 text-xs">({aiCount - typeMixSum} remaining)</span>}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Language</label>
                  <div className="flex gap-2">
                    <select value={quizLanguage} onChange={e => setQuizLanguage(e.target.value)} className="flex-1 bg-white border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ borderColor: '#E2E8F0' }}>
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
                  {aiGenError.includes('Upgrade') && (
                    <button onClick={() => router.push('/host/billing')} className="mt-2 text-sm font-bold px-4 py-1.5 rounded-lg text-white" style={{ background: '#0F1B3D' }}>View Pro Plans</button>
                  )}
                </div>
              )}

              {/* Generate button */}
              {!generatedOnTab && (
                <button
                  onClick={handleGenerate}
                  disabled={aiGenerating || !typeMixValid}
                  className="w-full py-4 font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  style={{ background: '#F5E642', color: '#0D0D0D' }}
                >
                  {aiGenerating && <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                  {aiGenerating ? 'Generating...' : translating ? 'Translating...' : tab === 'aiurl' ? 'Fetch & Generate' : tab === 'aidoc' ? 'Generate from Document' : 'Generate Questions'}
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
            <div className="w-full max-w-lg space-y-4">
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Import from CSV</h3>
              <div className="rounded-xl p-5 border bg-white" style={{ borderColor: '#E2E8F0' }}>
                <p className="text-sm font-bold mb-2" style={{ color: '#0F1B3D' }}>Upload a CSV file</p>
                <p className="text-xs mb-3" style={{ color: '#6B7280', lineHeight: 1.6 }}>
                  Columns: <strong>question</strong>, <strong>optionA</strong>, <strong>optionB</strong>, <strong>optionC</strong>, <strong>optionD</strong>, <strong>correctAnswer</strong> (A/B/C/D), <strong>timer</strong> (optional), <strong>points</strong> (optional).
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="text-sm"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const text = reader.result as string
                      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                      if (lines.length < 2) return
                      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
                      const qIdx = headers.findIndex(h => h === 'question')
                      const aIdx = headers.findIndex(h => h === 'optiona' || h === 'option_a' || h === 'a')
                      const bIdx = headers.findIndex(h => h === 'optionb' || h === 'option_b' || h === 'b')
                      const cIdx = headers.findIndex(h => h === 'optionc' || h === 'option_c' || h === 'c')
                      const dIdx = headers.findIndex(h => h === 'optiond' || h === 'option_d' || h === 'd')
                      const correctIdx = headers.findIndex(h => h === 'correctanswer' || h === 'correct_answer' || h === 'correct' || h === 'answer')
                      const timerIdx = headers.findIndex(h => h === 'timer' || h === 'time')
                      const pointsIdx = headers.findIndex(h => h === 'points')
                      if (qIdx === -1) { alert('CSV must have a "question" column'); return }

                      const parsed: Question[] = []
                      for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? lines[i].split(',').map(c => c.trim())
                        const questionText = cols[qIdx]
                        if (!questionText) continue
                        const options: string[] = []
                        if (aIdx >= 0 && cols[aIdx]) options.push(cols[aIdx])
                        if (bIdx >= 0 && cols[bIdx]) options.push(cols[bIdx])
                        if (cIdx >= 0 && cols[cIdx]) options.push(cols[cIdx])
                        if (dIdx >= 0 && cols[dIdx]) options.push(cols[dIdx])
                        const correctLetter = correctIdx >= 0 ? cols[correctIdx]?.toUpperCase() : undefined
                        const correctIndex = correctLetter ? { A: '0', B: '1', C: '2', D: '3' }[correctLetter] : undefined
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
                      if (parsed.length === 0) { alert('No valid questions found in CSV'); return }
                      setQuestions(prev => [...prev, ...parsed])
                      setTab('manual')
                      setActiveIndex(0)
                    }
                    reader.readAsText(file)
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="rounded-xl p-4 border bg-white" style={{ borderColor: '#E2E8F0' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>Example CSV:</p>
                <pre className="text-xs font-mono overflow-x-auto p-3 rounded-lg" style={{ background: '#F8FAFC', color: '#374151' }}>
{`question,optionA,optionB,optionC,optionD,correctAnswer,timer,points
"What is 2+2?",3,4,5,6,B,20,1000
"Capital of India?",Mumbai,Delhi,Chennai,Kolkata,B,15,500`}
                </pre>
              </div>
            </div>
          )}

          {/* Library Tab */}
          {tab === 'library' && (
            <div className="w-full max-w-lg space-y-3">
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

        {/* ── RIGHT PANEL: Question Editor ── */}
        {(tab === 'manual' || generatedOnTab) && activeQuestion && (
          <div className="w-72 flex-shrink-0 bg-white border-l overflow-y-auto p-4" style={{ borderColor: '#E2E8F0' }}>
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
            <QuestionEditor
              question={activeQuestion}
              onChange={u => updateQuestion(safeIndex, u)}
              onDelete={() => removeQuestion(safeIndex)}
              onDuplicate={() => duplicateQuestion(safeIndex)}
            />
          </div>
        )}
      </div>

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
            <button
              onClick={() => { setActiveSession(savedQuiz); router.push('/host/session') }}
              className="w-full py-4 font-bold text-lg rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              Start Live Session
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push('/host')} className="py-3 text-sm font-semibold rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-colors">Go to Dashboard</button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/join`
                  navigator.clipboard.writeText(url)
                  const btn = document.activeElement as HTMLButtonElement
                  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Join Link' }, 1500) }
                }}
                className="py-3 text-sm font-semibold rounded-xl border-2 transition-colors"
                style={{ borderColor: '#E5E7EB', color: '#0F1B3D' }}
              >
                Copy Join Link
              </button>
            </div>
            <button onClick={() => setSavedQuiz(null)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">Continue editing</button>
          </div>
        </div>
      )}

      {/* ── Save Error Toast ── */}
      {saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg" style={{ background: '#DC2626', color: '#fff' }}>
          <p className="text-sm font-semibold">{saveError}</p>
        </div>
      )}
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
