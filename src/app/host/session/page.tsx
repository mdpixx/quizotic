'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { PostSessionHeader } from '@/components/PostSessionHeader'
import { CelebrationConfetti } from '@/components/CelebrationConfetti'
import { SessionReport } from '@/components/SessionReport'
import { LeaderboardView } from '@/components/LeaderboardView'
import { playLeaderboardJingle, playTick } from '@/lib/sounds'

const CelebrationOverlay = dynamic(
  () => import('@/components/CelebrationOverlay').then(m => m.CelebrationOverlay),
  { ssr: false },
)
import { getActiveSession, setActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz, QuestionStat, SessionMode } from '@/lib/quiz-types'
import { ReflectionInsights } from '@/components/ReflectionInsights'
import { getOptionText, getOptionImage, isScoredType, getEffectiveOptions } from '@/lib/quiz-types'
import { CircularTimer } from '@/components/CircularTimer'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { BrandWatermark } from '@/components/BrandWatermark'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { JoinPill } from '@/components/host/JoinPill'
import { getQuizTheme } from '@/lib/quiz-themes'

type Phase = 'loading' | 'error' | 'idle' | 'lobby' | 'question' | 'standings' | 'ended'

interface LeaderboardEntry {
  name: string
  archetype?: string
  score: number
}

// Canonical Kahoot palette — kept as Tailwind class list here for the
// arbitrary-value bg class names we inject. Source of truth: src/lib/answer-colors.ts.
const OPTION_COLORS = [
  'bg-[#E21B3C]', // A
  'bg-[#1368CE]', // B
  'bg-[#D89E00]', // C
  'bg-[#26890C]', // D
  'bg-[#7C3AED]', // E
]

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

