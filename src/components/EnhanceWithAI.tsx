'use client'

import React, { useEffect, useState } from 'react'
import {
  type Slide, type SlideType, type Presentation,
  SLIDE_TYPE_META, makeSlide,
} from '@/lib/presentation-types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AiSuggestion {
  afterSlideIndex: number
  type: string
  slideData: Record<string, unknown>
  rationale: string
}

interface EnhanceResult {
  afterIndex: number
  slide: Slide
  keepOriginal: boolean
}

interface EnhanceWithAIProps {
  presentation: Presentation
  onComplete: (results: EnhanceResult[]) => void
  onCancel: () => void
}

type Step = 'level' | 'analyzing' | 'review' | 'done'
type Level = 'light' | 'moderate' | 'heavy' | 'custom'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSlideTextContent(slide: Slide): string {
  // Use hidden AI context from PPTX import if available (extracted text from original slides)
  const aiContext = (slide as unknown as Record<string, unknown>)._aiContext as string | undefined
  if (aiContext) return aiContext

  switch (slide.type) {
    case 'title': return `${slide.heading} ${slide.subheading}`.trim()
    case 'bullets': return `${slide.heading} ${slide.bullets.join(' ')}`.trim()
    case 'image': return slide.caption
    case 'quote': return `${slide.quote} — ${slide.attribution}`.trim()
    default: return ''
  }
}

function suggestionToSlide(suggestion: AiSuggestion): Slide {
  const type = suggestion.type as SlideType
  const base = makeSlide(type)
  const data = suggestion.slideData

  switch (type) {
    case 'multiple_choice':
      return {
        ...base,
        question: (data.question as string) || '',
        options: Array.isArray(data.options) ? data.options.slice(0, 4).map(String) : ['', '', '', ''],
        showCorrect: data.showCorrect === true,
        correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : undefined,
      } as Slide
    case 'open_text':
      return {
        ...base,
        question: (data.question as string) || '',
        maxChars: typeof data.maxChars === 'number' ? data.maxChars : 200,
      } as Slide
    case 'word_cloud':
      return {
        ...base,
        question: (data.question as string) || '',
        maxWords: typeof data.maxWords === 'number' ? data.maxWords : 1,
      } as Slide
    case 'rating_scale':
      return {
        ...base,
        question: (data.question as string) || '',
        minLabel: (data.minLabel as string) || 'Not at all',
        maxLabel: (data.maxLabel as string) || 'Extremely',
        maxRating: [5, 7, 10].includes(data.maxRating as number) ? (data.maxRating as 5 | 7 | 10) : 5,
      } as Slide
    case 'ranking':
      return {
        ...base,
        question: (data.question as string) || '',
        items: Array.isArray(data.items) ? data.items.map(String) : ['', '', ''],
      } as Slide
    case 'word_duel':
      return {
        ...base,
        question: (data.question as string) || '',
        optionA: (data.optionA as string) || '',
        optionB: (data.optionB as string) || '',
      } as Slide
    case 'emoji_pulse':
      return {
        ...base,
        question: (data.question as string) || '',
        emojis: Array.isArray(data.emojis) ? data.emojis.slice(0, 4).map(String) : ['👍', '👎', '🤔', '🔥'],
      } as Slide
    case 'quick_fire':
      return {
        ...base,
        question: (data.question as string) || '',
        options: Array.isArray(data.options) ? data.options.slice(0, 4).map(String) : ['', '', '', ''],
        durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : 10,
      } as Slide
    default:
      return base
  }
}

function getContentSlideCount(presentation: Presentation): number {
  return presentation.slides.filter(s =>
    ['title', 'bullets', 'image', 'quote'].includes(s.type)
    && getSlideTextContent(s).length > 10
  ).length
}

function getEstimate(contentCount: number, level: Level): number {
  switch (level) {
    case 'light': return Math.max(1, Math.round(contentCount * 0.12))
    case 'moderate': return Math.max(1, Math.round(contentCount * 0.25))
    case 'heavy': return Math.max(2, Math.round(contentCount * 0.4))
    case 'custom': return Math.max(1, Math.min(contentCount, Math.round(contentCount * 0.5)))
  }
}

// ─── Level options ───────────────────────────────────────────────────────────

