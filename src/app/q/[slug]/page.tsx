'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { use } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type QuestionOption = string | { text: string; imageUrl?: string }

interface PublicQuestion {
  index: number
  total: number
  type: string
  text: string
  imageUrl?: string
  options?: QuestionOption[]
  timerSeconds: number
  points: number
  explanation?: string
}

type Phase = 'loading' | 'closed' | 'entry' | 'question' | 'feedback' | 'done'

interface AnswerFeedback {
  isCorrect: boolean
  points: number
  correctAnswer: string | null
  correctAnswers: string[] | null
  explanation: string | null
  nextQuestion: PublicQuestion | null
}

interface Result {
  finalScore: number
  rank: number
  total: number
}

// ─── Option display ──────────────────────────────────────────────────────────

const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#7C3AED']
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E']

function getOptText(opt: QuestionOption): string {
  return typeof opt === 'string' ? opt : opt.text
}
function getOptImage(opt: QuestionOption): string | undefined {
  return typeof opt === 'string' ? undefined : opt.imageUrl
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AsyncQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [phase, setPhase] = useState<Phase>('loading')
  const [quizInfo, setQuizInfo] = useState<{ title: string; subject: string | null; questionCount: number; allowRetries: boolean } | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [starting, setStarting] = useState(false)

  const attendeeIdRef = useRef<string | null>(null)
  const participantIdRef = useRef<string | null>(null)

  const [currentQ, setCurrentQ] = useState<PublicQuestion | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const questionStartRef = useRef<number>(0)

  const [result, setResult] = useState<Result | null>(null)

  // Persisted participantId per slug to enforce single-attempt
  const storedPidKey = `qz-async-pid-${slug}`

  // ─── Load quiz info ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/async/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setQuizInfo(json.data)
          setPhase('entry')
        } else {
          setPhase('closed')
        }
      })
      .catch(() => setPhase('closed'))
  }, [slug])

  // ─── Start quiz ──────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!name.trim()) { setNameError('Please enter your name.'); return }
    setNameError('')
    setStarting(true)

    const existingPid = typeof window !== 'undefined' ? localStorage.getItem(storedPidKey) : null

    try {
      const res = await fetch(`/api/async/${slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), existingParticipantId: existingPid }),
      })
      const json = await res.json()

      if (res.status === 409) {
        // Already completed — check if retries are allowed
        if (!quizInfo?.allowRetries) {
          setPhase('closed')
          return
        }
      }
      if (!res.ok || !json.success) {
        setNameError(json.message || json.error || 'Could not start. Please try again.')
        setStarting(false)
        return
      }

      const { attendeeId, participantId, question } = json.data
      attendeeIdRef.current = attendeeId
      participantIdRef.current = participantId
      if (typeof window !== 'undefined') localStorage.setItem(storedPidKey, participantId)

      setCurrentQ(question)
      setSelectedIndices([])
      setFeedback(null)
      questionStartRef.current = Date.now()
      setPhase('question')
    } catch {
      setNameError('Network error. Please try again.')
      setStarting(false)
    }
  }, [name, slug, storedPidKey, quizInfo?.allowRetries])

  // ─── Select option ───────────────────────────────────────────────────────

  function handleSelect(idx: string) {
    if (feedback) return
    const q = currentQ
    if (!q) return
    if (q.type === 'multiselect') {
      setSelectedIndices(prev =>
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      )
    } else {
      // mcq / truefalse: select + immediately submit
      submitAnswer(idx)
    }
  }

  // ─── Submit answer ───────────────────────────────────────────────────────

  async function submitAnswer(answer: string | string[]) {
    const q = currentQ
    if (!q || submitting || feedback) return
    setSubmitting(true)

    const timeMs = Date.now() - questionStartRef.current

    try {
      const res = await fetch(`/api/async/${slug}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantIdRef.current,
          attendeeId: attendeeIdRef.current,
          questionIndex: q.index,
          answer,
          timeMs,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setSubmitting(false)
        return
      }
      if (json.data.isCorrect) setTotalScore(s => s + json.data.points)
      setFeedback(json.data)
      setPhase('feedback')
    } catch {
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  function handleMultiselectSubmit() {
    if (selectedIndices.length === 0) return
    submitAnswer(selectedIndices)
  }

  // ─── Next question / finish ──────────────────────────────────────────────

  async function handleNext() {
    if (!feedback) return
    if (feedback.nextQuestion) {
      setCurrentQ(feedback.nextQuestion)
      setSelectedIndices([])
      setFeedback(null)
      questionStartRef.current = Date.now()
      setPhase('question')
    } else {
      // Last question answered — call finish
      try {
        const res = await fetch(`/api/async/${slug}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: participantIdRef.current, attendeeId: attendeeIdRef.current }),
        })
        const json = await res.json()
        setResult(json.success ? json.data : { finalScore: totalScore, rank: 1, total: 1 })
      } catch {
        setResult({ finalScore: totalScore, rank: 1, total: 1 })
      }
      setPhase('done')
    }
  }

  // ─── Render: loading ─────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1B3D' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F5E642', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  // ─── Render: closed / not found ──────────────────────────────────────────

  if (phase === 'closed') {
    const alreadyDone = typeof window !== 'undefined' && !!localStorage.getItem(storedPidKey) && !quizInfo?.allowRetries
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(245,230,66,0.1)', border: '1.5px solid rgba(245,230,66,0.3)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><circle cx="12" cy="12" r="9" stroke="#F5E642" strokeWidth="1.5"/><path d="M12 8v4M12 16h.01" stroke="#F5E642" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
            {alreadyDone ? "You've completed this quiz" : 'Quiz unavailable'}
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            {alreadyDone
              ? 'Retakes are not enabled for this quiz.'
              : 'This quiz link is no longer active or does not exist.'}
          </p>
        </div>
      </div>
    )
  }

  // ─── Render: entry screen ────────────────────────────────────────────────

  if (phase === 'entry') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1B3D' }}>
        <div className="w-full max-w-sm">
          {/* Logo mark */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F5E642' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-sm font-bold" style={{ color: '#F5E642' }}>Quizotic</span>
            </div>
            <h1 className="text-2xl font-black leading-snug mb-1" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
              {quizInfo?.title ?? 'Quiz'}
            </h1>
            {quizInfo?.subject && (
              <p className="text-sm" style={{ color: '#94A3B8' }}>{quizInfo.subject}</p>
            )}
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>
              {quizInfo?.questionCount ?? 0} question{quizInfo?.questionCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#CBD5E1' }}>
              Your name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Enter your name to start"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl text-base outline-none focus:ring-2 focus:ring-yellow-400"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
            {nameError && (
              <p className="mt-2 text-sm" style={{ color: '#F87171' }}>{nameError}</p>
            )}
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full mt-4 py-3.5 rounded-xl font-black text-base transition-opacity disabled:opacity-60"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              {starting ? 'Starting…' : 'Start Quiz'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: question + feedback ─────────────────────────────────────────

  if ((phase === 'question' || phase === 'feedback') && currentQ) {
    const q = currentQ
    const isFeedback = phase === 'feedback'

    return (
      <div className="min-h-screen p-4 flex flex-col max-w-lg mx-auto" style={{ background: 'var(--color-paper, #F7F3E9)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted, #9CA3AF)' }}>
            {quizInfo?.title ?? 'Quiz'}
          </span>
          <span className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>
            {q.index + 1} / {q.total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: 'rgba(15,27,61,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((q.index + 1) / q.total) * 100}%`, background: '#0F1B3D' }}
          />
        </div>

        {/* Score chip */}
        <div className="flex justify-end mb-3">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#0F1B3D', color: '#F5E642' }}>
            {totalScore} pts
          </span>
        </div>

        {/* Question card */}
        <div className="rounded-2xl p-5 mb-4 shadow-sm" style={{ background: '#fff', border: '1px solid #E2E8F0', borderTop: '4px solid #0F1B3D' }}>
          <p className="font-bold text-xl leading-snug" style={{ color: '#0F1B3D' }}>{q.text}</p>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain" loading="lazy" />
          )}
        </div>

        {/* Options */}
        {q.options && q.options.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {q.options.map((opt, idx) => {
              const idxStr = String(idx)
              const color = OPTION_COLORS[idx % OPTION_COLORS.length]
              const letter = OPTION_LETTERS[idx % OPTION_LETTERS.length]
              const isSelected = selectedIndices.includes(idxStr) || (q.type !== 'multiselect' && feedback && selectedIndices[0] === idxStr)
              const isCorrectOpt = isFeedback && (
                feedback?.correctAnswer === idxStr ||
                feedback?.correctAnswers?.includes(idxStr)
              )
              const isWrongSelected = isFeedback && isSelected && !isCorrectOpt
              const optText = getOptText(opt)
              const optImage = getOptImage(opt)

              let bg = color
              let opacity = 1
              if (isFeedback) {
                if (isCorrectOpt) bg = '#16A34A'
                else if (isWrongSelected) bg = '#DC2626'
                else { opacity = 0.35 }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idxStr)}
                  disabled={isFeedback || submitting}
                  className="rounded-2xl p-4 text-white text-left transition-all disabled:cursor-default"
                  style={{
                    background: bg,
                    opacity,
                    outline: q.type === 'multiselect' && selectedIndices.includes(idxStr) ? '3px solid #fff' : 'none',
                    outlineOffset: '-3px',
                  }}
                >
                  {optImage && (
                    <img src={optImage} alt="" className="w-full h-14 object-cover rounded-xl mb-2" loading="lazy" />
                  )}
                  <span className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center font-black text-base mb-1.5">
                    {letter}
                  </span>
                  <span className="text-base font-semibold leading-snug">{optText}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Multiselect submit button */}
        {!isFeedback && q.type === 'multiselect' && (
          <button
            onClick={handleMultiselectSubmit}
            disabled={selectedIndices.length === 0 || submitting}
            className="w-full py-3.5 rounded-xl font-bold text-base mb-4 disabled:opacity-50 transition-opacity"
            style={{ background: '#0F1B3D', color: '#fff' }}
          >
            {submitting ? 'Submitting…' : `Submit (${selectedIndices.length} selected)`}
          </button>
        )}

        {/* Feedback panel */}
        {isFeedback && feedback && (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4 text-center font-bold text-base"
              style={{
                background: feedback.isCorrect ? '#F0FDF4' : '#FEF2F2',
                color: feedback.isCorrect ? '#16A34A' : '#DC2626',
              }}
            >
              {feedback.isCorrect
                ? `Correct! +${feedback.points} pts`
                : 'Not quite — see the correct answer above.'}
            </div>
            {feedback.explanation && (
              <div className="rounded-xl p-4 text-sm" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #DBEAFE' }}>
                <span className="font-bold uppercase tracking-wide text-xs">Why? </span>
                {feedback.explanation}
              </div>
            )}
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-full font-black text-base transition-all hover:opacity-90"
              style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              {feedback.nextQuestion ? 'Next' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── Render: results ─────────────────────────────────────────────────────

  if (phase === 'done' && result) {
    const pct = quizInfo && quizInfo.questionCount > 0
      ? Math.round((result.finalScore / (quizInfo.questionCount * 1000)) * 100)
      : 0

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-sm mx-auto text-center gap-5">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{ background: '#0F1B3D' }}
        >
          <span style={{ color: pct >= 80 ? '#F5E642' : '#fff' }}>
            {pct >= 80 ? '★' : pct >= 50 ? '✓' : '→'}
          </span>
        </div>

        <div>
          <p className="font-black text-4xl" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
            {result.finalScore} pts
          </p>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {pct}% accuracy
          </p>
        </div>

        <div className="rounded-2xl p-5 w-full text-left shadow-sm" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#0F1B3D' }}>Quiz</p>
          <p className="font-bold text-lg" style={{ color: '#0F1B3D' }}>{quizInfo?.title ?? 'Quiz'}</p>
          {result.total > 1 && (
            <p className="text-sm mt-2" style={{ color: '#64748B' }}>
              Rank <span className="font-bold" style={{ color: '#0F1B3D' }}>#{result.rank}</span> of {result.total} player{result.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <p className="text-xs" style={{ color: '#94A3B8' }}>
          Powered by{' '}
          <a href="https://www.quizotic.live" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#94A3B8' }}>
            Quizotic
          </a>
        </p>
      </div>
    )
  }

  return null
}