// P3.1 — Share / LMS links for lobby
function ShareLinks({ gameCode, quizTitle }: { gameCode: string; quizTitle: string }) {
  const [copied, setCopied] = useState(false)
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${gameCode}`
    : `https://quizotic.live/join?code=${gameCode}`

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const classroomUrl = `https://classroom.google.com/share?url=${encodeURIComponent(joinUrl)}&title=${encodeURIComponent(`Join "${quizTitle}" on Quizotic — code ${gameCode}`)}`
  const moodleMsg = encodeURIComponent(`Join the live quiz "${quizTitle}" on Quizotic!\n${joinUrl}\nGame code: ${gameCode}`)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Share with students</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyLink}
          className="flex-1 min-w-[120px] text-sm font-semibold rounded-xl py-2.5 border-2 transition-all hover:scale-[1.02]"
          style={{ borderColor: '#DBEAFE', color: '#1D4ED8' }}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <a
          href={classroomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[120px] text-sm font-semibold rounded-xl py-2.5 border-2 transition-all hover:scale-[1.02] text-center"
          style={{ borderColor: '#BBF7D0', color: '#15803D' }}
        >
          Google Classroom
        </a>
        <a
          href={`https://wa.me/?text=${moodleMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[120px] text-sm font-semibold rounded-xl py-2.5 border-2 transition-all hover:scale-[1.02] text-center"
          style={{ borderColor: '#D1FAE5', color: '#065F46' }}
        >
          WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Join "${quizTitle}" on Quizotic`)}&body=${moodleMsg}`}
          className="flex-1 min-w-[120px] text-sm font-semibold rounded-xl py-2.5 border-2 transition-all hover:scale-[1.02] text-center"
          style={{ borderColor: '#FDE68A', color: '#92400E' }}
        >
          Email
        </a>
      </div>
    </div>
  )
}


// Layer 3.3 — host re-attach. Token survives a tab reload but is scoped to
// this browser tab (sessionStorage). Server issues it at create_session and
// validates on host_resume to rebind hostSocketId without losing the live game.
function getHostResumeToken(gameCode: string): string {
  if (typeof window === 'undefined' || !gameCode) return ''
  try { return window.sessionStorage.getItem(`quizotic_host_token_${gameCode}`) || '' }
  catch { return '' }
}
function setHostResumeToken(gameCode: string, token: string): void {
  if (typeof window === 'undefined' || !gameCode || !token) return
  try { window.sessionStorage.setItem(`quizotic_host_token_${gameCode}`, token) }
  catch { /* noop */ }
}
function clearHostResumeToken(gameCode: string): void {
  if (typeof window === 'undefined' || !gameCode) return
  try { window.sessionStorage.removeItem(`quizotic_host_token_${gameCode}`) }
  catch { /* noop */ }
}

export default function SessionPage() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)
  const sessionStartTimeRef = useRef<number>(0)
  // Refs that initSocket's stable closure needs to read on reconnect.
  const gameCodeRef = useRef<string>('')
  const hostResumeTokenRef = useRef<string>('')

  const [phase, setPhase] = useState<Phase>('loading')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const quizRef = useRef<Quiz | null>(null)
  const questionIndexRef = useRef<number>(0)
  const [gameCode, setGameCode] = useState('')
  const [participants, setParticipants] = useState<Map<string, { archetype: string; team?: { index: number; name: string; color: string } | null }>>(new Map())
  // key = displayName, value = { archetype, team }
  const [sessionMode, setSessionMode] = useState<SessionMode>('competitive')
  const sessionModeRef = useRef<SessionMode>('competitive')
  useEffect(() => { sessionModeRef.current = sessionMode }, [sessionMode])
  useEffect(() => { quizRef.current = quiz }, [quiz])
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [teamMode, setTeamMode] = useState(false)
  const [teamCount, setTeamCount] = useState(2)
  const [socketConnected, setSocketConnected] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  useEffect(() => { questionIndexRef.current = questionIndex }, [questionIndex])
  const [answered, setAnswered] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teamLeaderboard, setTeamLeaderboard] = useState<{ name: string; color: string; score: number; members: number }[] | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [followups, setFollowups] = useState<{ label: string; code: string }[]>([])
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupError, setFollowupError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [optionCounts, setOptionCounts] = useState<number[]>([])
  const [paused, setPaused] = useState(false)
  const [hostTimeLeft, setHostTimeLeft] = useState(0)
  const hostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null)
  const [rankingSubmissions, setRankingSubmissions] = useState<number[][]>([])
  const [attendees, setAttendees] = useState<Array<{ joinedAt: string; leftAt: string | null; durationSec: number | null }>>([])
  const [intermediateLeaderboard, setIntermediateLeaderboard] = useState<LeaderboardEntry[]>([])
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Host-screen privacy: correct answer is hidden while the question is live
  // (host screen is often projected to participants). Revealed after timer ends
  // or via explicit "Reveal answer" button.
  const [questionEnded, setQuestionEnded] = useState(false)
  const [correctRevealed, setCorrectRevealed] = useState(false)
  // P3.4 — Drawing question gallery
  const [drawings, setDrawings] = useState<Array<{ name: string; archetype: string; dataUrl: string }>>([])
  // Host-side aggregates for text-based / rating / Q&A types. Reset on every
  // new question via question_show. Populated by text_submission events.
  const [wordcloudWords, setWordcloudWords] = useState<string[]>([])
  const [qaEntries, setQaEntries] = useState<Array<{ name: string; archetype: string; text: string; at: number }>>([])
  const [openendedEntries, setOpenendedEntries] = useState<Array<{ name: string; archetype: string; text: string; at: number }>>([])
  const [ratingValues, setRatingValues] = useState<number[]>([])
  // P2.5 — Ghost Mode
  const [ghostMode, setGhostMode] = useState(false)

  const [ghostSessionId, setGhostSessionId] = useState('')
  const [ghostCandidates, setGhostCandidates] = useState<Array<{ id: string; date: string; participantCount: number; topScore: number; topName: string }>>([])

  useEffect(() => {
    if (phase !== 'ended' || !gameCode) return
    let cancelled = false
    fetch(`/api/sessions/${gameCode}/attendees`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!cancelled && json?.success && Array.isArray(json.data)) setAttendees(json.data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [phase, gameCode])

  const currentQuestion = quiz?.questions[questionIndex] ?? null

  useEffect(() => {
    const session = getActiveSession()
    if (!session) {
      setPhase('error')
      return
    }
    setQuiz(session)
    setPhase('idle')
  }, [])

  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

  // Load ghost candidates when ghost mode is enabled
  useEffect(() => {
    if (!ghostMode || !quiz) return
    const quizId = quiz.id ? `?quizId=${quiz.id}` : ''
    fetch(`/api/sessions/ghost-candidates${quizId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.success) setGhostCandidates(json.data ?? [])
      })
      .catch(() => {})
  }, [ghostMode, quiz])

  // Socket setup — run ONCE after quiz is loaded (empty deps, guarded by quiz check)
  const socketInitialized = useRef(false)
  useEffect(() => {
    if (!quiz || socketInitialized.current) return
    socketInitialized.current = true

    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      setSessionError('')
      // Layer 3.3 — if we already had a session, try to reclaim it. Server
      // accepts within the 5-minute host disconnect grace window.
      const code = gameCodeRef.current
      const token = hostResumeTokenRef.current
      if (code && token) {
        socket.emit('host_resume', { gameCode: code, token }, (res?: { success?: boolean; error?: string }) => {
          if (res?.success) {
            console.log('[host_resume] reattached to', code)
          } else if (res?.error) {
            console.warn('[host_resume] failed:', res.error)
          }
        })
      }
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('connect_error', () => {
      setSocketConnected(false)
      setSessionError('Connection failed. Check your network.')
    })

    socket.on('participant_joined', ({ name, archetype, team }: { name: string; archetype: string; count: number; team?: { index: number; name: string; color: string } | null }) => {
      setParticipants(prev => new Map(prev).set(name, { archetype, team }))
    })

    socket.on('participant_left', ({ name }: { name: string }) => {
      setParticipants(prev => { const next = new Map(prev); next.delete(name); return next })
    })

    socket.on('answer_received', ({ count, optionCounts: counts }: { count: number; optionCounts?: number[] }) => {
      setAnswered(count)
      if (counts) setOptionCounts(counts)
    })

    // question_show fires for host too (host is in session: room).
    // Use it to synchronize the host timer with server's startAt and show 3-2-1 countdown.
    socket.on('question_show', ({ startAt, index }: { startAt?: number; index: number; question: unknown; total: number }) => {
      const effectiveStart = typeof startAt === 'number' ? startAt : Date.now()
      // Leaving the standings screen for the next question.
      setPhase('question')
      setQuestionStartedAt(effectiveStart)
      setRankingSubmissions([])
      setDrawings([]) // reset drawing gallery for each new question
      setWordcloudWords([])
      setQaEntries([])
      setOpenendedEntries([])
      setRatingValues([])

      const msUntilStart = Math.max(0, effectiveStart - Date.now())
      const timerSeconds = quiz?.questions[index]?.timerSeconds ?? 20

      if (msUntilStart > 500) {
        // 3-2-1 countdown, then start host timer. Tick sound fires on each
        // count — client-side timers on host and participant are both driven
        // by the server's startAt, so the beeps stay in sync across screens.
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        const startCount = Math.min(3, Math.ceil(msUntilStart / 1000))
        setCountdownValue(startCount)
        playTick()
        let current = startCount
        countdownTimerRef.current = setInterval(() => {
          current -= 1
          if (current <= 0) {
            clearInterval(countdownTimerRef.current!)
            countdownTimerRef.current = null
            setCountdownValue(null)
            startHostTimer(timerSeconds, effectiveStart)
          } else {
            setCountdownValue(current)
            playTick()
          }
        }, 1000)
      } else {
        startHostTimer(timerSeconds, effectiveStart)
      }
    })

    socket.on('ranking_submission', ({ ranking }: { ranking: number[] }) => {
      if (Array.isArray(ranking)) {
        setRankingSubmissions(prev => [...prev, ranking])
      }
    })

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
      setQuestionEnded(true)
      if (hostTimerRef.current) { clearInterval(hostTimerRef.current); hostTimerRef.current = null }
      setHostTimeLeft(0)
      // Stay on the question screen so the host can review who answered
      // right/wrong before advancing. The host clicks Next to move to the
      // standings screen (scored types) or directly to the next question
      // (non-scored types).
    })

    socket.on('leaderboard_update', ({ top, teamLeaderboard: tlb }: {
      top: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
    }) => {
      setIntermediateLeaderboard(top)
      if (tlb) setTeamLeaderboard(tlb)
      // Server only emits this after scored questions end, so every arrival
      // marks a genuine rank-change moment — play the reveal jingle.
      try { playLeaderboardJingle() } catch {}
    })

    socket.on('drawing_submitted', (entry: { name: string; archetype: string; dataUrl: string }) => {
      setDrawings(prev => [...prev, entry])
    })

    socket.on('text_submission', (entry: { type: string; name: string; archetype: string; answer: unknown; submittedAt: number }) => {
      const text = typeof entry.answer === 'string' ? entry.answer.trim() : ''
      if (entry.type === 'wordcloud') {
        if (text) setWordcloudWords(prev => [...prev, text])
      } else if (entry.type === 'qa') {
        if (text) setQaEntries(prev => [...prev, { name: entry.name, archetype: entry.archetype, text, at: entry.submittedAt }])
      } else if (entry.type === 'openended') {
        if (text) setOpenendedEntries(prev => [...prev, { name: entry.name, archetype: entry.archetype, text, at: entry.submittedAt }])
      } else if (entry.type === 'rating') {
        // Rating submits a string option index (0..4) → convert to 1..5 scale.
        const idx = typeof entry.answer === 'string' ? Number(entry.answer) : NaN
        if (Number.isFinite(idx) && idx >= 0 && idx <= 4) {
          setRatingValues(prev => [...prev, idx + 1])
        }
      }
    })

    socket.on('session_ended', ({ leaderboard: lb, teamLeaderboard: tlb, questionStats: qs, sessionMode: sm }: {
      leaderboard: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      questionStats: QuestionStat[];
      sessionMode: SessionMode;
    }) => {
      if (sm) setSessionMode(sm)
      setLeaderboard(lb)
      setTeamLeaderboard(tlb ?? null)
      setQuestionStats(qs ?? [])
      setPhase('ended')
      // Trigger the full-screen celebration overlay only when we actually have
      // a competitive leaderboard to celebrate.
      if (lb.length > 0 && sm === 'competitive') setShowCelebration(true)
      // Game over — invalidate the host resume token for this gameCode.
      if (gameCodeRef.current) clearHostResumeToken(gameCodeRef.current)
      hostResumeTokenRef.current = ''

      // Save session record for analytics
      if (quiz && lb.length > 0) {
        const maxScore = lb[0].score || 1
        const avgScore = Math.round(lb.reduce((s, p) => s + (p.score / maxScore * 100), 0) / lb.length)
        const duration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        const sessionId = crypto.randomUUID()
        const record = {
          id: sessionId,
          quizId: quiz.id,
          quizTitle: quiz.title,
          date: new Date().toISOString(),
          playerCount: lb.length,
          avgScore,
          duration,
        }
        try {
          const existing = JSON.parse(localStorage.getItem('quizotic_sessions') || '[]')
          localStorage.setItem('quizotic_sessions', JSON.stringify([record, ...existing]))
          // Persist question-level stats for analytics
          if (qs && qs.length > 0) {
            const statsKey = `quizotic_qstats_${sessionId}`
            localStorage.setItem(statsKey, JSON.stringify(qs))
          }
        } catch {}
      }
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('participant_joined')
      socket.off('participant_left')
      socket.off('answer_received')
      socket.off('question_started')
      socket.off('ranking_submission')
      socket.off('question_show')
      socket.off('question_ended')
      socket.off('session_ended')
      socket.off('leaderboard_update')
      socket.off('drawing_submitted')
      socket.disconnect()
    }
  }, [quiz])

  async function createSession() {
    if (!quiz || creating) return
    setSessionError('')
    setCreating(true)

    // Check socket is connected before proceeding
    if (!socketRef.current?.connected) {
      setSessionError('Not connected to server. Please wait or refresh the page.')
      setCreating(false)
      return
    }

    // Persist quiz to DB (fire-and-forget — don't update quiz state to avoid socket reconnection)
    let quizDataForSession = quiz
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quiz.id,
          title: quiz.title,
          subject: quiz.subject,
          language: quiz.language,
          questions: quiz.questions,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // Use DB ID in the session data, but do NOT call setQuiz (it would kill the socket)
        if (data?.id) quizDataForSession = { ...quiz, id: data.id }
      }
    } catch {
      // DB save failed — proceed anyway, session will work
    }

    // Timeout: if server doesn't respond within 8 seconds, show error
    const timeout = setTimeout(() => {
      setSessionError('Server not responding. Please try again.')
      setCreating(false)
    }, 8000)

    socketRef.current.emit('create_session', { quizData: quizDataForSession, sessionMode, anonymousMode, teamMode, teamCount, ghostSessionId: ghostMode && ghostSessionId ? ghostSessionId : undefined }, (res: { success: boolean; gameCode: string; error?: string; hostResumeToken?: string }) => {
      clearTimeout(timeout)
      setCreating(false)
      if (res.success) {
        setGameCode(res.gameCode)
        gameCodeRef.current = res.gameCode
        if (res.hostResumeToken) {
          hostResumeTokenRef.current = res.hostResumeToken
          setHostResumeToken(res.gameCode, res.hostResumeToken)
        }
        setPhase('lobby')
      } else {
        setSessionError(res.error ?? 'Failed to create session. Please try again.')
      }
    })
  }

  const timerStartRef = useRef<number>(0)
  const timerDurationRef = useRef<number>(0)

  function startHostTimer(seconds: number, serverTimestamp?: number) {
    if (hostTimerRef.current) clearInterval(hostTimerRef.current)
    timerDurationRef.current = seconds
    timerStartRef.current = serverTimestamp ?? Date.now()
    setHostTimeLeft(seconds)
    let lastTickSecond = seconds + 1
    hostTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - timerStartRef.current) / 1000
      const remaining = Math.max(0, Math.ceil(timerDurationRef.current - elapsed))
      setHostTimeLeft(remaining)
      // Tick on host for the final 5 seconds — stays in sync with the
      // participant ticks since both clocks are anchored on serverTimestamp.
      if (remaining !== lastTickSecond && remaining > 0 && remaining <= 5) {
        lastTickSecond = remaining
        playTick()
      }
      if (remaining <= 0) {
        clearInterval(hostTimerRef.current!)
        hostTimerRef.current = null
      }
    }, 200) // Update 5x/sec for smooth countdown
  }

  function startQuiz() {
    if (!socketRef.current?.connected) {
      setSessionError('Connection lost. Please refresh the page.')
      return
    }
    setSessionError('')
    sessionStartTimeRef.current = Date.now()
    socketRef.current.emit('start_quiz', { gameCode })
    setAnswered(0)
    setOptionCounts([])
    setQuestionStartedAt(null)
    setRankingSubmissions([])
    setQuestionIndex(0)
    setPhase('question')
    // Host timer starts via question_show socket event (synchronized with server startAt)
  }

  function nextQuestion() {
    if (!quiz) return
    setExplanation(null)
    setQuestionEnded(false)
    setCorrectRevealed(false)
    if (hostTimerRef.current) { clearInterval(hostTimerRef.current); hostTimerRef.current = null }
    const nextIndex = questionIndex + 1
    if (nextIndex >= quiz.questions.length) {
      socketRef.current?.emit('end_session', { gameCode })
    } else {
      socketRef.current?.emit('next_question', { gameCode })
      setQuestionIndex(nextIndex)
      setAnswered(0)
      setOptionCounts([])
      setQuestionStartedAt(null)
      setRankingSubmissions([])
      // Host timer starts via question_show socket event (synchronized with server startAt)
    }
  }

  // Host pressed Next from the question-review screen. For competitive +
  // scored types the next stop is the standings screen; for everything else
  // we skip straight to the next question (or end the quiz on the last one).
  function advanceFromQuestion() {
    const currentType = quiz?.questions?.[questionIndex]?.type
    const scored = currentType ? isScoredType(currentType) : false
    if (sessionMode === 'competitive' && scored) {
      socketRef.current?.emit('show_standings', { gameCode })
      setPhase('standings')
      return
    }
    nextQuestion()
  }

  function generateFollowups() {
    setFollowupLoading(true)
    setFollowupError('')
    socketRef.current?.emit('generate_followup', { gameCode }, (res: {
      success: boolean; error?: string; followups?: { label: string; code: string }[]
    }) => {
      setFollowupLoading(false)
      if (!res.success) {
        setFollowupError(res.error ?? 'Could not generate follow-ups.')
      } else {
        setFollowups(res.followups ?? [])
      }
    })
  }

  function copyFollowupLink(code: string) {
    const url = `${window.location.origin}/join?followup=${code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  function goBackToLibrary() {
    clearActiveSession()
    router.push('/host')
  }

  if (phase === 'loading') {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-500">Loading...</div>
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">No active quiz session found.</p>
        <button onClick={() => router.push('/host')} className="px-6 py-3 bg-lime-400 text-black font-bold rounded-xl">
          Back to Library
        </button>
      </div>
    )
  }

  const quizTheme = getQuizTheme(quiz?.theme)

  return (
    <div
      className="min-h-screen"
      style={{ background: quizTheme.background, color: quizTheme.textColor }}
      data-theme={quizTheme.id}
    >
      <BrandWatermark placement="host" />

      {/* IDLE */}
      {phase === 'idle' && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          {/* Back button — lets host return to the builder to edit the quiz
              before actually going live. Clears the active session so the
              builder doesn't think a session is already running. */}
          <button
            onClick={() => {
              clearActiveSession()
              router.push(quiz?.id ? `/host/create?id=${quiz.id}` : '/host')
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to editor
          </button>
          <h1 className="text-4xl font-black mb-1" style={{ color: '#0F1B3D' }}>{quiz.title}</h1>
          <p className="text-gray-500 text-lg">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</p>

          {/* Question preview */}
          <div className="space-y-2">
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3 shadow-sm">
                <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-gray-700 truncate">{q.text}</p>
              </div>
            ))}
          </div>

          {/* Session Mode selector */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Session Mode</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { mode: 'competitive' as const, label: 'Competitive', desc: 'Live leaderboard, speed scoring', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', comingSoon: false },
                { mode: 'reflection' as const, label: 'Reflection', desc: 'Calmer pace, results at end', icon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', comingSoon: false },
              ]).map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => !opt.comingSoon && setSessionMode(opt.mode)}
                  disabled={opt.comingSoon}
                  className={`rounded-2xl p-4 border-2 text-left transition-all ${
                    opt.comingSoon
                      ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                      : sessionMode === opt.mode
                      ? 'border-violet-500 bg-violet-50 shadow-sm'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <svg className="w-6 h-6 mb-2" viewBox="0 0 24 24" fill="none" stroke={!opt.comingSoon && sessionMode === opt.mode ? '#0F1B3D' : '#9CA3AF'} strokeWidth="2">
                    <path d={opt.icon} strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                  <p className={`font-bold text-sm ${!opt.comingSoon && sessionMode === opt.mode ? 'text-violet-700' : 'text-gray-900'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-tight">{opt.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">More modes coming — see the roadmap.</p>
          </div>

          {/* Anonymous mode toggle */}
          <div className="flex items-center justify-between bg-white rounded-xl border p-4 shadow-sm"
            style={{ borderColor: '#DBEAFE' }}>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1E1B4B' }}>Anonymous Mode</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Hides participant names — shows archetypes only</p>
            </div>
            <button
              onClick={() => setAnonymousMode(m => !m)}
              aria-pressed={anonymousMode}
              aria-label="Toggle anonymous mode"
              className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              style={{ background: anonymousMode ? '#0F1B3D' : '#E5E7EB' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${anonymousMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Team mode toggle */}
          <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#DBEAFE' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm" style={{ color: '#1E1B4B' }}>Team Mode</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Assign participants to teams automatically</p>
              </div>
              <button
                onClick={() => setTeamMode(m => !m)}
                aria-pressed={teamMode}
                aria-label="Toggle team mode"
                className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                style={{ background: teamMode ? '#0F1B3D' : '#E5E7EB' }}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${teamMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {teamMode && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-600">Teams:</span>
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setTeamCount(n)}
                    className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                      teamCount === n
                        ? 'text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={teamCount === n ? { background: '#0F1B3D' } : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ghost Mode toggle */}
          {plan === 'pro' && (
            <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#E0E7FF' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: '#1E1B4B' }}>Ghost Mode</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Race against top players from a past session</p>
                </div>
                <button
                  onClick={() => setGhostMode(m => !m)}
                  aria-pressed={ghostMode}
                  aria-label="Toggle ghost mode"
                  className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                  style={{ background: ghostMode ? '#7C3AED' : '#E5E7EB' }}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ghostMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {ghostMode && (
                <div className="mt-3">
                  {ghostCandidates.length === 0 ? (
                    <p className="text-xs text-gray-400">No past sessions found for this quiz.</p>
                  ) : (
                    <select
                      value={ghostSessionId}
                      onChange={e => setGhostSessionId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    >
                      <option value="">Select a session to ghost…</option>
                      {ghostCandidates.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.date} · {c.participantCount} players · Top: {c.topName} ({c.topScore} pts)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {sessionError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">
              {sessionError}
            </div>
          )}

          <button
            onClick={createSession}
            disabled={!socketConnected || creating}
            className="w-full font-black rounded-2xl py-5 text-xl transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
          >
            {!socketConnected ? 'Connecting...' : creating ? 'Creating Session...' : 'Create Session'}
          </button>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="relative min-h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #46107a 0%, #7e1f9b 35%, #c32aa3 65%, #ff5a5f 100%)' }}>
          {/* Animated floating blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="lobby-blob" style={{ top: '-10%', left: '-10%', width: 420, height: 420, background: 'radial-gradient(circle, rgba(255,220,80,0.55), transparent 70%)', animationDelay: '0s' }} />
            <div className="lobby-blob" style={{ bottom: '-15%', right: '-5%', width: 520, height: 520, background: 'radial-gradient(circle, rgba(88,255,200,0.5), transparent 70%)', animationDelay: '-3s' }} />
            <div className="lobby-blob" style={{ top: '40%', left: '55%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,90,230,0.45), transparent 70%)', animationDelay: '-6s' }} />
            <div className="lobby-sparkle" style={{ top: '15%', left: '20%', animationDelay: '0s' }}>★</div>
            <div className="lobby-sparkle" style={{ top: '25%', right: '18%', animationDelay: '-1s' }}>✦</div>
            <div className="lobby-sparkle" style={{ bottom: '20%', left: '12%', animationDelay: '-2s' }}>✧</div>
            <div className="lobby-sparkle" style={{ bottom: '30%', right: '22%', animationDelay: '-1.5s' }}>★</div>
          </div>

          <div className="relative z-10 p-4 max-w-3xl mx-auto py-8 space-y-5">
            <div className="flex items-center justify-between">
              <QuizoticLogo variant="onDark" className="text-2xl" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white backdrop-blur">
                  {{ competitive: '⚡ Competitive', reflection: '🌙 Reflection', selfpaced: '🎯 Self-paced', assessment: '📋 Assessment' }[sessionMode] ?? '⚡ Competitive'}
                </span>
                <span className="text-sm font-black px-4 py-1.5 rounded-full text-[#46107a]" style={{ background: '#F5E642', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>
                  {participants.size} {participants.size === 1 ? 'player' : 'players'}
                </span>
              </div>
            </div>

            {/* Game code — HUGE */}
            <div className="rounded-3xl p-8 sm:p-10 text-center relative" style={{ background: 'rgba(255,255,255,0.96)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', transform: 'translateY(0)' }}>
              <p className="text-xs tracking-[0.4em] font-black uppercase mb-3" style={{ color: '#7e1f9b' }}>Game PIN</p>
              <p
                className="font-black leading-none select-all"
                style={{
                  fontSize: 'clamp(72px, 15vw, 144px)',
                  letterSpacing: '0.1em',
                  backgroundImage: 'linear-gradient(135deg, #46107a 0%, #c32aa3 50%, #ff5a5f 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {gameCode}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 mt-8 justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white rounded-2xl border-2" style={{ borderColor: '#c32aa3', boxShadow: '0 8px 0 rgba(70,16,122,0.25)' }}>
                    <QRCode
                      value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}`}
                      size={150}
                      bgColor="#ffffff"
                      fgColor="#46107a"
                    />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7e1f9b' }}>Scan to join</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: '#7e1f9b' }}>Or visit</p>
                  <p className="text-2xl font-black" style={{ color: '#46107a', fontFamily: 'var(--font-heading)' }}>quizotic.live/join</p>
                  <p className="text-sm mt-1" style={{ color: '#64748B' }}>and enter code <span className="font-mono font-black" style={{ color: '#46107a' }}>{gameCode}</span></p>
                </div>
              </div>
            </div>

            {/* Share / LMS links */}
            {gameCode && (
              <ShareLinks gameCode={gameCode} quizTitle={quiz?.title ?? ''} />
            )}

            {/* Players grid */}
            <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: '1.5px solid rgba(255,255,255,0.22)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                  {participants.size === 0 ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#F5E642' }} />
                      Waiting for players…
                    </>
                  ) : (
                    <>
                      <span>🎉</span> {participants.size} joined
                    </>
                  )}
                </p>
              </div>
              {participants.size === 0 ? (
                <p className="text-white/70 text-sm">Players will appear here as they join. Share the code above.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {Array.from(participants.entries()).map(([pName, pInfo]) => (
                    <div key={pName} className="flex flex-col items-center gap-1 lobby-join-pop">
                      <div className="ring-2 rounded-full overflow-hidden" style={{ borderColor: pInfo.team?.color ?? '#F5E642' }}>
                        <Avatar archetype={pInfo.archetype} size={56} />
                      </div>
                      <p className="text-sm text-white font-bold max-w-[80px] truncate text-center">{pName}</p>
                      {pInfo.team ? (
                        <p className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: pInfo.team.color }}>{pInfo.team.name}</p>
                      ) : (
                        <p className="text-xs text-white/60 max-w-[80px] truncate text-center">{pInfo.archetype}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!socketConnected && (
              <div className="bg-red-500/90 text-white rounded-xl p-4 text-sm font-bold border border-red-300">
                Connection lost. Reconnecting…
              </div>
            )}

            {sessionError && (
              <div className="bg-red-500/90 text-white rounded-xl p-4 text-sm font-bold border border-red-300">
                {sessionError}
              </div>
            )}

            <button
              onClick={startQuiz}
              disabled={participants.size === 0 || !socketConnected}
              className="w-full font-black rounded-2xl py-5 text-xl disabled:opacity-40 disabled:pointer-events-none transition-all hover:scale-[1.01]"
              style={{
                background: participants.size > 0 && socketConnected ? 'linear-gradient(135deg, #F5E642 0%, #FFB800 100%)' : 'rgba(255,255,255,0.25)',
                color: participants.size > 0 && socketConnected ? '#46107a' : '#ffffff',
                boxShadow: participants.size > 0 && socketConnected ? '0 8px 0 rgba(0,0,0,0.2)' : undefined,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {!socketConnected ? 'Reconnecting…' : participants.size === 0 ? 'Waiting for players…' : `▶ Start Quiz (${participants.size})`}
            </button>
          </div>

          <style jsx>{`
            .lobby-blob {
              position: absolute;
              border-radius: 50%;
              filter: blur(40px);
              animation: lobbyFloat 9s ease-in-out infinite;
            }
            .lobby-sparkle {
              position: absolute;
              font-size: 28px;
              color: rgba(255,255,255,0.6);
              animation: lobbyTwinkle 3s ease-in-out infinite;
            }
            @keyframes lobbyFloat {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33%      { transform: translate(30px, -40px) scale(1.08); }
              66%      { transform: translate(-25px, 25px) scale(0.95); }
            }
            @keyframes lobbyTwinkle {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50%      { opacity: 1;   transform: scale(1.25); }
            }
            .lobby-join-pop { animation: lobbyJoinPop 0.45s ease-out both; }
            @keyframes lobbyJoinPop {
              0%   { transform: scale(0.6) translateY(14px); opacity: 0; }
              60%  { transform: scale(1.08) translateY(0); opacity: 1; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* QUESTION */}
      {phase === 'question' && currentQuestion && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          {/* Persistent join pill — lets late participants jump in mid-session */}
          <JoinPill gameCode={gameCode} />
          {/* 3-2-1 Countdown overlay */}
          {countdownValue !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,27,61,0.92)' }}>
              <div className="text-center">
                <div
                  key={countdownValue}
                  className="text-white font-black"
                  style={{
                    fontSize: 200,
                    lineHeight: 1,
                    fontFamily: 'var(--font-heading)',
                    color: '#F5E642',
                    animation: 'countdownPop 0.9s ease-out forwards',
                  }}
                >
                  {countdownValue}
                </div>
                <p className="text-2xl font-bold mt-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Get ready!</p>
              </div>
              <style>{`
                @keyframes countdownPop {
                  0%   { transform: scale(1.4); opacity: 0.6; }
                  30%  { transform: scale(1.0); opacity: 1; }
                  80%  { transform: scale(1.0); opacity: 1; }
                  100% { transform: scale(0.7); opacity: 0; }
                }
              `}</style>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xl text-gray-500 font-semibold">Q{questionIndex + 1} / {quiz.questions.length}</span>
            <div className="flex items-center gap-3">
              {currentQuestion.timerSeconds > 0 && (
                questionStartedAt == null || Date.now() < questionStartedAt ? (
                  <span className="text-sm font-semibold text-gray-400 animate-pulse px-3 py-1">Loading…</span>
                ) : (
                  <CircularTimer timeLeft={hostTimeLeft} total={currentQuestion.timerSeconds} />
                )
              )}
              <span className="bg-blue-50 border border-blue-100 rounded-full px-5 py-2 text-xl font-bold" style={{ color: '#0F1B3D' }}>
                {answered} / {participants.size} answered
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-300"
              style={{ width: participants.size > 0 ? `${(answered / participants.size) * 100}%` : '0%' }}
            />
          </div>

          {/* Case scenario card (shown for 'case' type) */}
          {currentQuestion.type === 'case' && currentQuestion.scenarioText && (
            <div className="rounded-2xl p-6 border" style={{ background: '#0F1B3D', borderColor: '#1E2A4F' }}>
              <p className="text-base font-bold uppercase tracking-widest mb-2" style={{ color: '#6B8AFF' }}>Scenario</p>
              <p className="text-xl leading-relaxed" style={{ color: '#E0E7FF' }}>{currentQuestion.scenarioText}</p>
              {currentQuestion.supportingDetail && (
                <p className="mt-3 font-bold text-lg" style={{ color: '#FFD166' }}>{currentQuestion.supportingDetail}</p>
              )}
            </div>
          )}

          {/* Question card — text auto-scales so long questions stay in view */}
          <div className={`bg-white rounded-2xl shadow-sm border p-8 ${currentQuestion.type === 'case' ? 'border-blue-200 border-t-4 border-t-blue-500' : 'border-gray-200 border-t-4 border-t-amber-400'}`}>
            <p
              className="font-bold leading-snug break-words"
              style={{
                color: '#0F1B3D',
                fontSize: (() => {
                  const len = currentQuestion.text.length
                  if (len > 240) return '1.125rem'
                  if (len > 180) return '1.25rem'
                  if (len > 120) return '1.5rem'
                  if (len > 70) return '1.75rem'
                  return '1.875rem'
                })(),
                lineHeight: 1.3,
              }}
            >
              {currentQuestion.text}
            </p>
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt={`Image for question ${questionIndex + 1}`} className="mt-4 rounded-xl max-h-64 w-full object-contain" loading="lazy" />
            )}
          </div>

          {/* Ranking: show average rank per option */}
          {currentQuestion.type === 'ranking' ? (
            (() => {
              const numOpts = currentQuestion.options?.length ?? 0
              const sums = Array(numOpts).fill(0)
              const counts = Array(numOpts).fill(0)
              for (const arr of rankingSubmissions) {
                if (!Array.isArray(arr)) continue
                for (let pos = 0; pos < arr.length; pos++) {
                  const optIdx = arr[pos]
                  if (typeof optIdx === 'number' && optIdx >= 0 && optIdx < numOpts) {
                    sums[optIdx] += pos + 1
                    counts[optIdx] += 1
                  }
                }
              }
              const rows = (currentQuestion.options ?? []).map((opt, i) => ({
                i,
                label: OPTION_LABELS[i] ?? String(i + 1),
                text: getOptionText(opt),
                avg: counts[i] > 0 ? sums[i] / counts[i] : Number.POSITIVE_INFINITY,
                hasData: counts[i] > 0,
              })).sort((a, b) => a.avg - b.avg)
              return (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Consensus ranking · {rankingSubmissions.length} submission{rankingSubmissions.length !== 1 ? 's' : ''}</p>
                  {rows.map((row, pos) => (
                    <div key={row.i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black bg-gray-100 text-gray-600 flex-shrink-0">
                        {pos + 1}
                      </span>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${OPTION_COLORS[row.i]}`}>
                        {row.label}
                      </span>
                      <span className="flex-1 text-base text-gray-800 font-medium">{row.text}</span>
                      <span className="text-sm font-bold text-gray-600 tabular-nums">
                        {row.hasData ? `avg ${row.avg.toFixed(1)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()
          ) : currentQuestion.type === 'wordcloud' ? (
            (() => {
              // Tag cloud: frequency → font size, index → color, deterministic angle.
              const CLOUD_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#7C3AED', '#EC4899', '#0EA5E9', '#F97316']
              const normalize = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').trim()
              const freq = new Map<string, { display: string; count: number }>()
              for (const w of wordcloudWords) {
                const key = normalize(w)
                if (!key) continue
                const existing = freq.get(key)
                if (existing) existing.count += 1
                else freq.set(key, { display: w.trim(), count: 1 })
              }
              const entries = Array.from(freq.values()).sort((a, b) => b.count - a.count)
              const maxCount = entries[0]?.count ?? 1
              return (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[240px] relative overflow-hidden">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Word cloud · {wordcloudWords.length} word{wordcloudWords.length !== 1 ? 's' : ''} from {freq.size} unique
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-gray-400 italic text-center py-12">Waiting for responses…</p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-4">
                      {entries.map((entry, i) => {
                        const ratio = entry.count / maxCount
                        const fontSize = Math.round(16 + ratio * 44)
                        const color = CLOUD_COLORS[i % CLOUD_COLORS.length]
                        const angle = (i * 37) % 25 - 12 // deterministic -12..+12 degrees
                        return (
                          <span
                            key={entry.display + i}
                            className="inline-block font-black transition-all"
                            style={{
                              fontSize,
                              color,
                              transform: `rotate(${angle}deg)`,
                              fontFamily: 'var(--font-heading)',
                              lineHeight: 1.1,
                              padding: '2px 4px',
                            }}
                            title={`${entry.display} — ${entry.count}×`}
                          >
                            {entry.display}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()
          ) : currentQuestion.type === 'rating' ? (
            (() => {
              const total = ratingValues.length
              const sum = ratingValues.reduce((s, v) => s + v, 0)
              const avg = total > 0 ? sum / total : 0
              const buckets = [0, 0, 0, 0, 0]
              for (const v of ratingValues) {
                if (v >= 1 && v <= 5) buckets[v - 1] += 1
              }
              const maxBucket = Math.max(1, ...buckets)
              return (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                  <div className="flex items-end gap-3">
                    <span className="text-6xl font-black tabular-nums" style={{ color: '#F59E0B', fontFamily: 'var(--font-heading)' }}>
                      {total > 0 ? avg.toFixed(1) : '—'}
                    </span>
                    <span className="text-xl text-gray-500 pb-2">/ 5</span>
                    <span className="ml-auto text-sm font-bold text-gray-500 pb-2">
                      {total} response{total !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1 text-4xl">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} style={{ color: n <= Math.round(avg) ? '#F59E0B' : '#E5E7EB' }}>★</span>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map(n => {
                      const c = buckets[n - 1]
                      const pct = (c / maxBucket) * 100
                      return (
                        <div key={n} className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-600 w-8 tabular-nums">{n}★</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#F59E0B' }} />
                          </div>
                          <span className="text-sm font-bold text-gray-500 w-8 text-right tabular-nums">{c}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : currentQuestion.type === 'qa' ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Questions from participants · {qaEntries.length}
              </p>
              {qaEntries.length === 0 ? (
                <p className="text-gray-400 italic text-center py-10">Waiting for questions…</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {qaEntries.map((e, i) => (
                    <div key={`${e.at}-${i}`} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-xs" style={{ background: '#7C3AED' }}>
                        {(e.name[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-500 truncate">{e.name}{e.archetype && ` · ${e.archetype}`}</p>
                        <p className="text-base text-gray-900 leading-snug mt-0.5 break-words">{e.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentQuestion.type === 'openended' ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Responses · {openendedEntries.length}
              </p>
              {openendedEntries.length === 0 ? (
                <p className="text-gray-400 italic text-center py-10">Waiting for responses…</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {openendedEntries.map((e, i) => (
                    <div key={`${e.at}-${i}`} className="p-4 rounded-xl border-l-4 bg-gradient-to-br from-white to-gray-50" style={{ borderLeftColor: ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#7C3AED'][i % 5] }}>
                      <p className="text-[11px] font-bold text-gray-500 mb-1 truncate">{e.name}{e.archetype && ` · ${e.archetype}`}</p>
                      <p className="text-sm text-gray-900 leading-snug break-words">{e.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4">
            {getEffectiveOptions(currentQuestion)?.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = participants.size > 0 ? (votes / participants.size) * 100 : 0
              const isCorrect = String(i) === currentQuestion.correctAnswer
              // Green ring only for scored types AND only after host reveals the answer.
              // This prevents leaking the correct answer on projector screens.
              const highlightCorrect = isScoredType(currentQuestion.type) && isCorrect && correctRevealed
              const optText = getOptionText(opt)
              const optImage = getOptionImage(opt)
              return (
                <div
                  key={i}
                  className={`rounded-xl overflow-hidden border ${highlightCorrect ? 'ring-2 ring-green-400 border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}
                >
                  {optImage && (
                    <img src={optImage} alt="" className="w-full h-32 object-cover" loading="lazy" />
                  )}
                  <div className="p-5 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${OPTION_COLORS[i]}`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-xl flex-1 text-gray-800 font-medium">{optText}</span>
                    <span className="text-lg font-bold text-gray-400">{votes}</span>
                    {highlightCorrect && <span className="text-green-600 text-lg font-bold">✓</span>}
                  </div>
                  <div className="h-2 bg-gray-100">
                    <div
                      className={`h-full transition-all duration-500 ${OPTION_COLORS[i]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {/* Drawing gallery — P3.4 */}
          {currentQuestion.type === 'drawing' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Drawings received ({drawings.length})
              </p>
              {drawings.length === 0 ? (
                <p className="text-sm text-gray-400">Waiting for participants to draw…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {drawings.map((d, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                      <img src={d.dataUrl} alt={`Drawing by ${d.name}`} className="w-full object-cover" />
                      <p className="text-xs font-semibold text-center text-gray-600 py-1 px-2 truncate">{d.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quizotic watermark — free plan */}
          {plan === 'free' && (
            <div className="text-right mt-1">
              <span className="text-[10px] font-bold opacity-30" style={{ color: '#64748B' }}>quizotic.live</span>
            </div>
          )}

          {/* Non-competitive flows (poll / reflection / self-paced) stay on
              the question screen after ending — they have no ranked standings
              to reveal. Competitive quizzes transition to the dedicated
              'standings' phase instead. */}
          {sessionMode !== 'competitive' && explanation && (
            <div className={`rounded-xl p-5 text-lg ${currentQuestion.type === 'case' ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
              <span className={`font-bold ${currentQuestion.type === 'case' ? 'text-blue-600' : 'text-blue-600'}`}>
                {currentQuestion.type === 'case' ? 'Expert View: ' : 'Explanation: '}
              </span>
              {explanation}
            </div>
          )}

          {sessionMode !== 'competitive' && isScoredType(currentQuestion.type) && questionEnded && !correctRevealed && (
            <button
              onClick={() => setCorrectRevealed(true)}
              className="w-full py-4 rounded-2xl font-bold text-lg border-2 transition-all hover:scale-[1.01]"
              style={{ borderColor: '#16A34A', color: '#fff', background: '#16A34A' }}
            >
              Reveal Correct Answer
            </button>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              onClick={() => {
                if (paused) {
                  socketRef.current?.emit('resume_quiz', { gameCode })
                  setPaused(false)
                } else {
                  socketRef.current?.emit('pause_quiz', { gameCode })
                  setPaused(true)
                }
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-sm border-2 transition-all hover:scale-[1.02]"
              style={{
                borderColor: paused ? '#16A34A' : '#F59E0B',
                color: paused ? '#16A34A' : '#92400E',
                background: paused ? '#F0FDF4' : '#FFFBEB',
              }}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            {(() => {
              const isLast = questionIndex + 1 >= quiz.questions.length
              const scoredQ = isScoredType(currentQuestion.type)
              const goesToStandings = sessionMode === 'competitive' && scoredQ && questionEnded && !isLast
              const label = isLast
                ? 'End Quiz'
                : goesToStandings
                  ? 'View Standings'
                  : 'Next Question'
              return (
                <button
                  onClick={goesToStandings ? advanceFromQuestion : nextQuestion}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-black font-black text-sm rounded-full hover:bg-amber-300 transition-colors shadow-md ${
                    questionEnded ? 'animate-pulse' : ''
                  }`}
                >
                  {label}
                  <span aria-hidden>→</span>
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* STANDINGS — dedicated between-questions screen for competitive quizzes */}
      {phase === 'standings' && quiz && currentQuestion && (
        <div className="p-4 max-w-4xl mx-auto py-8 space-y-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>
              After Question {questionIndex + 1} of {quiz.questions.length}
            </p>
            <h2 className="text-3xl md:text-4xl font-black mt-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              Current Standings
            </h2>
          </div>

          {intermediateLeaderboard.length > 0 && (
            <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '18px 12px', minHeight: 360 }}>
              <LeaderboardView
                variant="fullscreen"
                topN={10}
                heading="Leaderboard"
                rows={intermediateLeaderboard.map(entry => ({
                  id: entry.name,
                  name: entry.name,
                  score: entry.score,
                  archetype: entry.archetype,
                }))}
              />
            </div>
          )}

          {teamMode && teamLeaderboard && teamLeaderboard.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Team Standings</p>
              <div className="space-y-2">
                {teamLeaderboard.map((team, i) => (
                  <div key={team.name} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-black" style={{ color: '#0F1B3D' }}>{i + 1}</span>
                    <span className="text-white text-xs rounded-full px-2.5 py-0.5 font-bold" style={{ background: team.color }}>{team.name}</span>
                    <span className="flex-1 text-xs text-gray-400">{team.members} {team.members === 1 ? 'member' : 'members'}</span>
                    <span className="text-sm font-black tabular-nums" style={{ color: '#0F1B3D' }}>{team.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {explanation && (
            <div className={`rounded-2xl p-5 text-base ${currentQuestion.type === 'case' ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
              <span className="font-bold text-blue-600">
                {currentQuestion.type === 'case' ? 'Expert View: ' : 'Why? '}
              </span>
              {explanation}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button
              onClick={nextQuestion}
              className="inline-flex items-center gap-2 px-7 py-3 bg-amber-400 text-black font-black text-base rounded-full hover:bg-amber-300 transition-colors shadow-md"
            >
              {questionIndex + 1 >= quiz.questions.length ? 'End Quiz' : 'Next Question'}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <>
        <PostSessionHeader
          title={quiz?.title}
          subtitle={leaderboard.length > 0 ? `${leaderboard.length} participant${leaderboard.length === 1 ? '' : 's'} · Session complete` : 'Session complete'}
          onBack={goBackToLibrary}
          dimmed={showCelebration && leaderboard.length > 0}
        />
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <h2 className="text-4xl font-black" style={{ color: '#0F1B3D' }}>Session Complete</h2>

          {/* Team Leaderboard */}
          {teamLeaderboard && teamLeaderboard.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Team Standings</h3>
              {teamLeaderboard.map((team, i) => (
                <div key={team.name} className="flex items-center gap-3 rounded-xl p-4 bg-white border border-gray-200">
                  <span className="text-2xl font-black w-8 text-center" style={{ color: team.color }}>
                    {i === 0 ? '🏆' : i + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: team.color }}>
                    {team.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg" style={{ color: '#1E1B4B' }}>Team {team.name}</p>
                    <p className="text-sm text-gray-500">{team.members} member{team.members !== 1 ? 's' : ''}</p>
                  </div>
                  {sessionMode === 'competitive' && (
                    <span className="text-xl font-black tabular-nums" style={{ color: team.color }}>{team.score.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Animated Podium Leaderboard (static once the CelebrationOverlay has played).
              Kept hidden while the CelebrationOverlay is active so the winner
              isn't spoiled by a 1-frame paint under the modal. visibility:hidden
              preserves layout; aria-hidden keeps it out of the a11y tree. */}
          <div
            style={{
              visibility: showCelebration && leaderboard.length > 0 ? 'hidden' : 'visible',
              opacity: showCelebration && leaderboard.length > 0 ? 0 : 1,
              transition: 'opacity 220ms ease-out',
              overflow: 'hidden',
              borderRadius: 18,
            }}
            aria-hidden={showCelebration && leaderboard.length > 0}
          >
            <Podium
              leaderboard={leaderboard}
              sessionMode={sessionMode}
              skipIntro
              loopConfetti={!showCelebration && sessionMode === 'competitive'}
            />
          </div>
          {/* Continuous celebration backdrop — paints falling particles across
              the Session Report until the host clicks Back to Library (which
              unmounts this page). Gated on competitive mode and the
              CelebrationOverlay having been dismissed so we don't double up. */}
          <CelebrationConfetti active={!showCelebration && sessionMode === 'competitive' && leaderboard.length > 0} />

          {showCelebration && leaderboard.length > 0 && (
            <CelebrationOverlay
              leaderboard={leaderboard}
              sessionMode={sessionMode}
              title={quiz?.title ? `${quiz.title} — Complete!` : 'Quiz Complete!'}
              onDismiss={() => setShowCelebration(false)}
            />
          )}

          {/* Session Report */}
          <SessionReport
            questionStats={questionStats}
            quizTitle={quiz?.title}
            participantCount={leaderboard.length}
            sessionDate={new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            attendees={attendees}
          />

          {/* Reflection Insights */}
          <ReflectionInsights gameCode={gameCode} questionStats={questionStats} />

          {/* Share Quizotic with colleagues */}
          <ShareQuizotic context="host-ended" />

          {/* Spaced Follow-up Series */}
          <div className="rounded-2xl border p-5" style={{ borderColor: '#DBEAFE', background: '#F3F4F6' }}>
            <p className="text-sm font-black mb-0.5" style={{ fontFamily: 'var(--font-heading)', color: '#1E1B4B' }}>
              Lock in the learning
            </p>
            <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
              Spaced follow-ups bring knowledge back at Day 1, Day 7, and Day 30. Share links with participants.
            </p>

            {followups.length === 0 ? (
              <div>
                <button
                  onClick={generateFollowups}
                  disabled={followupLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
                >
                  {followupLoading ? 'Generating…' : 'Create Follow-up Series'}
                </button>
                {followupError && <p className="text-red-500 text-xs mt-2">{followupError}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {followups.map(fu => (
                  <div key={fu.code}
                    className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border"
                    style={{ borderColor: '#DBEAFE' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#1E1B4B' }}>{fu.label}</p>
                      <p className="text-xs font-mono" style={{ color: '#0F1B3D' }}>{fu.code}</p>
                    </div>
                    <button
                      onClick={() => copyFollowupLink(fu.code)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all"
                      style={{
                        borderColor: copiedCode === fu.code ? '#0F1B3D' : '#DBEAFE',
                        color: copiedCode === fu.code ? '#0F1B3D' : '#6B7280',
                        background: copiedCode === fu.code ? '#F3F4F6' : '#fff',
                      }}
                    >
                      {copiedCode === fu.code ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 mt-2">
            {/* Row 1: Primary CTA */}
            <button
              onClick={() => {
                if (quiz) {
                  setActiveSession(quiz)
                  setPhase('idle')
                  setLeaderboard([])
                  setTeamLeaderboard(null)
                  setQuestionStats([])
                  setQuestionIndex(0)
                  setAnswered(0)
                  setOptionCounts([])
                  setExplanation(null)
                  setFollowups([])
                  setParticipants(new Map())
                  setGameCode('')
                  socketInitialized.current = false
                }
              }}
              className="w-full font-bold rounded-xl py-4 text-lg transition-all hover:scale-[1.02]"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              Play Again
            </button>

            {/* Row 2: Export grid */}
            <div className={`grid gap-2 ${plan === 'pro' && gameCode ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1'}`}>
              <button
                onClick={() => {
                  if (!quiz || leaderboard.length === 0) return
                  const rows = [['Rank', 'Name', 'Score']]
                  leaderboard.forEach((entry, i) => {
                    rows.push([String(i + 1), entry.name, String(entry.score)])
                  })
                  if (questionStats.length > 0) {
                    rows.push([])
                    rows.push(['Question', 'Correct %', 'Type', 'Text'])
                    questionStats.forEach((stat, i) => {
                      const pctStr = stat.isNonScored || stat.correctPct == null ? 'N/A' : `${stat.correctPct}%`
                      const typeStr = stat.type || 'mcq'
                      rows.push([`Q${i + 1}`, pctStr, typeStr, `"${stat.text.replace(/"/g, '""')}"`])
                    })
                  }
                  const csv = rows.map(r => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="w-full font-semibold rounded-xl py-2.5 text-sm border border-gray-200 hover:border-gray-400 transition-all text-gray-700 bg-white"
              >
                CSV
              </button>
              {plan === 'pro' && gameCode && (
                <>
                  <a
                    href={`/api/sessions/${gameCode}/export/xlsx`}
                    download
                    className="w-full font-semibold rounded-xl py-2.5 text-sm border border-gray-200 hover:border-gray-400 transition-all text-center text-gray-700 bg-white"
                  >
                    XLSX
                  </a>
                  <a
                    href={`/api/sessions/${gameCode}/export/pdf`}
                    download
                    className="w-full font-semibold rounded-xl py-2.5 text-sm border border-gray-200 hover:border-gray-400 transition-all text-center text-gray-700 bg-white"
                  >
                    PDF
                  </a>
                </>
              )}
            </div>
          </div>

          <button
            onClick={goBackToLibrary}
            className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
          >
            Back to Library
          </button>
        </div>
        </>
      )}

    </div>
  )
}
