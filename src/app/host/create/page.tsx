'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveQuiz, loadQuizzes } from '@/lib/quiz-storage'
import type { Question, QuestionType, BloomsLevel, Quiz } from '@/lib/quiz-types'

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc' | 'library'

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
  { key: 'poll', label: 'Poll', color: '#4361EE' },
  { key: 'openended', label: 'Open-ended', color: '#D97706' },
]

const TYPE_PILLS: { value: QuestionType; label: string; color: string; bg: string; svg: React.ReactNode }[] = [
  {
    value: 'mcq', label: 'Multiple Choice', color: '#2563EB', bg: '#EFF6FF',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="3" width="14" height="14" rx="3" fill="#2563EB" fillOpacity="0.15" stroke="#2563EB" strokeWidth="1.5"/>
        <path d="M7 10l2.5 2.5L13 7.5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'truefalse', label: 'True / False', color: '#16A34A', bg: '#F0FDF4',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <circle cx="10" cy="10" r="7.5" fill="#16A34A" fillOpacity="0.15" stroke="#16A34A" strokeWidth="1.5"/>
        <path d="M7 10l2 2 4-4" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'poll', label: 'Poll', color: 'var(--color-primary)', bg: '#F0F4FF',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="12" width="3.5" height="5" rx="1" fill="#4361EE" fillOpacity="0.8"/>
        <rect x="8.25" y="8" width="3.5" height="9" rx="1" fill="#4361EE"/>
        <rect x="13.5" y="5" width="3.5" height="12" rx="1" fill="#4361EE" fillOpacity="0.5"/>
      </svg>
    ),
  },
  {
    value: 'openended', label: 'Open-ended', color: '#D97706', bg: '#FFFBEB',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M4 6h12M4 10h8M4 14h6" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 12l1.5 1.5L14 17l-1.5-1.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'wordcloud', label: 'Word Cloud', color: '#FF6B6B', bg: '#FFF0FA',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <ellipse cx="8" cy="11" rx="5" ry="3.5" fill="#FF6B6B" fillOpacity="0.2" stroke="#FF6B6B" strokeWidth="1.3"/>
        <ellipse cx="13" cy="9" rx="4" ry="2.8" fill="#FF6B6B" fillOpacity="0.2" stroke="#FF6B6B" strokeWidth="1.3"/>
        <ellipse cx="10" cy="7" rx="3.5" ry="2.5" fill="#FF6B6B" fillOpacity="0.3" stroke="#FF6B6B" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    value: 'qa', label: 'Q&A', color: '#0891B2', bg: '#ECFEFF',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H8l-3 3v-3H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="#0891B2" fillOpacity="0.15" stroke="#0891B2" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 8.5a2 2 0 014 0c0 1-1 1.5-2 2v1" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="13.5" r="0.75" fill="#0891B2"/>
      </svg>
    ),
  },
  {
    value: 'rating', label: 'Rating', color: '#EA580C', bg: '#FFF7ED',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <path d="M10 3l1.8 3.6 4 .6-2.9 2.8.7 4L10 12l-3.6 1.9.7-4L4.2 7.2l4-.6z" fill="#EA580C" fillOpacity="0.8" stroke="#EA580C" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 'ranking', label: 'Ranking', color: '#4F46E5', bg: '#EEF2FF',
    svg: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <rect x="3" y="4" width="14" height="3" rx="1.5" fill="#4F46E5"/>
        <rect x="3" y="8.5" width="10" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.65"/>
        <rect x="3" y="13" width="7" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.35"/>
      </svg>
    ),
  },
  {
    value: 'case', label: 'Scenario', color: '#DC2626', bg: '#FFF1F2',
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
  { lang: 'English' },
  { lang: 'Arabic' },
  { lang: 'Bahasa' },
  { lang: 'Bengali' },
  { lang: 'Filipino' },
  { lang: 'French' },
  { lang: 'German' },
  { lang: 'Hindi' },
  { lang: 'Japanese' },
  { lang: 'Korean' },
  { lang: 'Mandarin' },
  { lang: 'Marathi' },
  { lang: 'Portuguese' },
  { lang: 'Russian' },
  { lang: 'Spanish' },
  { lang: 'Swahili' },
  { lang: 'Tamil' },
  { lang: 'Telugu' },
  { lang: 'Turkish' },
]

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

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
  onDuplicate,
  selectable,
  selected,
  onToggleSelect,
}: {
  question: Question
  index: number
  onChange: (q: Question) => void
  onDelete: () => void
  onDuplicate: () => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  function handleTypeChange(type: QuestionType) {
    const options = optionsForType(type)
    const correctAnswer = hasCorrectAnswer(type) ? '0' : undefined
    onChange({ ...question, type, options, correctAnswer })
  }

  function handleOptionChange(i: number, value: string) {
    const options = [...(question.options ?? [])]
    options[i] = value
    onChange({ ...question, options })
  }

  return (
    <div id={`q-${question.id}`} className={`bg-white rounded-xl border shadow-sm p-6 space-y-5 relative ${selectable && !selected ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Q{index + 1}</span>
        <div className="flex items-center gap-3">
          {/* Selective regen checkbox */}
          {selectable && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded accent-violet-600"
              />
              <span className="text-xs font-medium text-gray-600">{selected ? 'Keep' : 'Replace'}</span>
            </label>
          )}
          <button onClick={onDuplicate} className="text-sm text-gray-500 hover:text-violet-600 transition-colors font-medium">Duplicate</button>
          <button onClick={onDelete} className="text-sm text-gray-500 hover:text-red-500 transition-colors font-medium">Remove</button>
        </div>
      </div>

      {/* Type pills */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Question Type</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {TYPE_PILLS.map(t => {
            const active = question.type === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-semibold transition-all"
                style={
                  active
                    ? { border: `2px solid ${t.color}`, background: t.bg, color: t.color }
                    : { border: '1px solid #d1d5db', background: '#fff', color: '#374151' }
                }
              >
                <span
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 32, height: 32, background: active ? t.bg : '#f3f4f6' }}
                >
                  {t.svg}
                </span>
                <span className="text-center leading-tight text-xs">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scenario fields */}
      {question.type === 'case' && (
        <div className="space-y-3 rounded-xl p-4" style={{ background: '#F0F4FF', border: '1px solid #DBEAFE' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>Scenario Block</p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Scenario Narrative (what happened / the situation)</label>
            <textarea
              value={question.scenarioText ?? ''}
              onChange={e => onChange({ ...question, scenarioText: e.target.value || undefined })}
              placeholder="Describe the situation. e.g., 'A vendor offers you a gift worth ₹5,000 before a contract renewal...'"
              rows={4}
              maxLength={600}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Supporting Detail (optional)</label>
            <input
              type="text"
              value={question.supportingDetail ?? ''}
              onChange={e => onChange({ ...question, supportingDetail: e.target.value || undefined })}
              placeholder="e.g., '72% of employees face this situation annually'"
              maxLength={200}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            />
          </div>
        </div>
      )}

      {/* Question text */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
          {question.type === 'case' ? 'Decision Question (shown above options)' : 'Question'}
        </label>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder={question.type === 'case' ? 'e.g., "What should you do?"' : 'Enter your question...'}
          rows={2}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
        />
      </div>

      {/* Options */}
      {question.options && question.type !== 'rating' && question.type !== 'ranking' && (
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Options{hasCorrectAnswer(question.type) ? ' — click letter to mark correct' : ''}
          </label>
          <div className="space-y-2.5">
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasCorrectAnswer(question.type)}
                  onClick={() => hasCorrectAnswer(question.type) && onChange({ ...question, correctAnswer: String(i) })}
                  className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold transition-all ${
                    hasCorrectAnswer(question.type) ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={
                    question.correctAnswer === String(i)
                      ? { background: 'var(--color-primary)', color: '#fff' }
                      : { background: '#e5e7eb', color: '#4b5563' }
                  }
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  disabled={question.type === 'truefalse'}
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating scale preview */}
      {question.type === 'rating' && (
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Rating Scale (1-5 stars — participants will see this)</label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className="text-2xl" style={{ color: '#EA580C' }}>&#9733;</span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Participants will rate on a 1-5 star scale. No correct answer — results shown as average.</p>
        </div>
      )}

      {/* Ranking items editor */}
      {question.type === 'ranking' && (
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Items to Rank</label>
          <div className="space-y-2">
            {(question.options ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-500">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Item ${i + 1}`}
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...question, options: (question.options ?? []).filter((_, j) => j !== i) })}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
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
              className="mt-2 text-sm font-medium flex items-center gap-1 transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              + Add item
            </button>
          )}
        </div>
      )}

      {/* Timer + Points */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Timer</label>
          <select
            value={question.timerSeconds}
            onChange={e => onChange({ ...question, timerSeconds: Number(e.target.value) as Question['timerSeconds'] })}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          >
            {TIMER_OPTIONS.map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Points</label>
          <select
            value={question.points}
            onChange={e => onChange({ ...question, points: Number(e.target.value) as Question['points'] })}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          >
            {POINTS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Explanation / Debrief */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
          {question.type === 'case' ? 'Debrief / Expert Reasoning (revealed after host clicks "Reveal Debrief")' : 'Explanation (optional — shown after answer reveal)'}
        </label>
        <textarea
          value={question.explanation ?? ''}
          onChange={e => onChange({ ...question, explanation: e.target.value || undefined })}
          placeholder={question.type === 'case' ? 'Expert reasoning — what\'s the right call and why?' : 'Why is this the correct answer? (max ~300 chars)'}
          rows={2}
          maxLength={500}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
        />
      </div>

      {/* Advanced options */}
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(s => !s)}
          className="text-sm font-semibold flex items-center gap-2 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-50"
          style={{ color: showAdvanced ? 'var(--color-primary)' : '#6b7280' }}
        >
          <svg viewBox="0 0 16 16" fill="none" className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Advanced options</span>
        </button>
        {showAdvanced && (
          <div className="mt-3 pl-2">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Bloom&apos;s Taxonomy Level (optional)</label>
            <select
              value={question.bloomsLevel ?? ''}
              onChange={e => onChange({ ...question, bloomsLevel: (e.target.value as BloomsLevel) || undefined })}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            >
              <option value="">— not tagged —</option>
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

// ─── Main Builder Page ────────────────────────────────────────────────────────

function CreateQuizPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [tab, setTab] = useState<Tab>('manual')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [questions, setQuestions] = useState<Question[]>([makeQuestion()])
  const [saveError, setSaveError] = useState('')

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

  // Reset type mix when count changes
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
    setQuestions(prev => [...prev, makeQuestion()])
  }

  function updateQuestion(index: number, q: Question) {
    setQuestions(prev => prev.map((item, i) => i === index ? q : item))
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function duplicateQuestion(index: number) {
    const copy = { ...questions[index], id: crypto.randomUUID() }
    setQuestions(prev => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)])
  }

  function applyGeneratedQuestions(raw: Question[], forTab: Tab): Question[] {
    const withIds = raw.map(q => ({ ...q, id: crypto.randomUUID() }))
    setQuestions(withIds)
    setGeneratedOnTab(forTab)
    setSelectedQuestions(new Set(withIds.map(q => q.id)))
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

    // Tab-specific validation
    if (tab === 'aitopic' && !aiTopic.trim()) { setAiGenError('Enter a topic first'); return }
    if (tab === 'aiurl' && !aiUrl.startsWith('https://')) { setAiGenError('URL must start with https://'); return }
    if (tab === 'aidoc' && !docFile) { setAiGenError('Select a file first'); return }

    if (!typeMixValid) { setAiGenError(`Type mix must add up to ${aiCount} (currently ${typeMixSum})`); return }

    // Clear previous generation if re-generating
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

      // Update usage locally
      setAiUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev)

      // Auto-translate if non-English
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
        } catch { /* translation failed silently — quiz remains in English */ }
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

      // Re-translate if quiz was translated
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

  // ── Manual translate (post-generation language change) ──────────────────────

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

    // Save to localStorage (instant, offline-safe)
    saveQuiz(quizData)

    // Also persist to database (fire-and-forget — localStorage is the fallback)
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
        // Update localStorage with the DB-generated ID so session can reference it
        if (data?.id && data.id !== quizData.id) {
          saveQuiz({ ...quizData, id: data.id })
        }
      }
    } catch {
      // DB save failed silently — localStorage copy is the fallback
      console.error('[quiz-save] DB save failed, localStorage copy preserved')
    }

    router.push('/host')
  }

  // ── Sidebar stats ───────────────────────────────────────────────────────────

  const totalSeconds = questions.reduce((s, q) => s + q.timerSeconds, 0)
  const estMinutes = Math.max(1, Math.round(totalSeconds / 60))

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'manual',  label: 'Manual' },
    { id: 'aitopic', label: 'AI Topic' },
    { id: 'aiurl',   label: 'AI URL' },
    { id: 'aidoc',   label: 'AI Doc' },
    { id: 'library', label: 'Library' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFE] text-gray-900">

      {/* ── Title-first modal ── */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => router.push('/host')}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative"
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => router.push('/host')}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg"
              aria-label="Cancel"
            >
              x
            </button>
            <h2 className="text-xl font-black mb-1" style={{ color: '#1e1a14', fontFamily: 'var(--font-heading)' }}>
              name your quiz
            </h2>
            <p className="text-sm mb-6" style={{ color: '#a8a29e' }}>You can edit this any time.</p>
            <form onSubmit={handleModalSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Quiz title *"
                value={modalTitle}
                onChange={e => setModalTitle(e.target.value)}
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
              <input
                type="text"
                placeholder="Subject / tag (optional)"
                value={modalSubject}
                onChange={e => setModalSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
              <button
                type="submit"
                disabled={!modalTitle.trim()}
                className="w-full py-3 text-white font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--brand-gradient)' }}
              >
                Start building
              </button>
              <button
                type="button"
                onClick={() => router.push('/host')}
                className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/host')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <span className="text-xl font-bold">
          Quizo<span style={{ color: 'var(--color-primary)' }}>tic</span><span className="text-[10px] font-bold tracking-wide ml-0.5" style={{ color: '#9CA3AF', verticalAlign: 'super' }}>.live</span>
          <span className="ml-2 text-xs font-normal text-gray-500 uppercase tracking-widest">Create Quiz</span>
        </span>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6 items-start">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 sticky top-[73px] self-start max-h-[calc(100vh-90px)] bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-y-auto">
          <p className="text-sm font-bold text-gray-800 truncate mb-0.5">
            {title || 'Untitled Quiz'}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'} · ~{estMinutes} min
          </p>
          <div className="border-t border-gray-100 pt-3 space-y-1 flex-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-colors truncate"
              >
                <span className="font-bold text-gray-400 mr-1">Q{i + 1}</span>
                {q.text.slice(0, 32) || 'Untitled'}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 mt-3">
            <button
              onClick={addQuestion}
              className="w-full py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand-gradient)' }}
            >
              + Add Question
            </button>
          </div>
        </aside>

        {/* ── Editor ──────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-6">

          {/* Quiz meta */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Quiz title *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            />
            <input
              type="text"
              placeholder="Subject / tag (optional)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={
                  tab === t.id
                    ? { background: 'var(--brand-gradient)', color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
                    : { background: 'transparent', color: '#6b7280' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Manual Tab ── */}
          {tab === 'manual' && (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div
                  key={q.id}
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
                  className="cursor-grab active:cursor-grabbing"
                >
                  <QuestionCard
                    question={q}
                    index={i}
                    onChange={updated => updateQuestion(i, updated)}
                    onDelete={() => removeQuestion(i)}
                    onDuplicate={() => duplicateQuestion(i)}
                  />
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="w-full py-3 border border-dashed border-gray-300 text-gray-400 rounded-xl hover:border-violet-500 hover:text-violet-600 transition-colors text-sm"
              >
                + Add Question
              </button>
            </div>
          )}

          {/* ── From Library Tab ── */}
          {tab === 'library' && (
            <div className="space-y-3">
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
                    }}
                    className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all"
                  >
                    <p className="font-semibold text-sm text-gray-900">{quiz.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {quiz.questions.length} questions · {quiz.language ?? 'English'} · {new Date(quiz.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── AI Tabs (Topic / URL / Doc) — shared settings ── */}
          {isAiTab && (
            <div className="space-y-4">

              {/* Rate limit bar */}
              {aiUsage && (
                <div className="rounded-xl p-3 border border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700 font-medium">
                      AI Questions: {aiUsage.used} of {aiUsage.limit} used this month
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{aiUsage.plan} plan</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%`,
                        background: aiUsage.used >= aiUsage.limit ? '#EF4444' : aiUsage.used >= aiUsage.limit * 0.7 ? '#F59E0B' : 'var(--color-primary)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Tab-specific input */}
              {tab === 'aitopic' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Topic</label>
                  <input
                    type="text"
                    placeholder='e.g. "Indian Independence Movement"'
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TOPIC_SUGGESTIONS.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setAiTopic(chip)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'aiurl' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">URL (must start with https://)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/article"
                    value={aiUrl}
                    onChange={e => setAiUrl(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  />
                </div>
              )}

              {tab === 'aidoc' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Upload PDF or DOCX (max 5MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-600 file:text-sm"
                  />
                  {docFile && <p className="text-xs text-gray-500 mt-1">{docFile.name} ({(docFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
                </div>
              )}

              {/* ── Shared AI Settings ── */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                {settingsLocked && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Settings locked after generation.</p>
                    <button onClick={resetGeneration} className="text-xs text-violet-600 font-medium hover:underline">Start new</button>
                  </div>
                )}

                {/* Question count + Difficulty row */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Questions
                      {plan === 'free' && <span className="text-violet-500 ml-1 text-[10px]">(up to 25 with Pro)</span>}
                    </label>
                    <select
                      value={aiCount}
                      onChange={e => setAiCount(Number(e.target.value))}
                      disabled={settingsLocked}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {countOptions.map(n => (
                        <option key={n} value={n}>{n} questions</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Difficulty</label>
                    <select
                      value={aiDifficulty}
                      onChange={e => setAiDifficulty(e.target.value)}
                      disabled={settingsLocked}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {/* Type mix */}
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Question type breakdown</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_MIX_LABELS.map(({ key, label, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{label}</span>
                        <select
                          value={typeMix[key]}
                          onChange={e => handleTypeMixChange(key, Number(e.target.value))}
                          disabled={settingsLocked}
                          className="w-16 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {Array.from({ length: maxForType(key) + 1 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium ${typeMixValid ? 'text-green-600' : 'text-amber-600'}`}>
                      Total: {typeMixSum}/{aiCount}
                    </span>
                    {typeMixValid && <span className="text-green-500 text-xs">&#10003;</span>}
                    {!typeMixValid && <span className="text-amber-500 text-xs">({aiCount - typeMixSum} remaining)</span>}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Language</label>
                  <div className="flex gap-2">
                    <select
                      value={quizLanguage}
                      onChange={e => setQuizLanguage(e.target.value)}
                      className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                    >
                      {GLOBAL_LANGUAGES.map(({ lang }) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    {/* Show translate button if language changed post-generation */}
                    {generatedOnTab && quizLanguage !== 'English' && quizLanguage !== translatedTo && (
                      <button
                        onClick={handleManualTranslate}
                        disabled={translating}
                        className="px-4 py-2 rounded-xl text-xs font-bold border-2 transition-colors disabled:opacity-40 whitespace-nowrap"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: '#F0F4FF' }}
                      >
                        {translating ? 'Translating...' : 'Translate'}
                      </button>
                    )}
                  </div>
                  {translatedTo && (
                    <p className="text-xs text-green-600 font-medium mt-1">Translated to {translatedTo}</p>
                  )}
                </div>
              </div>

              {/* Error banner */}
              {aiGenError && (
                <div className="rounded-xl p-4 border" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                  <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>{aiGenError}</p>
                  {aiGenError.includes('Upgrade') && (
                    <button
                      onClick={() => router.push('/host/billing')}
                      className="mt-2 text-sm font-bold px-4 py-1.5 rounded-lg text-white"
                      style={{ background: '#4361EE' }}
                    >
                      View Pro Plans
                    </button>
                  )}
                </div>
              )}

              {/* Generate button */}
              {!generatedOnTab && (
                <button
                  onClick={handleGenerate}
                  disabled={aiGenerating || !typeMixValid}
                  className="w-full py-4 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--brand-gradient)' }}
                >
                  {aiGenerating
                    ? 'Generating...'
                    : translating
                      ? 'Translating...'
                      : tab === 'aiurl'
                        ? 'Fetch & Generate'
                        : tab === 'aidoc'
                          ? 'Generate from Document'
                          : 'Generate Questions'}
                </button>
              )}

              {/* Generated questions */}
              {generatedOnTab && (
                <div className="space-y-4 mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Generated {questions.length} questions — edit, deselect to replace, then save.</p>
                    {deselectedCount > 0 && (
                      <button
                        onClick={handleSelectiveRegenerate}
                        disabled={aiGenerating}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--brand-gradient)' }}
                      >
                        {aiGenerating ? 'Regenerating...' : `Regenerate ${deselectedCount} question${deselectedCount > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                  {questions.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={i}
                      onChange={u => updateQuestion(i, u)}
                      onDelete={() => removeQuestion(i)}
                      onDuplicate={() => duplicateQuestion(i)}
                      selectable
                      selected={selectedQuestions.has(q.id)}
                      onToggleSelect={() => toggleSelect(q.id)}
                    />
                  ))}
                  <button
                    onClick={addQuestion}
                    className="w-full py-3 border border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-violet-500 hover:text-violet-600 transition-colors text-sm font-medium"
                  >
                    + Add Question
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Save ── */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            <button
              onClick={handleSave}
              className="w-full py-4 text-white font-bold text-lg rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: 'var(--brand-gradient)' }}
            >
              Save Quiz
            </button>
          </div>

        </main>
      </div>
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