const LEVELS: { id: Level; label: string; desc: string; ratio: string }[] = [
  { id: 'light', label: 'Light', desc: 'Quick check-ins', ratio: '~10%' },
  { id: 'moderate', label: 'Moderate', desc: 'Active learning', ratio: '~25%' },
  { id: 'heavy', label: 'Heavy', desc: 'Highly engaging', ratio: '~40%' },
  { id: 'custom', label: 'Custom', desc: "I'll choose", ratio: 'All' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function EnhanceWithAI({ presentation, onComplete, onCancel }: EnhanceWithAIProps) {
  const [step, setStep] = useState<Step>('level')
  const [level, setLevel] = useState<Level>('moderate')
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [accepted, setAccepted] = useState<EnhanceResult[]>([])
  const [keepOriginals, setKeepOriginals] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null)

  const contentCount = getContentSlideCount(presentation)
  const estimate = getEstimate(contentCount, level)
  const limitReached = usageInfo !== null && usageInfo.limit !== Infinity && usageInfo.used >= usageInfo.limit

  useEffect(() => {
    let cancelled = false
    fetch('/api/enhance-presentation/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.success) return
        // JSON serializes Infinity → null; restore it
        const limit = (d.limit === null || d.limit === undefined) ? Infinity : d.limit
        setUsageInfo({ used: d.used, limit })
      })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [])

  // ── Step 1: Analyze ──

  async function analyze() {
    setStep('analyzing')
    setError('')

    const slideInputs = presentation.slides
      .map((s, i) => ({
        index: i,
        type: s.type,
        textContent: getSlideTextContent(s),
      }))
      .filter(s => s.textContent.length > 10)

    try {
      const res = await fetch('/api/enhance-presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: slideInputs, level }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to generate suggestions')
        setStep('level')
        return
      }

      setSuggestions(data.suggestions)
      if (data.usage) setUsageInfo(data.usage)

      // Initialize keepOriginals — all checked by default
      const ko: Record<number, boolean> = {}
      data.suggestions.forEach((_: unknown, i: number) => { ko[i] = true })
      setKeepOriginals(ko)

      setReviewIndex(0)
      setAccepted([])
      setStep('review')
    } catch {
      setError('Network error. Please try again.')
      setStep('level')
    }
  }

  // ── Step 3: Accept / Skip ──

  function acceptCurrent() {
    const sug = suggestions[reviewIndex]
    const slide = suggestionToSlide(sug)
    setAccepted(prev => [...prev, {
      afterIndex: sug.afterSlideIndex,
      slide,
      keepOriginal: keepOriginals[reviewIndex] ?? true,
    }])
    if (reviewIndex < suggestions.length - 1) {
      setReviewIndex(prev => prev + 1)
    } else {
      setStep('done')
    }
  }

  function skipCurrent() {
    if (reviewIndex < suggestions.length - 1) {
      setReviewIndex(prev => prev + 1)
    } else {
      setStep('done')
    }
  }

  function toggleKeepOriginal() {
    setKeepOriginals(prev => ({ ...prev, [reviewIndex]: !prev[reviewIndex] }))
  }

  // ── Step 4: Done ──

  function finish() {
    onComplete(accepted)
  }

  // ── Render ──

  const currentSuggestion = suggestions[reviewIndex]
  const originalSlide = currentSuggestion ? presentation.slides[currentSuggestion.afterSlideIndex] : null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="#4F46E5" className="w-4 h-4">
              <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zM3 11l.75 1.75L5.5 13.5l-1.75.75L3 16l-.75-1.75L.5 13.5l1.75-.75L3 11z"/>
            </svg>
            <h2 className="text-base font-bold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
              {step === 'level' && 'Enhance with AI'}
              {step === 'analyzing' && 'Analyzing slides...'}
              {step === 'review' && `Review (${reviewIndex + 1} of ${suggestions.length})`}
              {step === 'done' && 'Enhancement Complete'}
            </h2>
          </div>
          <button onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 text-sm">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>

          {/* ── STEP: Level Selector ── */}
          {step === 'level' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0F1B3D' }}>
                  How interactive should your session be?
                </p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  {contentCount} content slide{contentCount !== 1 ? 's' : ''} found
                </p>
                {usageInfo && (
                  <p className="text-xs mt-1" style={{ color: limitReached ? '#DC2626' : '#94A3B8' }}>
                    AI enhancements this month: {usageInfo.used}/{usageInfo.limit === Infinity ? 'unlimited' : usageInfo.limit}
                    {limitReached && (
                      <>
                        {' — '}
                        <a href="/pricing" className="font-semibold underline" style={{ color: '#4F46E5' }}>
                          Upgrade to Pro
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {LEVELS.map(opt => (
                  <button key={opt.id} onClick={() => setLevel(opt.id)}
                    className="rounded-xl p-3 border-2 text-left transition-all"
                    style={{
                      borderColor: level === opt.id ? '#4F46E5' : '#E2E8F0',
                      background: level === opt.id ? '#EEF2FF' : '#fff',
                    }}>
                    <p className="text-sm font-bold" style={{ color: level === opt.id ? '#4F46E5' : '#0F1B3D' }}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>
                      {opt.desc}
                    </p>
                    <p className="text-[10px] font-semibold mt-1" style={{ color: '#94A3B8' }}>
                      {opt.ratio}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  ~{estimate} interactive slide{estimate !== 1 ? 's' : ''} will be suggested
                </p>
                <button onClick={analyze}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ background: '#4F46E5', color: '#fff' }}
                  disabled={contentCount === 0 || limitReached}>
                  {limitReached ? 'Limit Reached' : 'Analyze Slides'}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
              )}
            </div>
          )}

          {/* ── STEP: Analyzing ── */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-3 rounded-full animate-spin"
                style={{ borderColor: '#E2E8F0', borderTopColor: '#4F46E5', borderWidth: 3 }} />
              <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>
                Analyzing your slides...
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                AI is reading your content and designing interactive moments
              </p>
            </div>
          )}

          {/* ── STEP: Review ── */}
          {step === 'review' && currentSuggestion && originalSlide && (
            <div className="space-y-4">
              {/* Side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original slide */}
                <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#E2E8F0', background: '#FAFBFC' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                    Original — Slide {currentSuggestion.afterSlideIndex + 1}
                  </p>
                  <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                    {originalSlide.type === 'title' ? originalSlide.heading
                      : originalSlide.type === 'bullets' ? originalSlide.heading
                      : originalSlide.type === 'image' ? originalSlide.caption
                      : originalSlide.type === 'quote' ? originalSlide.quote
                      : '(Slide content)'}
                  </p>
                  {originalSlide.type === 'bullets' && (
                    <ul className="text-xs space-y-1" style={{ color: '#374151' }}>
                      {originalSlide.bullets.filter(Boolean).slice(0, 5).map((b, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span style={{ color: '#94A3B8' }}>-</span>
                          <span>{b}</span>
                        </li>
                      ))}
                      {originalSlide.bullets.filter(Boolean).length > 5 && (
                        <li className="text-xs" style={{ color: '#94A3B8' }}>
                          +{originalSlide.bullets.filter(Boolean).length - 5} more...
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Suggested interactivity */}
                <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#C7D2FE', background: '#EEF2FF' }}>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4F46E5' }}>
                      Add After
                    </p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: SLIDE_TYPE_META[currentSuggestion.type as SlideType]?.color || '#4F46E5', color: '#fff' }}>
                      {SLIDE_TYPE_META[currentSuggestion.type as SlideType]?.label || currentSuggestion.type}
                    </span>
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                    {(currentSuggestion.slideData.question as string) || ''}
                  </p>
                  {/* Show options if applicable */}
                  {Array.isArray(currentSuggestion.slideData.options) ? (
                    <div className="space-y-1">
                      {(currentSuggestion.slideData.options as string[]).map((opt, i) => (
                        <div key={i} className="text-xs flex items-center gap-1.5" style={{ color: '#374151' }}>
                          <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: '#fff', color: '#4F46E5' }}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(currentSuggestion.slideData.items) ? (
                    <div className="space-y-1">
                      {(currentSuggestion.slideData.items as string[]).map((item, i) => (
                        <div key={i} className="text-xs" style={{ color: '#374151' }}>
                          {i + 1}. {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {currentSuggestion.slideData.optionA ? (
                    <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#374151' }}>
                      <span className="px-2 py-1 rounded-lg" style={{ background: '#fff' }}>
                        {currentSuggestion.slideData.optionA as string}
                      </span>
                      <span style={{ color: '#94A3B8' }}>vs</span>
                      <span className="px-2 py-1 rounded-lg" style={{ background: '#fff' }}>
                        {currentSuggestion.slideData.optionB as string}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Keep original checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={keepOriginals[reviewIndex] ?? true}
                  onChange={toggleKeepOriginal}
                  className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>
                  Keep original slide
                </span>
              </label>

              {/* AI rationale */}
              {currentSuggestion.rationale && (
                <div className="rounded-lg p-3" style={{ background: '#F8FAFC' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>
                    Why this interactivity
                  </p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    {currentSuggestion.rationale}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <button onClick={skipCurrent}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:bg-gray-100"
                  style={{ color: '#6B7280' }}>
                  Skip
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={acceptCurrent}
                    className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                    style={{ background: '#4F46E5', color: '#fff' }}>
                    Accept
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full w-full" style={{ background: '#E2E8F0' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${((reviewIndex + 1) / suggestions.length) * 100}%`, background: '#4F46E5' }} />
              </div>
            </div>
          )}

          {/* ── STEP: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-8 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: '#F0FDF4' }}>
                <svg viewBox="0 0 20 20" fill="#16A34A" className="w-6 h-6">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: '#0F1B3D' }}>
                  {accepted.length > 0 ? 'Enhancement Complete' : 'No slides added'}
                </p>
                {accepted.length > 0 && (
                  <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                    {accepted.length} interactive slide{accepted.length !== 1 ? 's' : ''} will be added
                  </p>
                )}
                {suggestions.length - accepted.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                    {suggestions.length - accepted.length} skipped
                  </p>
                )}
              </div>
              {usageInfo && (
                <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                  AI usage: {usageInfo.used}/{usageInfo.limit === Infinity ? 'unlimited' : usageInfo.limit} this month
                </p>
              )}
              <button onClick={finish}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: '#4F46E5', color: '#fff' }}>
                {accepted.length > 0 ? 'Done — Back to Builder' : 'Close'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
