'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { use } from 'react'
import { CountdownPill } from '@/components/async/CountdownPill'
import { ErrorOverlay } from '@/components/async/ErrorOverlay'
import { QuestionInput } from '@/components/async/QuestionInput'
import type { AnswerValue, QuizQuestion } from '@/components/async/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizInfo {
  title: string
  subject: string | null
  questionCount: number
  allowRetries: boolean
  closesAt: string | null
  estimatedSeconds: number
  maxBaseScore: number
  timeLimitMinutes: number | null
}

interface AnswerFeedback {
  isCorrect: boolean | null
  points: number
  correctAnswer: string | null
  correctAnswers: string[] | null
  explanation: string | null
  nextQuestion: QuizQuestion | null
}

interface Result {
  finalScore: number
  correctCount: number
  answeredCount: number
  questionCount: number
  scoredQuestionCount?: number
  participationAnsweredCount?: number
}

type Phase = 'loading' | 'entry' | 'question' | 'feedback' | 'recording' | 'done' | 'timeup' | 'closed'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(slug: string) { return `qz-async-${slug}` }

function saveSession(slug: string, participantId: string, attendeeId: string) {
  try { localStorage.setItem(storageKey(slug), JSON.stringify({ participantId, attendeeId })) } catch { /* */ }
}

function loadSession(slug: string): { participantId: string; attendeeId: string } | null {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.participantId && parsed?.attendeeId) return parsed
    return null
  } catch { return null }
}

function clearSession(slug: string) {
  try { localStorage.removeItem(storageKey(slug)) } catch { /* */ }
}

function formatCloseDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AsyncQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [phase, setPhase] = useState<Phase>('loading')
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const attendeeIdRef = useRef<string | null>(null)
  const participantIdRef = useRef<string | null>(null)

  const [currentQ, setCurrentQ] = useState<QuizQuestion | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pendingAnswerRef = useRef<AnswerValue | null>(null)
  const submittingRef = useRef(false)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load quiz info ────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/async/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) { setPhase('closed'); return }
        setQuizInfo(json.data)

        if (typeof window !== 'undefined') {
          const session = loadSession(slug)
          if (session) {
            resumeSession(session.participantId, session.attendeeId)
          } else {
            setPhase('entry')
          }
        } else {
          setPhase('entry')
        }
      })
      .catch(() => setPhase('closed'))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resume ───────────────────────────────────────────────────────────────

  async function resumeSession(participantId: string, attendeeId: string) {
    try {
      const res = await fetch(`/api/async/${slug}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, attendeeId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setPhase('entry'); return }

      const { status, deadlineAt: dl, nextQuestion, result: r } = json.data
      attendeeIdRef.current = attendeeId
      participantIdRef.current = participantId

      if (status === 'finished') {
        setResult(r)
        setPhase('done')
      } else if (status === 'time_up') {
        setResult(r)
        setPhase('timeup')
      } else if (status === 'closed') {
        clearSession(slug)
        setPhase('closed')
      } else if (status === 'in_progress' && nextQuestion) {
        setCurrentQ(nextQuestion)
        if (dl) setDeadlineAt(dl)
        setPhase('question')
      } else {
        setPhase('entry')
      }
    } catch {
      setPhase('entry')
    }
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!name.trim()) { setNameError('Please enter your name.'); return }
    setNameError('')
    setStarting(true)

    try {
      const res = await fetch(`/api/async/${slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()

      if (res.status === 409 && !quizInfo?.allowRetries) {
        setPhase('closed')
        return
      }
      if (!res.ok || !json.success) {
        setNameError(json.message ?? json.error ?? 'Could not start. Please try again.')
        setStarting(false)
        return
      }

      const { attendeeId, participantId, question, deadlineAt: dl } = json.data
      attendeeIdRef.current = attendeeId
      participantIdRef.current = participantId
      saveSession(slug, participantId, attendeeId)

      if (dl) setDeadlineAt(dl)
      setCurrentQ(question)
      setPhase('question')
    } catch {
      setNameError('Network error. Please try again.')
      setStarting(false)
    }
  }, [name, slug, quizInfo?.allowRetries])

  // ─── Submit answer ────────────────────────────────────────────────────────

  async function submitAnswer(answer: AnswerValue) {
    if (submittingRef.current) return
    submittingRef.current = true

    const q = currentQ
    if (!q) { submittingRef.current = false; return }

    try {
      const res = await fetch(`/api/async/${slug}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantIdRef.current,
          attendeeId: attendeeIdRef.current,
          questionIndex: q.index,
          answer,
          timeMs: 0,
        }),
      })
      const json = await res.json()

      if (res.status === 410 || json.code === 'time_up') {
        await finishQuiz()
        setPhase('timeup')
        submittingRef.current = false
        return
      }

      if (!res.ok || !json.success) {
        const msg = json.message ?? json.error ?? 'Could not submit. Please try again.'
        setErrorMsg(msg)
        pendingAnswerRef.current = answer
        submittingRef.current = false
        return
      }

      const fb: AnswerFeedback = json.data
      if (fb.isCorrect === true) {
        setTotalScore(s => s + fb.points)
      }
      setFeedback(fb)
      pendingAnswerRef.current = null

      // participation types → brief recording state, then auto-advance
      if (fb.isCorrect === null) {
        setPhase('recording')
        autoAdvanceTimerRef.current = setTimeout(() => advance(fb), 1400)
      } else {
        setPhase('feedback')
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      pendingAnswerRef.current = answer
    } finally {
      submittingRef.current = false
    }
  }

  // ─── Advance to next question or finish ───────────────────────────────────

  function advance(fb: AnswerFeedback) {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    if (fb.nextQuestion) {
      setCurrentQ(fb.nextQuestion)
      setFeedback(null)
      setPhase('question')
    } else {
      finishQuiz()
    }
  }

  // ─── Finish ───────────────────────────────────────────────────────────────

  async function finishQuiz() {
    if (finishing) return
    setFinishing(true)
    try {
      const res = await fetch(`/api/async/${slug}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participantIdRef.current, attendeeId: attendeeIdRef.current }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setResult(json.data)
      }
      clearSession(slug)
      setPhase('done')
    } catch {
      clearSession(slug)
      setPhase('done')
    } finally {
      setFinishing(false)
    }
  }

  // ─── Time expired ─────────────────────────────────────────────────────────

  const handleExpire = useCallback(() => {
    if (phase === 'done' || phase === 'timeup') return
    finishQuiz().then(() => setPhase('timeup'))
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Retry after error ────────────────────────────────────────────────────

  function handleRetry() {
    setErrorMsg(null)
    const pending = pendingAnswerRef.current
    if (pending !== null) {
      submitAnswer(pending)
    }
  }

  // ─── Phase: loading ───────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: '#0F1B3D' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#F5E642', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  // ─── Phase: closed ────────────────────────────────────────────────────────

  if (phase === 'closed') {
    return (
      <div className="min-h-svh flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
            style={{ background: 'rgba(245,230,66,0.1)', border: '1.5px solid rgba(245,230,66,0.3)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
              <circle cx="12" cy="12" r="9" stroke="#F5E642" strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke="#F5E642" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
            Quiz unavailable
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            This quiz link is no longer active or does not exist.
          </p>
        </div>
      </div>
    )
  }

  // ─── Phase: entry ─────────────────────────────────────────────────────────

  if (phase === 'entry') {
    const info = quizInfo
    const closeDateStr = formatCloseDate(info?.closesAt ?? null)
    const hasTimeLimit = !!info?.timeLimitMinutes

    return (
      <div className="min-h-svh flex items-center justify-center p-4" style={{ background: '#0F1B3D' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F5E642' }}>
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-sm font-bold" style={{ color: '#F5E642' }}>Quizotic</span>
            </div>
            <h1 className="text-2xl font-black leading-snug mb-1" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
              {info?.title ?? 'Quiz'}
            </h1>
            {info?.subject && (
              <p className="text-sm" style={{ color: '#94A3B8' }}>{info.subject}</p>
            )}
          </div>

          <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <InfoTile label="Questions" value={String(info?.questionCount ?? 0)} />
              <InfoTile label="Mode" value="Self-paced" />
              {hasTimeLimit
                ? <InfoTile label="Time limit" value={`${info!.timeLimitMinutes} min`} accent />
                : <InfoTile label="Time" value="Untimed" />}
              <InfoTile label="Retakes" value={info?.allowRetries ? 'Allowed' : 'One try'} />
            </div>

            {closeDateStr && (
              <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(245,230,66,0.1)', color: '#F5E642' }}>
                Available until {closeDateStr}
              </p>
            )}

            {hasTimeLimit && (
              <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
                Timer starts when you press Start and cannot be paused.
              </p>
            )}

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

  // ─── Phase: question / feedback / recording ───────────────────────────────

  if ((phase === 'question' || phase === 'feedback' || phase === 'recording') && currentQ) {
    const q = currentQ
    const isFeedback = phase === 'feedback'
    const isRecording = phase === 'recording'
    const isDisabled = isFeedback || isRecording
    const progressPct = ((q.index + 1) / q.total) * 100

    const fb = feedback

    return (
      <div className="min-h-svh flex flex-col" style={{ background: '#0F1B3D' }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-4 pb-2 flex items-center gap-3"
          style={{ background: '#0F1B3D', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: '#F5E642' }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: '#94A3B8' }}>
            {q.index + 1}/{q.total}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{ background: 'rgba(245,230,66,0.15)', color: '#F5E642' }}>
            {totalScore} pts
          </span>
          {deadlineAt && (
            <CountdownPill deadlineAt={deadlineAt} onExpire={handleExpire} />
          )}
        </div>

        <div className="flex-1 px-4 sm:px-6 lg:px-10 pb-8 pt-5 max-w-7xl mx-auto w-full">
          {/* Question stage */}
          <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.2fr)] gap-5 lg:gap-8 items-stretch lg:min-h-[calc(100vh-112px)]">
          <div className="rounded-3xl p-6 sm:p-8 lg:p-10 shadow-sm flex flex-col justify-center"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-xs font-black uppercase tracking-[0.22em] mb-4" style={{ color: '#F5E642' }}>
              Question {q.index + 1} of {q.total}
            </p>
            <p className="font-black leading-tight" style={{
              color: '#fff',
              fontFamily: 'var(--font-heading)',
              fontSize: q.text.length > 180 ? 'clamp(1.45rem, 2.4vw, 2.4rem)' : 'clamp(1.8rem, 3.2vw, 3.7rem)',
            }}>{q.text}</p>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" className="mt-6 rounded-2xl max-h-[42vh] w-full object-contain" loading="lazy" />
            )}
          </div>

          {/* Input / feedback */}
          <div className="flex flex-col justify-center lg:min-h-[360px]">
          {isRecording ? (
            <div className="rounded-2xl px-4 py-8 text-center animate-pulse"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <p className="font-black text-2xl" style={{ color: '#A5B4FC' }}>Recorded ✓</p>
            </div>
          ) : isFeedback && fb ? (
            <FeedbackPanel
              feedback={fb}
              totalScore={totalScore}
              onNext={() => advance(fb)}
            />
          ) : (
            <QuestionInput
              question={q}
              disabled={isDisabled || submittingRef.current}
              onSubmit={submitAnswer}
            />
          )}
          </div>
          </div>
        </div>

        {errorMsg && (
          <ErrorOverlay message={errorMsg} onRetry={handleRetry} />
        )}
      </div>
    )
  }

  // ─── Phase: timeup ────────────────────────────────────────────────────────

  if (phase === 'timeup') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-6 text-center gap-5"
        style={{ background: '#0F1B3D' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)' }}>
          ⏱
        </div>
        <div>
          <h1 className="text-2xl font-black mb-1" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
            Time&apos;s up!
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>Your time limit expired.</p>
          {finishing && <p className="text-xs mt-2" style={{ color: '#64748B' }}>Saving your results…</p>}
        </div>
        {result && <ScoreReveal result={result} quizInfo={quizInfo} allowRetry={false} onRetry={() => {}} />}
        <QuizoticFooter />
      </div>
    )
  }

  // ─── Phase: done ──────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-6 text-center gap-5"
        style={{ background: '#0F1B3D' }}>
        {result
          ? <ScoreReveal
              result={result}
              quizInfo={quizInfo}
              allowRetry={!!quizInfo?.allowRetries}
              onRetry={() => {
                clearSession(slug)
                setResult(null)
                setTotalScore(0)
                setFeedback(null)
                setCurrentQ(null)
                setDeadlineAt(null)
                setPhase('entry')
              }}
            />
          : (
            <div className="space-y-3 text-center">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl"
                style={{ background: 'rgba(245,230,66,0.1)' }}>✓</div>
              <p className="font-black text-xl" style={{ color: '#fff' }}>Quiz complete!</p>
            </div>
          )
        }
        <QuizoticFooter />
      </div>
    )
  }

  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: accent ? '#FACC15' : '#fff' }}>{value}</p>
    </div>
  )
}

