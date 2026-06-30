'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { use } from 'react'
import { CountdownPill } from '@/components/async/CountdownPill'
import { ErrorOverlay } from '@/components/async/ErrorOverlay'
import { QuestionInput } from '@/components/async/QuestionInput'
import { optText, type AnswerValue, type QuizQuestion } from '@/components/async/types'
import { track } from '@/lib/analytics'

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
  correctOrder: string[] | null
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

type Phase = 'loading' | 'scheduled' | 'entry' | 'question' | 'feedback' | 'recording' | 'done' | 'timeup' | 'closed'

// Metadata returned by GET when the quiz is scheduled and not yet open.
// No questions are exposed in this state — countdown only.
interface ScheduledInfo {
  title: string
  subject: string | null
  questionCount: number
  opensAt: string // ISO timestamp
  closesAt: string | null
  timeLimitMinutes: number | null
  // Server-clock offset captured at fetch time: serverNow - Date.now().
  // remaining = opensAt - (Date.now() + offset). Never trust the client clock alone.
  offset: number
}

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
  const [scheduledInfo, setScheduledInfo] = useState<ScheduledInfo | null>(null)
  const [closedTitle, setClosedTitle] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const attendeeIdRef = useRef<string | null>(null)
  const participantIdRef = useRef<string | null>(null)

  const [currentQ, setCurrentQ] = useState<QuizQuestion | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [myAnswer, setMyAnswer] = useState<AnswerValue | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pendingAnswerRef = useRef<AnswerValue | null>(null)
  const submittingRef = useRef(false)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load quiz info ────────────────────────────────────────────────────────
  // Reusable: also called when a scheduled countdown hits zero, or on window
  // focus, so a phone unlocked after the open time transitions immediately.

  const loadQuiz = useCallback(async () => {
    try {
      const res = await fetch(`/api/async/${slug}`)
      const json = await res.json()

      if (!json.success) {
        // 410 closed / 404 — no title is exposed here; keep any we already have.
        setPhase('closed')
        return
      }

      const data = json.data

      if (data.state === 'scheduled') {
        // Capture the server-clock offset at fetch time so the countdown does
        // not drift with a wrong client clock.
        const offset = new Date(data.serverNow).getTime() - Date.now()
        setScheduledInfo({
          title: data.title ?? 'Quiz',
          subject: data.subject ?? null,
          questionCount: data.questionCount ?? 0,
          opensAt: data.opensAt,
          closesAt: data.closesAt ?? null,
          timeLimitMinutes: data.timeLimitMinutes ?? null,
          offset,
        })
        setClosedTitle(data.title ?? null)
        setPhase('scheduled')
        return
      }

      // state === 'open' — existing entry-form data.
      setQuizInfo(data)
      setClosedTitle(data.title ?? null)

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
    } catch {
      setPhase('closed')
    }
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

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
      // Defensive: clock skew let the participant reach the entry form before
      // the quiz actually opened. Fall back to the countdown screen instead of
      // showing an error, using the server-authoritative opensAt/serverNow.
      if (res.status === 403 && json.code === 'not_open_yet' && json.opensAt) {
        const offset = json.serverNow ? new Date(json.serverNow).getTime() - Date.now() : 0
        setScheduledInfo({
          title: quizInfo?.title ?? closedTitle ?? 'Quiz',
          subject: quizInfo?.subject ?? null,
          questionCount: quizInfo?.questionCount ?? 0,
          opensAt: json.opensAt,
          closesAt: quizInfo?.closesAt ?? null,
          timeLimitMinutes: quizInfo?.timeLimitMinutes ?? null,
          offset,
        })
        setStarting(false)
        setPhase('scheduled')
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
      track('selfpaced_started', { slug })
    } catch {
      setNameError('Network error. Please try again.')
      setStarting(false)
    }
  }, [name, slug, quizInfo, closedTitle])

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
      setMyAnswer(answer)
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
      setMyAnswer(null)
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
      track('selfpaced_completed', { slug })
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1B3D' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#FBD13B', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  // ─── Phase: scheduled ─────────────────────────────────────────────────────

  if (phase === 'scheduled' && scheduledInfo) {
    return (
      <ScheduledScreen
        info={scheduledInfo}
        starting={starting}
        onOpen={() => { setStarting(true); loadQuiz().finally(() => setStarting(false)) }}
      />
    )
  }

  // ─── Phase: closed ────────────────────────────────────────────────────────

  if (phase === 'closed') {
    const title = quizInfo?.title ?? scheduledInfo?.title ?? closedTitle
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <BrandWordmark />
          </div>
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
              style={{ background: 'rgba(251,209,59,0.1)', border: '1.5px solid rgba(251,209,59,0.3)' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                <circle cx="12" cy="12" r="9" stroke="#FBD13B" strokeWidth="1.5"/>
                <path d="M8 12h8" stroke="#FBD13B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            {title && (
              <p className="text-sm font-bold mb-1" style={{ color: '#CBD5E1' }}>{title}</p>
            )}
            <h1 className="text-2xl font-black mb-2" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
              This quiz has ended
            </h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              The quiz is no longer accepting responses. Thanks for stopping by.
            </p>
          </div>
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1B3D' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <BrandWordmark />
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
              <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(251,209,59,0.1)', color: '#FBD13B' }}>
                Available until {closeDateStr}
              </p>
            )}

            {hasTimeLimit && (
              <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
                Timer starts when you press Start and cannot be paused.
              </p>
            )}

            <form onSubmit={e => { e.preventDefault(); handleStart() }}>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#CBD5E1' }}>
                Your name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Enter your name to start"
                value={name}
                onChange={e => { setName(e.target.value); setNameError('') }}
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl text-base outline-none focus:ring-2 focus:ring-yellow-400"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
              {nameError && (
                <p className="mt-2 text-sm" style={{ color: '#F87171' }}>{nameError}</p>
              )}
              <button
                type="submit"
                disabled={starting}
                className="w-full mt-4 py-3.5 rounded-xl font-black text-base transition-opacity disabled:opacity-60"
                style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
              >
                {starting ? 'Starting…' : 'Start Quiz'}
              </button>
            </form>
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
              style={{ width: `${progressPct}%`, background: '#FBD13B' }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: '#94A3B8' }}>
            {q.index + 1}/{q.total}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{ background: 'rgba(251,209,59,0.15)', color: '#FBD13B' }}>
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
            <p className="text-xs font-black uppercase tracking-[0.22em] mb-4" style={{ color: '#FBD13B' }}>
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
              question={q}
              feedback={fb}
              myAnswer={myAnswer}
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

        {/* Subtle brand watermark — non-interactive, sits below the home indicator */}
        <div
          aria-hidden
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)', pointerEvents: 'none', zIndex: 5 }}
        >
          <span className="text-[10px] font-bold tracking-wide" style={{ color: 'rgba(251,209,59,0.35)' }}>
            quizotic.live
          </span>
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-5"
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-5"
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
                setMyAnswer(null)
                setCurrentQ(null)
                setDeadlineAt(null)
                setPhase('entry')
              }}
            />
          : (
            <div className="space-y-3 text-center">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl"
                style={{ background: 'rgba(251,209,59,0.1)' }}>✓</div>
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

// Brand wordmark shown on the entry, scheduled, and closed screens. Renders the
// full "quizotic.live" so the domain is visible as subtle promotion.
function BrandWordmark() {
  return (
    <div className="inline-flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FBD13B' }}>
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-sm font-bold" style={{ color: '#FBD13B' }}>
        quizotic<span style={{ color: 'rgba(251,209,59,0.5)' }}>.live</span>
      </span>
    </div>
  )
}

function ScheduledScreen({
  info,
  starting,
  onOpen,
}: {
  info: ScheduledInfo
  starting: boolean
  onOpen: () => void
}) {
  // Remaining ms, computed from the server-corrected clock:
  // remaining = opensAt - (Date.now() + offset). Recomputed every tick.
  const opensAtMs = new Date(info.opensAt).getTime()
  const compute = () => Math.max(0, opensAtMs - (Date.now() + info.offset))

  const [remaining, setRemaining] = useState(compute)
  const firedRef = useRef(false)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    firedRef.current = false
    const tick = () => {
      const ms = compute()
      setRemaining(ms)
      if (ms === 0 && !firedRef.current) {
        firedRef.current = true
        onOpenRef.current() // refetch the GET — transition to entry if now open
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opensAtMs, info.offset])

  // Refetch on focus so a phone unlocked after the open time updates at once.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && compute() === 0) {
        onOpenRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opensAtMs, info.offset])

  const opensLabel = new Date(info.opensAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

  const totalSec = Math.ceil(remaining / 1000)
  const days = Math.floor(totalSec / 86400)
  const hh = Math.floor((totalSec % 86400) / 3600)
  const mm = Math.floor((totalSec % 3600) / 60)
  const ss = totalSec % 60
  const farAway = totalSec > 86400 // more than 24h

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1B3D' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <BrandWordmark />
          <h1 className="text-2xl font-black leading-snug mb-1" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
            {info.title}
          </h1>
          {info.subject && (
            <p className="text-sm" style={{ color: '#94A3B8' }}>{info.subject}</p>
          )}
        </div>

        <div className="rounded-2xl p-6 text-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(251,209,59,0.1)', border: '1px solid rgba(251,209,59,0.25)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <circle cx="12" cy="12" r="9" stroke="#FBD13B" strokeWidth="1.5"/>
              <path d="M12 7v5l3 2" stroke="#FBD13B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#FBD13B' }}>
              Opens soon
            </span>
          </div>

          {starting ? (
            <div className="py-6">
              <div className="h-9 w-44 mx-auto rounded-lg animate-pulse"
                style={{ background: 'rgba(251,209,59,0.18)' }} />
              <p className="text-sm mt-4 font-bold" style={{ color: '#FBD13B' }}>Starting…</p>
            </div>
          ) : farAway ? (
            <div className="py-3">
              <p className="font-black tabular-nums" style={{
                color: '#FBD13B', fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem, 8vw, 2.6rem)',
              }}>
                {days} {days === 1 ? 'day' : 'days'} {hh} {hh === 1 ? 'hour' : 'hours'}
              </p>
              <p className="text-xs mt-2 uppercase tracking-wide font-bold" style={{ color: '#64748B' }}>
                until it opens
              </p>
            </div>
          ) : (
            <div className="py-3">
              <p className="font-black tabular-nums leading-none" style={{
                color: '#FBD13B', fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.6rem, 14vw, 4rem)',
              }}>
                {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
              </p>
              <p className="text-xs mt-2 uppercase tracking-wide font-bold" style={{ color: '#64748B' }}>
                until it opens
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm" style={{ color: '#CBD5E1' }}>
              Opens {opensLabel}
            </p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              {info.questionCount} {info.questionCount === 1 ? 'question' : 'questions'}
              {info.timeLimitMinutes ? ` · ${info.timeLimitMinutes} min limit` : ''}
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#475569' }}>
          This page updates automatically when the quiz opens.
        </p>
      </div>
    </div>
  )
}

