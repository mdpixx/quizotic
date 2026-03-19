'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveQuiz } from '@/lib/quiz-storage'
import type { Question, QuestionType } from '@/lib/quiz-types'

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc'

const TIMER_OPTIONS: (10 | 15 | 20 | 30 | 60)[] = [10, 15, 20, 30, 60]
const POINTS_OPTIONS: (500 | 1000 | 2000)[] = [500, 1000, 2000]
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'truefalse', label: 'True / False' },
  { value: 'poll', label: 'Poll' },
  { value: 'openended', label: 'Open-ended' },
  { value: 'wordcloud', label: 'Word Cloud' },
  { value: 'qa', label: 'Q&A' },
  { value: 'rating', label: 'Rating' },
  { value: 'ranking', label: 'Ranking' },
]

const INDIAN_LANGUAGES = [
  'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi',
  'Kannada', 'Gujarati', 'Malayalam', 'Punjabi', 'Odia',
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
}: {
  question: Question
  index: number
  onChange: (q: Question) => void
  onDelete: () => void
}) {
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
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Q{index + 1}</span>
        <button onClick={onDelete} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Remove</button>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Question Type</label>
        <select
          value={question.type}
          onChange={e => handleTypeChange(e.target.value as QuestionType)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
        >
          {QUESTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Question text */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Question</label>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder="Enter your question..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 resize-none"
        />
      </div>

      {/* Options */}
      {question.options && question.type !== 'rating' && question.type !== 'ranking' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">
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
                    question.correctAnswer === String(i)
                      ? 'bg-lime-400 text-zinc-950'
                      : 'bg-zinc-700 text-zinc-400'
                  } ${hasCorrectAnswer(question.type) ? 'cursor-pointer hover:bg-zinc-600' : 'cursor-default'}`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  disabled={question.type === 'truefalse'}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer + Points */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-zinc-500 mb-1 block">Timer</label>
          <select
            value={question.timerSeconds}
            onChange={e => onChange({ ...question, timerSeconds: Number(e.target.value) as Question['timerSeconds'] })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
          >
            {TIMER_OPTIONS.map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-zinc-500 mb-1 block">Points</label>
          <select
            value={question.points}
            onChange={e => onChange({ ...question, points: Number(e.target.value) as Question['points'] })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
          >
            {POINTS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
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

  // AI generated flag (controls display in AI tabs — prevents blank card from Manual tab)
  const [aiGenerated, setAiGenerated] = useState(false)

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

  function setGeneratedQuestions(raw: Question[]) {
    const withIds = raw.map(q => ({ ...q, id: crypto.randomUUID() }))
    setQuestions(withIds)
    setAiGenerated(true)
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
      setGeneratedQuestions(data)
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
      setGeneratedQuestions(data)
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
      setGeneratedQuestions(data)
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

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'manual', label: '✏️ Manual' },
    { id: 'aitopic', label: '✨ AI Topic' },
    { id: 'aiurl', label: '🔗 AI URL' },
    { id: 'aidoc', label: '📄 AI Doc' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Create Quiz</span>
        </span>
        <button onClick={() => router.push('/host')} className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Library
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Quiz meta */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Quiz title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-lime-400"
          />
          <input
            type="text"
            placeholder="Subject / tag (optional)"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-lime-400 text-lime-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
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
                />
              </div>
            ))}
            <button
              onClick={addQuestion}
              className="w-full py-3 border border-dashed border-zinc-700 text-zinc-400 rounded-xl hover:border-lime-400 hover:text-lime-400 transition-colors text-sm"
            >
              + Add Question
            </button>
          </div>
        )}

        {/* ── AI Topic Tab ── */}
        {tab === 'aitopic' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Topic</label>
              <input
                type="text"
                placeholder='e.g. "Indian Independence Movement"'
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Questions</label>
                <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400">
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Difficulty</label>
                <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400">
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
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? 'Generating...' : '✨ Generate Questions'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI URL Tab ── */}
        {tab === 'aiurl' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">URL (must start with https://)</label>
              <input
                type="url"
                placeholder="https://example.com/article"
                value={aiUrl}
                onChange={e => setAiUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
              />
            </div>
            {urlError && <p className="text-red-400 text-sm">{urlError}</p>}
            <button
              onClick={handleUrlGenerate}
              disabled={urlLoading}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {urlLoading ? 'Fetching & Generating...' : '🔗 Fetch & Generate'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI Doc Tab ── */}
        {tab === 'aidoc' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Upload PDF or DOCX (max 5MB)</label>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-300 file:text-sm"
              />
              {docFile && <p className="text-xs text-zinc-500 mt-1">{docFile.name} ({(docFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
            {docError && <p className="text-red-400 text-sm">{docError}</p>}
            <button
              onClick={handleDocGenerate}
              disabled={docLoading || !docFile}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {docLoading ? 'Reading & Generating...' : '📄 Generate from Document'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Translate Section (all tabs) ── */}
        <div className="border-t border-zinc-800 pt-6 space-y-3">
          <p className="text-sm font-medium text-zinc-300">Translate Quiz (optional)</p>
          <div className="flex gap-3">
            <select
              value={translateLang}
              onChange={e => setTranslateLang(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
            >
              {INDIAN_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
            <button
              onClick={handleTranslate}
              disabled={translateLoading}
              className="px-6 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:border-lime-400 hover:text-lime-400 transition-colors text-sm disabled:opacity-50"
            >
              {translateLoading ? 'Translating...' : 'Translate'}
            </button>
          </div>
          {translateError && <p className="text-red-400 text-sm">{translateError}</p>}
        </div>

        {/* ── Save ── */}
        <div className="border-t border-zinc-800 pt-6 space-y-3">
          {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
          <button
            onClick={handleSave}
            className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
          >
            Save Quiz
          </button>
        </div>

      </main>
    </div>
  )
}