function FeedbackPanel({
  feedback,
  totalScore,
  onNext,
}: {
  feedback: Pick<AnswerFeedback, 'isCorrect' | 'points' | 'explanation' | 'nextQuestion'>
  totalScore: number
  onNext: () => void
}) {
  const correct = feedback.isCorrect === true

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 text-center font-bold text-base"
        style={{
          background: correct ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
          color: correct ? '#4ADE80' : '#F87171',
          border: `1px solid ${correct ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
        }}>
        {correct ? `Correct! +${feedback.points} pts · Total: ${totalScore} pts` : 'Not quite — see the correct answer.'}
      </div>

      {feedback.explanation && (
        <div className="rounded-xl p-4 text-sm"
          style={{ background: 'rgba(59,130,246,0.1)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span className="font-bold uppercase tracking-wide text-xs">Why? </span>
          {feedback.explanation}
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-4 rounded-xl font-black text-base transition-all hover:opacity-90"
        style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
      >
        {feedback.nextQuestion ? 'Next Question →' : 'See Results'}
      </button>
    </div>
  )
}

function ScoreReveal({
  result,
  quizInfo,
  allowRetry,
  onRetry,
}: {
  result: Result
  quizInfo: QuizInfo | null
  allowRetry: boolean
  onRetry: () => void
}) {
  const totalQ = result.questionCount || quizInfo?.questionCount || 0
  const scoredTotal = result.scoredQuestionCount ?? totalQ
  const pct = scoredTotal > 0 ? Math.round((result.correctCount / scoredTotal) * 100) : 0
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '✓' : '→'

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="text-5xl text-center">{emoji}</div>
      <div>
        <p className="font-black text-4xl" style={{ color: '#F5E642', fontFamily: 'var(--font-heading)' }}>
          {result.finalScore} pts
        </p>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          {result.correctCount}/{scoredTotal} scored correct · {pct}% accuracy
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ResultTile label="Answered" value={`${result.answeredCount}/${totalQ}`} />
        <ResultTile label="Accuracy" value={`${pct}%`} />
        <ResultTile label="Mode" value="Self-paced" />
      </div>

      {quizInfo && (
        <div className="rounded-2xl p-4 text-left"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="font-bold" style={{ color: '#fff' }}>{quizInfo.title}</p>
          {quizInfo.subject && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{quizInfo.subject}</p>}
          <p className="text-xs mt-2" style={{ color: '#64748B' }}>
            {result.answeredCount} answered
          </p>
        </div>
      )}

      {allowRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
          style={{ background: '#F5E642', color: '#0D0D0D' }}
        >
          Take Again
        </button>
      )}
    </div>
  )
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-3 text-center"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-sm font-black mt-1" style={{ color: '#fff' }}>{value}</p>
    </div>
  )
}

function QuizoticFooter() {
  return (
    <p className="text-xs" style={{ color: '#475569' }}>
      Powered by{' '}
      <a href="https://www.quizotic.live" target="_blank" rel="noopener noreferrer"
        className="underline" style={{ color: '#475569' }}>
        Quizotic
      </a>
    </p>
  )
}
