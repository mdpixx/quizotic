'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveQuiz } from '@/lib/quiz-storage'
import type { Question, QuestionType, BloomsLevel } from '@/lib/quiz-types'

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc'

const TIMER_OPTIONS: (10 | 15 | 20 | 30 | 60)[] = [10, 15, 20, 30, 60]
const POINTS_OPTIONS: (500 | 1000 | 2000)[] = [500, 1000, 2000]

const TYPE_PILLS: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'mcq',       label: 'Multiple Choice', icon: '☑' },
  { value: 'truefalse', label: 'True / False',    icon: '✓✗' },
  { value: 'poll',      label: 'Poll',            icon: '◉' },
  { value: 'openended', label: 'Open-ended',      icon: '✎' },
  { value: 'wordcloud', label: 'Word Cloud',      icon: '☁' },
  { value: 'qa',        label: 'Q&A',             icon: '?' },
  { value: 'rating',    label: 'Rating',          icon: '★' },
  { value: 'ranking',   label: 'Ranking',         icon: '▲' },
  { value: 'case',      label: 'Scenario',        icon: '⬡' },
]

const TOPIC_SUGGESTIONS = [
  'Indian History', 'Science & Space', 'Sports', 'General Knowledge',
  'Current Affairs', 'Technology', 'Geography', 'Bollywood',
]