// Renders an answer value (an option index, a list of indices, or a ranking
// order of indices) as readable, lettered option text — e.g. "B. Paris" or
// "A. Mercury, C. Venus" or, for ranking, "1. X   2. Y". Falls back to the raw
// value if it can't be mapped to an option.
function describeAnswer(question: QuizQuestion, value: AnswerValue | string | null): string {
  if (value === null || value === undefined) return '—'
  const opts = question.options ?? []
  const label = (idx: number) => {
    const o = opts[idx]
    return o === undefined ? String(idx) : `${String.fromCharCode(65 + idx)}. ${optText(o)}`
  }

  if (Array.isArray(value)) {
    const idxs = value.map(v => Number(v)).filter(n => Number.isInteger(n))
    if (idxs.length === 0) return '—'
    if (question.type === 'ranking') {
      return idxs.map((n, pos) => `${pos + 1}. ${opts[n] !== undefined ? optText(opts[n]) : String(n)}`).join('   ')
    }
    return idxs.map(label).join(', ')
  }

  const n = Number(value)
  if (Number.isInteger(n) && opts[n] !== undefined) return label(n)
  return String(value)
}

function FeedbackPanel({
  question,
  feedback,
  myAnswer,
  totalScore,
  onNext,
}: {
  question: QuizQuestion
  feedback: AnswerFeedback
  myAnswer: AnswerValue | null
  totalScore: number
  onNext: () => void
}) {
  const correct = feedback.isCorrect === true

  // The correct value lives in a different field per question type.
  const correctValue =
    question.type === 'multiselect' ? feedback.correctAnswers
    : question.type === 'ranking' ? feedback.correctOrder
    : feedback.correctAnswer
  const correctLabel =
    question.type === 'ranking' ? 'Correct order'
    : question.type === 'multiselect' ? 'Correct answers'
    : 'Correct answer'

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 text-center font-bold text-base"
        style={{
          background: correct ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
          color: correct ? '#4ADE80' : '#F87171',
          border: `1px solid ${correct ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
        }}>
        {correct ? `Correct! +${feedback.points} pts · Total: ${totalScore} pts` : 'Not quite — here is the correct answer.'}
      </div>

      {/* Correct answer — always revealed so self-paced learners get feedback */}
      {correctValue != null && (
        <div className="rounded-xl p-4 text-sm"
          style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <span className="font-bold uppercase tracking-wide text-xs" style={{ color: '#4ADE80' }}>{correctLabel} </span>
          <span className="font-semibold" style={{ color: '#fff' }}>{describeAnswer(question, correctValue)}</span>
        </div>
      )}

      {/* The participant's own choice, shown only when they got it wrong */}
      {!correct && myAnswer != null && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
          <span className="font-bold uppercase tracking-wide text-xs" style={{ color: '#F87171' }}>Your answer </span>
          <span style={{ color: '#FCA5A5' }}>{describeAnswer(question, myAnswer)}</span>
        </div>
      )}

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
        style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
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
        <p className="font-black text-4xl" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>
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
          style={{ background: '#FBD13B', color: '#0D0D0D' }}
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
        quizotic.live
      </a>
    </p>
  )
}