const GLOBAL_LANGUAGES: { lang: string }[] = [
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
}: {
  question: Question
  index: number
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
    options[i] = value
    onChange({ ...question, options })
  }

  return (
    <div id={`q-${question.id}`} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Q{index + 1}</span>
        <div className="flex gap-3">
          <button onClick={onDuplicate} className="text-xs text-gray-400 hover:text-violet-600 transition-colors">Duplicate</button>
          <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
        </div>
      </div>

      {/* Type pills */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">Question Type</label>
        <div className="grid grid-cols-4 gap-2">
          {TYPE_PILLS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              className="flex flex-col items-center px-2 py-2 rounded-xl text-xs font-medium transition-all"
              style={
                question.type === t.value
                  ? { border: '2px solid #7C3AED', background: '#F3EEFF', color: '#4C1D95' }
                  : { border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280' }
              }
            >
              <span className="text-base leading-none mb-1">{t.icon}</span>
              <span className="text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario fields — only for 'case' type */}
      {question.type === 'case' && (
        <div className="space-y-3 rounded-xl p-4" style={{ background: '#F3EEFF', border: '1px solid #E9E2FF' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7C3AED' }}>Scenario Block</p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Scenario Narrative (what happened / the situation)</label>
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
            <label className="text-xs text-gray-500 mb-1 block">Supporting Detail (optional — bold callout, stat, or quote)</label>
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
        <label className="text-xs text-gray-500 mb-1 block">
          {question.type === 'case' ? 'Decision Question (shown above options)' : 'Question'}
        </label>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder={question.type === 'case' ? 'e.g., "What should you do?"' : 'Enter your question...'}
          rows={2}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
        />
      </div>

      {/* Options */}
      {question.options && question.type !== 'rating' && question.type !== 'ranking' && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Options{hasCorrectAnswer(question.type) ? ' — click letter to mark correct' : ''}
          </label>
          <div className="space-y-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasCorrectAnswer(question.type)}
                  onClick={() => hasCorrectAnswer(question.type) && onChange({ ...question, correctAnswer: String(i) })}
                  className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                    hasCorrectAnswer(question.type) ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={
                    question.correctAnswer === String(i)
                      ? { background: '#7C3AED', color: '#fff' }
                      : { background: '#e5e7eb', color: '#6b7280' }
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
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer + Points */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Timer</label>
          <select
            value={question.timerSeconds}
            onChange={e => onChange({ ...question, timerSeconds: Number(e.target.value) as Question['timerSeconds'] })}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          >
            {TIMER_OPTIONS.map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Points</label>
          <select
            value={question.points}
            onChange={e => onChange({ ...question, points: Number(e.target.value) as Question['points'] })}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          >
            {POINTS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Explanation / Debrief */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          {question.type === 'case' ? 'Debrief / Expert Reasoning (revealed after host clicks "Reveal Debrief")' : 'Explanation (optional — shown after answer reveal)'}
        </label>
        <textarea
          value={question.explanation ?? ''}
          onChange={e => onChange({ ...question, explanation: e.target.value || undefined })}
          placeholder={question.type === 'case' ? 'Expert reasoning — what\'s the right call and why?' : 'Why is this the correct answer? (max ~300 chars)'}
          rows={2}
          maxLength={500}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
        />
      </div>

      {/* Advanced options (Bloom's Level) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(s => !s)}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: showAdvanced ? '#7C3AED' : '#9ca3af' }}
        >
          <span>{showAdvanced ? '▾' : '▸'}</span>
          <span>Advanced options</span>
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <label className="text-xs text-gray-500 mb-1 block">Bloom&apos;s Level (optional)</label>
            <select
              value={question.bloomsLevel ?? ''}
              onChange={e => onChange({ ...question, bloomsLevel: (e.target.value as BloomsLevel) || undefined })}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
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

export default function CreateQuizPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('manual')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [questions, setQuestions] = useState<Question[]>([makeQuestion()])
  const [saveError, setSaveError] = useState('')

  // AI Topic state
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // AI URL state
  const [aiUrl, setAiUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  // AI Doc state
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')

  // Translate state
  const [translateLang, setTranslateLang] = useState('Hindi')
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translatedTo, setTranslatedTo] = useState<string | null>(null)

  // Per-tab generated flag
  const [generatedOnTab, setGeneratedOnTab] = useState<Tab | null>(null)

  // Title-first modal (shown on fresh new quiz, hidden after title is set)
  const [showTitleModal, setShowTitleModal] = useState(true)
  const [modalTitle, setModalTitle] = useState('')
  const [modalSubject, setModalSubject] = useState('')

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modalTitle.trim()) return
    setTitle(modalTitle.trim())
    if (modalSubject.trim()) setSubject(modalSubject.trim())
    setShowTitleModal(false)
  }

  // Drag-to-reorder ref
  const dragIndex = useRef<number | null>(null)

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

  function setGeneratedQuestions(raw: Question[], forTab: Tab) {
    const withIds = raw.map(q => ({ ...q, id: crypto.randomUUID() }))
    setQuestions(withIds)
    setGeneratedOnTab(forTab)
  }

  // ── AI Topic generate ───────────────────────────────────────────────────────

  async function handleAiTopicGenerate() {
    if (!aiTopic.trim()) { setAiError('Enter a topic first'); return }
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'topic', topic: aiTopic, questionCount: aiCount, difficulty: aiDifficulty }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data, 'aitopic')
    } catch {
      setAiError('Network error. Try again.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI URL generate ─────────────────────────────────────────────────────────

  async function handleUrlGenerate() {
    if (!aiUrl.startsWith('https://')) { setUrlError('URL must start with https://'); return }
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'url', url: aiUrl, questionCount: 5, difficulty: 'medium' }),
      })
      const data = await res.json()
      if (!res.ok) { setUrlError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data, 'aiurl')
    } catch {
      setUrlError('Network error. Try again.')
    } finally {
      setUrlLoading(false)
    }
  }

  // ── AI Doc generate ─────────────────────────────────────────────────────────

  async function handleDocGenerate() {
    if (!docFile) { setDocError('Select a file first'); return }
    setDocLoading(true)
    setDocError('')
    try {
      const formData = new FormData()
      formData.append('file', docFile)
      formData.append('questionCount', '5')
      formData.append('difficulty', 'medium')
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { setDocError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data, 'aidoc')
    } catch {
      setDocError('Network error. Try again.')
    } finally {
      setDocLoading(false)
    }
  }

  // ── Translate ───────────────────────────────────────────────────────────────

  async function handleTranslate() {
    if (questions.length === 0) { setTranslateError('No questions to translate'); return }
    setTranslateLoading(true)
    setTranslateError('')
    try {
      const res = await fetch('/api/translate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, targetLanguage: translateLang }),
      })
      const data = await res.json()
      if (!res.ok) { setTranslateError(data.error ?? 'Translation failed'); return }
      setQuestions(data)
      setTranslatedTo(translateLang)
    } catch {
      setTranslateError('Network error. Try again.')
    } finally {
      setTranslateLoading(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!title.trim()) { setSaveError('Quiz title is required'); return }
    if (questions.length === 0) { setSaveError('Add at least one question'); return }
    setSaveError('')

    const now = new Date().toISOString()
    saveQuiz({
      id: crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim() || undefined,
      language: translatedTo ?? 'English',
      createdAt: now,
      updatedAt: now,
      questions,
    })
    router.push('/host')
  }

  // ── Sidebar stats ───────────────────────────────────────────────────────────

  const totalSeconds = questions.reduce((s, q) => s + q.timerSeconds, 0)
  const estMinutes = Math.max(1, Math.round(totalSeconds / 60))

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'manual',  label: '✏️ Manual' },
    { id: 'aitopic', label: '✨ AI Topic' },
    { id: 'aiurl',   label: '🔗 AI URL' },
    { id: 'aidoc',   label: '📄 AI Doc' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFE] text-gray-900">

      {/* ── Title-first modal ── */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
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
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
              >
                Start building →
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span style={{ color: '#7C3AED' }}>tic</span>
          <span className="ml-2 text-xs font-normal text-gray-500 uppercase tracking-widest">Create Quiz</span>
        </span>
        <button onClick={() => router.push('/host')} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          ← Library
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 items-start">

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
              style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
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
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Subject / tag (optional)"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
              <select
                value={translateLang}
                onChange={e => setTranslateLang(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                title="Language for translation"
              >
                <option value="">No translation</option>
                {GLOBAL_LANGUAGES.map(({ lang }) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
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
                    ? { background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
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

          {/* ── AI Topic Tab ── */}
          {tab === 'aitopic' && (
            <div className="space-y-4">
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
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Questions</label>
                  <select
                    value={aiCount}
                    onChange={e => setAiCount(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Difficulty</label>
                  <select
                    value={aiDifficulty}
                    onChange={e => setAiDifficulty(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
              <button
                onClick={handleAiTopicGenerate}
                disabled={aiLoading}
                className="w-full py-4 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
              >
                {aiLoading ? 'Generating...' : '✨ Generate Questions'}
              </button>
              {generatedOnTab === 'aitopic' && (
                <div className="space-y-4 mt-2">
                  <p className="text-xs text-gray-500">Generated — edit before saving:</p>
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} question={q} index={i}
                      onChange={u => updateQuestion(i, u)}
                      onDelete={() => removeQuestion(i)}
                      onDuplicate={() => duplicateQuestion(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI URL Tab ── */}
          {tab === 'aiurl' && (
            <div className="space-y-4">
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
              {urlError && <p className="text-red-400 text-sm">{urlError}</p>}
              <button
                onClick={handleUrlGenerate}
                disabled={urlLoading}
                className="w-full py-4 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
              >
                {urlLoading ? 'Fetching & Generating...' : '🔗 Fetch & Generate'}
              </button>
              {generatedOnTab === 'aiurl' && (
                <div className="space-y-4 mt-2">
                  <p className="text-xs text-gray-500">Generated — edit before saving:</p>
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} question={q} index={i}
                      onChange={u => updateQuestion(i, u)}
                      onDelete={() => removeQuestion(i)}
                      onDuplicate={() => duplicateQuestion(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI Doc Tab ── */}
          {tab === 'aidoc' && (
            <div className="space-y-4">
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
              {docError && <p className="text-red-400 text-sm">{docError}</p>}
              <button
                onClick={handleDocGenerate}
                disabled={docLoading || !docFile}
                className="w-full py-4 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
              >
                {docLoading ? 'Reading & Generating...' : '📄 Generate from Document'}
              </button>
              {generatedOnTab === 'aidoc' && (
                <div className="space-y-4 mt-2">
                  <p className="text-xs text-gray-500">Generated — edit before saving:</p>
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} question={q} index={i}
                      onChange={u => updateQuestion(i, u)}
                      onDelete={() => removeQuestion(i)}
                      onDuplicate={() => duplicateQuestion(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Translate Section ── */}
          {translateLang && (
            <div className="border-t border-gray-100 pt-5">
              <button
                onClick={handleTranslate}
                disabled={translateLoading || questions.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-50"
                style={{ borderColor: '#7C3AED', color: '#7C3AED', background: '#F3EEFF' }}
              >
                {translateLoading ? `Translating to ${translateLang}...` : `Translate quiz to ${translateLang} →`}
              </button>
              {translateError && <p className="text-red-400 text-sm mt-2">{translateError}</p>}
            </div>
          )}

          {/* ── Save ── */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            <button
              onClick={handleSave}
              className="w-full py-4 text-white font-bold text-lg rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
            >
              Save Quiz
            </button>
          </div>

        </main>
      </div>
    </div>
  )
}
