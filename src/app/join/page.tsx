'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { CircularTimer } from '@/components/CircularTimer'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { ReflectionMoment } from '@/components/ReflectionMoment'
import { playTick, playCorrect, playWrong, playStreak } from '@/lib/sounds'

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'form' | 'connecting' | 'lobby' | 'question' | 'answered' | 'ended' | 'selfpaced' | 'selfpaced-done'
  | 'presenter-lobby' | 'presenter-voting' | 'presenter-voted'

type QuestionOption = string | { text: string; imageUrl?: string }

function getOptText(opt: QuestionOption): string {
  return typeof opt === 'string' ? opt : opt.text
}

function getOptImage(opt: QuestionOption): string | undefined {
  return typeof opt === 'string' ? undefined : opt.imageUrl
}

interface Question {
  id: string
  type: string
  text: string
  imageUrl?: string       // question context image (CDN URL)
  options?: QuestionOption[]
  timerSeconds: number
  points: number
  index: number
  total: number
  scenarioText?: string
  supportingDetail?: string
  correctAnswer?: string  // available in self-paced (follow-up) mode
  explanation?: string    // available in self-paced (follow-up) mode
}

interface LeaderboardEntry {
  name: string
  archetype: string
  score: number
}

const OPTION_GRADIENTS = [
  'bg-gradient-to-br from-pink-700 to-pink-500 shadow-[0_4px_16px_rgba(236,72,153,0.25)]',
  'bg-gradient-to-br from-orange-700 to-orange-500 shadow-[0_4px_16px_rgba(249,115,22,0.25)]',
  'bg-gradient-to-br from-blue-700 to-blue-500 shadow-[0_4px_16px_rgba(59,130,246,0.25)]',
  'bg-gradient-to-br from-green-700 to-green-500 shadow-[0_4px_16px_rgba(34,197,94,0.25)]',
  'bg-gradient-to-br from-purple-700 to-purple-500 shadow-[0_4px_16px_rgba(168,85,247,0.25)]',
]
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']
const TEXT_INPUT_TYPES = ['openended', 'wordcloud', 'qa']

// ─── Star Rating Component ───────────────────────────────────────────────────
function StarRating({ max, minLabel, maxLabel, textLight, onSubmit }: {
  max: number; minLabel?: string; maxLabel?: string; textLight: string
  onSubmit: (value: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm opacity-50" style={{ color: textLight }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <div className="flex justify-center" style={{ gap: max <= 5 ? 12 : max <= 7 ? 8 : 4 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const active = n <= (hovered || selected)
          const size = max <= 5 ? 'w-12 h-12' : max <= 7 ? 'w-10 h-10' : 'w-8 h-8'
          return (
            <button key={n}
              onPointerEnter={() => setHovered(n)}
              onPointerLeave={() => setHovered(0)}
              onClick={() => setSelected(n)}
              className={`transition-all duration-150 active:scale-90 ${size}`}
              style={{ transform: active ? 'scale(1.15)' : 'scale(1)' }}>
              <svg viewBox="0 0 24 24" className="w-full h-full" style={{ filter: active ? 'drop-shadow(0 0 6px rgba(250,204,21,0.5))' : 'none' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={active ? '#FACC15' : 'rgba(255,255,255,0.1)'}
                  stroke={active ? '#EAB308' : 'rgba(255,255,255,0.25)'}
                  strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          )
        })}
      </div>
      <div className="text-center">
        <span className="text-3xl font-black" style={{ color: selected > 0 ? '#FACC15' : 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-heading)' }}>
          {selected > 0 ? `${selected} / ${max}` : 'Tap a star'}
        </span>
      </div>
      <button onClick={() => { if (selected > 0) onSubmit(selected) }}
        disabled={selected === 0}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
        Submit
      </button>
    </div>
  )
}

// ─── Pinpoint Component ──────────────────────────────────────────────────────
function PinpointInput({ imageUrl, onSubmit }: {
  imageUrl?: string; onSubmit: (value: { x: number; y: number }) => void
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleTap(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setPin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center opacity-50" style={{ color: 'white' }}>Tap to place your pin</p>
      <div ref={containerRef} onPointerDown={handleTap}
        className="relative rounded-2xl overflow-hidden border"
        style={{
          aspectRatio: '4/3', cursor: 'crosshair',
          background: imageUrl ? '#000' : 'rgba(255,255,255,0.05)',
          borderColor: 'rgba(255,255,255,0.15)',
        }}>
        {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" />}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-20" style={{ color: 'white' }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {pin && (
          <div className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: '#EF4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
        )}
      </div>
      <button onClick={() => { if (pin) onSubmit(pin) }}
        disabled={!pin}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
        {pin ? 'Submit Pin' : 'Tap the image first'}
      </button>
    </div>
  )
}

// ─── Grid 2x2 Component ─────────────────────────────────────────────────────
function Grid2x2Input({ xMin, xMax, yMin, yMax, onSubmit }: {
  xMin?: string; xMax?: string; yMin?: string; yMax?: string
  onSubmit: (value: { x: number; y: number }) => void
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleTap(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setPin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center opacity-50" style={{ color: 'white' }}>Tap to place yourself on the grid</p>
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-1 top-0 bottom-0 flex flex-col justify-between items-center py-1 z-10" style={{ width: 20 }}>
          <span className="text-[10px] font-bold" style={{ color: '#6B8AFF' }}>{yMax || 'High'}</span>
          <span className="text-[10px] font-bold" style={{ color: '#6B8AFF' }}>{yMin || 'Low'}</span>
        </div>
        <div className="ml-6">
          {/* Grid area */}
          <div ref={containerRef} onPointerDown={handleTap}
            className="relative rounded-xl overflow-hidden"
            style={{
              aspectRatio: '1', cursor: 'crosshair',
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}>
            {/* Grid lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            {/* Pin */}
            {pin && (
              <div className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: '#8B5CF6', boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
            )}
          </div>
          {/* X-axis labels */}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-bold" style={{ color: '#6B8AFF' }}>{xMin || 'Low'}</span>
            <span className="text-[10px] font-bold" style={{ color: '#6B8AFF' }}>{xMax || 'High'}</span>
          </div>
        </div>
      </div>
      <button onClick={() => { if (pin) onSubmit(pin) }}
        disabled={!pin}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
        {pin ? 'Submit' : 'Tap the grid first'}
      </button>
    </div>
  )
}

// ─── Inner Component (uses useSearchParams — requires Suspense) ───────────────
function JoinPageInner() {
  const searchParams = useSearchParams()
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answerTimeRef = useRef<number>(0)

  const followupParam = searchParams.get('followup')
  const modeParam = searchParams.get('mode') // 'presenter' for presenter sessions
  const [phase, setPhase] = useState<Phase>(followupParam ? 'connecting' : 'form')
  const [code, setCode] = useState(searchParams.get('code') ?? '')

  // Presenter mode state
  const [presenterTitle, setPresenterTitle] = useState('')
  const [presenterSlideIndex, setPresenterSlideIndex] = useState(0)
  const [presenterTotalSlides, setPresenterTotalSlides] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [presenterCurrentSlide, setPresenterCurrentSlide] = useState<any>(null)
  const [presenterVoted, setPresenterVoted] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')

  // Avatar
  const [archetype, setArchetype] = useState<string | null>(null)
  const [avatarRevealed, setAvatarRevealed] = useState(false)
  const [sessionMode, setSessionMode] = useState<'competitive' | 'reflection'>('competitive')
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [team, setTeam] = useState<{ index: number; name: string; color: string } | null>(null)
  const [teamLeaderboard, setTeamLeaderboard] = useState<{ name: string; color: string; score: number; members: number }[] | null>(null)

  // Question
  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  // Text answer (for open-ended, word cloud, Q&A)
  const [textAnswer, setTextAnswer] = useState('')

  // Confidence tap
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure' | null>(null)

  // Answered
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [explanation, setExplanation] = useState<string | null>(null)

  // Streak + reactions
  const [streak, setStreak] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showRedFlash, setShowRedFlash] = useState(false)

  // Ended
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number>(0)

  // Self-paced follow-up state
  const [spQuestions, setSpQuestions] = useState<Question[]>([])
  const [spIndex, setSpIndex] = useState(0)
  const [spScore, setSpScore] = useState(0)
  const [spLabel, setSpLabel] = useState('')
  const [spSelected, setSpSelected] = useState<string | null>(null)
  const [spCorrect, setSpCorrect] = useState<boolean | null>(null)
  const [spShowAnswer, setSpShowAnswer] = useState(false)
  const followupCodeRef = useRef('')

  const gameCodeRef = useRef('')
  const displayNameRef = useRef('')
  const shownQuestionsRef = useRef<{ index: number; text: string }[]>([])

  const [reflectionVisible, setReflectionVisible] = useState(false)

  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(() => setReflectionVisible(true), 2500)
      return () => clearTimeout(t)
    } else {
      setReflectionVisible(false)
    }
  }, [phase])

  useEffect(() => {
    const socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      // Re-join session on reconnect if we were already in a game
      if (gameCodeRef.current && displayNameRef.current && phase !== 'form') {
        socket.emit('join_session', {
          gameCode: gameCodeRef.current,
          displayName: displayNameRef.current,
        }, () => {})
      }
    })

    socket.on('disconnect', () => {
      // Show reconnecting indicator if in an active session
      if (phase !== 'form' && phase !== 'ended') {
        setError('Connection lost. Reconnecting...')
      }
    })

    socket.on('connect_error', () => {
      if (phase !== 'form') {
        setError('Connection lost. Reconnecting...')
      }
    })

    socket.on('question_show', ({ question, index, total }: { question: Omit<Question, 'index' | 'total'>; index: number; total: number }) => {
      shownQuestionsRef.current.push({ index, text: question.text })
      setQuestion({ ...question, index, total })
      setSelectedAnswer(null)
      setPendingAnswer(null)
      setConfidence(null)
      setExplanation(null)
      setTextAnswer('')
      setShowConfetti(false)
      setShowRedFlash(false)
      setTimeLeft(question.timerSeconds)
      setPhase('question')
      answerTimeRef.current = Date.now()

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
          // Tick sound in last 5 seconds
          if (prev <= 6 && prev > 1) playTick()
          return prev - 1
        })
      }, 1000)
    })

    socket.on('answer_confirmed', ({ isCorrect, points, totalScore }: { isCorrect: boolean; points: number; totalScore: number }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsCorrect(isCorrect)
      setPointsEarned(points)
      setTotalScore(totalScore)
      setPhase('answered')

      // Sound + visual reactions
      if (isCorrect) {
        setStreak(prev => {
          const next = prev + 1
          if (next >= 3) playStreak()
          else playCorrect()
          return next
        })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2000)
      } else {
        setStreak(0)
        playWrong()
        setShowRedFlash(true)
        setTimeout(() => setShowRedFlash(false), 600)
      }
    })

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
    })

    socket.on('session_ended', ({ leaderboard, teamLeaderboard: tlb, sessionMode: sm }: {
      leaderboard: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      sessionMode: 'competitive' | 'reflection';
    }) => {
      setLeaderboard(leaderboard)
      setTeamLeaderboard(tlb ?? null)
      if (sm) setSessionMode(sm)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setMyRank(rank)
      setPhase('ended')
    })

    socket.on('quiz_paused', () => {
      if (timerRef.current) clearInterval(timerRef.current)
    })

    socket.on('quiz_resumed', () => {
      if (phase === 'question' && timeLeft > 0) {
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
            if (prev <= 6 && prev > 1) playTick()
            return prev - 1
          })
        }, 1000)
      }
    })

    socket.on('host_disconnected', () => {
      setError('The host has left. Session ended.')
      setPhase('form')
    })

    // Presenter mode events
    socket.on('presenter_slide_changed', ({ slideIndex, total, slide }: { slideIndex: number; total: number; slide?: unknown }) => {
      setPresenterSlideIndex(slideIndex)
      setPresenterTotalSlides(total)
      if (slide !== undefined) setPresenterCurrentSlide(slide)
      setPresenterVoted(false)
      const nonInteractiveTypes = ['title', 'bullets', 'quote', 'video', 'wheel', 'image']
      const sType = (slide as Record<string, unknown>)?.type as string | undefined
      setPhase(sType && !nonInteractiveTypes.includes(sType) ? 'presenter-voting' : 'presenter-lobby')
    })

    socket.on('presenter_response_confirmed', () => {
      setPresenterVoted(true)
      setPhase('presenter-voted')
    })

    socket.on('presenter_ended', () => {
      setPhase('form')
    })

    // Auto-join follow-up session if ?followup= param is present
    if (followupParam) {
      followupCodeRef.current = followupParam
      socket.emit('join_followup', { code: followupParam }, (res: {
        success: boolean; error?: string;
        questions?: Question[]; quizTitle?: string; label?: string;
      }) => {
        if (!res.success) {
          setError(res.error ?? 'Follow-up not found.')
          setPhase('form')
          return
        }
        setQuizTitle(res.quizTitle ?? 'Follow-up Quiz')
        setSpLabel(res.label ?? '')
        setSpQuestions(res.questions ?? [])
        setSpIndex(0)
        setSpScore(0)
        setSpSelected(null)
        setSpCorrect(null)
        setSpShowAnswer(false)
        setPhase('selfpaced')
      })
    }

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('question_show')
      socket.off('answer_confirmed')
      socket.off('question_ended')
      socket.off('session_ended')
      socket.off('host_disconnected')
      socket.off('quiz_paused')
      socket.off('quiz_resumed')
      socket.off('presenter_slide_changed')
      socket.off('presenter_response_confirmed')
      socket.off('presenter_ended')
      socket.disconnect()
    }
  }, [])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    if (!trimmedName || !trimmedCode) {
      setError(trimmedName ? 'Enter a session code' : 'Enter your name')
      return
    }
    if (trimmedName.length > 30) {
      setError('Name must be 30 characters or less')
      return
    }
    setError('')
    setPhase('connecting')

    gameCodeRef.current = trimmedCode
    displayNameRef.current = trimmedName

    // Route to presenter join if mode=presenter
    if (modeParam === 'presenter') {
      socketRef.current?.emit('join_presenter_session', {
        gameCode: trimmedCode,
        displayName: trimmedName,
      }, (res: {
        success: boolean; error?: string;
        presentationTitle?: string;
        currentSlideIndex?: number;
        totalSlides?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentSlide?: any;
      }) => {
        if (!res.success) {
          setError(res.error ?? 'Could not join. Try again.')
          setPhase('form')
          return
        }
        setPresenterTitle(res.presentationTitle ?? '')
        setPresenterSlideIndex(res.currentSlideIndex ?? 0)
        setPresenterTotalSlides(res.totalSlides ?? 0)
        setPresenterCurrentSlide(res.currentSlide ?? null)
        setPresenterVoted(false)
        // If joining mid-presentation on an interactive slide, go straight to voting
        const nonInteractive = ['title', 'bullets', 'quote', 'video', 'wheel', 'image']
        const slideType = res.currentSlide?.type
        setPhase(slideType && !nonInteractive.includes(slideType) ? 'presenter-voting' : 'presenter-lobby')
      })
      return
    }

    socketRef.current?.emit('join_session', {
      gameCode: trimmedCode,
      displayName: trimmedName,
    }, (res: { success: boolean; error?: string; status?: string; quizTitle?: string; archetype?: string; sessionMode?: 'competitive' | 'reflection'; anonymousMode?: boolean; team?: { index: number; name: string; color: string } | null }) => {
      if (!res.success) {
        setError(res.error ?? 'Could not join. Try again.')
        setPhase('form')
        return
      }
      setQuizTitle(res.quizTitle ?? '')
      setArchetype(res.archetype ?? null)
      if (res.sessionMode) setSessionMode(res.sessionMode)
      if (res.anonymousMode) setAnonymousMode(true)
      if (res.team) setTeam(res.team)

      if (res.status === 'active') {
        setPhase('question')
      } else {
        setPhase('lobby')
        setTimeout(() => setAvatarRevealed(true), 100)
      }
    })
  }

  function handleAnswerTap(idx: number) {
    if (selectedAnswer !== null || pendingAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer(String(idx))
    setPendingAnswer(idx)
  }

  function submitWithConfidence(level: 'sure' | 'unsure') {
    if (pendingAnswer === null) return
    setConfidence(level)
    const timeMs = Date.now() - answerTimeRef.current
    socketRef.current?.emit('submit_answer', {
      gameCode: gameCodeRef.current,
      answer: pendingAnswer,
      timeMs,
      confidence: level,
    })
  }

  function submitTextAnswer() {
    if (!textAnswer.trim() || selectedAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer('text')
    const timeMs = Date.now() - answerTimeRef.current
    socketRef.current?.emit('submit_answer', {
      gameCode: gameCodeRef.current,
      answer: textAnswer.trim(),
      timeMs,
      confidence: null,
    })
  }

  function handleSpAnswer(idx: number) {
    if (spSelected !== null) return
    const q = spQuestions[spIndex]
    const correct = q.type === 'mcq' || q.type === 'truefalse'
      ? String(idx) === String(q.correctAnswer)
      : false // polls/case — no score
    setSpSelected(String(idx))
    setSpCorrect(correct)
    if (correct) setSpScore(s => s + q.points)
    setSpShowAnswer(true)
  }

  function handleSpNext() {
    const nextIdx = spIndex + 1
    if (nextIdx >= spQuestions.length) {
      setPhase('selfpaced-done')
    } else {
      setSpIndex(nextIdx)
      setSpSelected(null)
      setSpCorrect(null)
      setSpShowAnswer(false)
    }
  }

  function handlePlayAgain() {
    setPhase('form')
    setCode('')
    setName('')
    setError('')
    setArchetype(null)
    setAvatarRevealed(false)
    setSessionMode('competitive')
    setAnonymousMode(false)
    setQuestion(null)
    setSelectedAnswer(null)
    setPendingAnswer(null)
    setConfidence(null)
    setExplanation(null)
    setIsCorrect(false)
    setPointsEarned(0)
    setTotalScore(0)
    setLeaderboard([])
    setMyRank(0)
  }

  // ─── Form Phase ────────────────────────────────────────────────────────────
  if (phase === 'form' || phase === 'connecting') {
    const STARS = [
      { top: '8%',  left: '12%', s: 2.5, o: 0.7,  amber: true  },
      { top: '14%', left: '78%', s: 3,   o: 0.5,  amber: false },
      { top: '28%', left: '6%',  s: 2,   o: 0.4,  amber: false },
      { top: '38%', left: '88%', s: 2,   o: 0.6,  amber: true  },
      { top: '52%', left: '92%', s: 1.5, o: 0.35, amber: false },
      { top: '65%', left: '8%',  s: 3,   o: 0.45, amber: false },
      { top: '72%', left: '68%', s: 2,   o: 0.5,  amber: true  },
      { top: '82%', left: '35%', s: 1.5, o: 0.3,  amber: false },
      { top: '90%', left: '82%', s: 2.5, o: 0.4,  amber: false },
      { top: '20%', left: '48%', s: 1.5, o: 0.25, amber: true  },
      { top: '48%', left: '22%', s: 2,   o: 0.35, amber: false },
      { top: '60%', left: '55%', s: 1.5, o: 0.3,  amber: false },
    ]
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: '#0a0a1a' }}>

        {/* Background glow + stars */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(67,97,238,0.15) 0%, transparent 68%)',
          }} />
          {STARS.map((star, i) => (
            <div key={i} style={{
              position: 'absolute', top: star.top, left: star.left,
              width: star.s, height: star.s, borderRadius: '50%',
              background: star.amber ? '#6B8AFF' : 'white',
              opacity: star.o,
            }} />
          ))}
        </div>

        <div className="w-full max-w-md relative" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black tracking-tight">
              <span style={{ color: 'white' }}>Quizo</span><span style={{ color: '#6B8AFF' }}>tic</span>
            </h1>
            <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              ready to play?
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="Session code"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full rounded-xl px-5 py-4 text-2xl font-bold tracking-[0.3em] text-center outline-none transition-all placeholder:text-white/30 focus:ring-2 focus:ring-[#4361EE]/50"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: 'white',
              }}
              maxLength={6}
            />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full rounded-xl px-5 py-4 text-xl outline-none transition-all placeholder:text-white/30 focus:ring-2 focus:ring-[#4361EE]/50"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: 'white',
              }}
              maxLength={24}
            />
            {error && <p className="text-red-400 text-lg text-center">{error}</p>}
            <button
              type="submit"
              disabled={phase === 'connecting'}
              className="w-full font-black rounded-2xl py-5 text-xl transition-all disabled:opacity-50 hover:brightness-110"
              style={{ background: 'var(--brand-gradient)', color: 'white' }}
            >
              {phase === 'connecting' ? 'Joining…' : 'Join →'}
            </button>
          </form>

          <p className="text-center text-base mt-5" style={{ color: 'rgba(255,255,255,0.28)' }}>
            You&apos;ll get a unique character when you join
          </p>
        </div>
      </div>
    )
  }

  // ─── Lobby Phase ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className={`transition-all duration-500 mb-4 ${avatarRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
            {archetype && (
              <div className="flex justify-center mb-3">
                <div className="ring-4 ring-blue-100 rounded-full">
                  <Avatar archetype={archetype} size={120} />
                </div>
              </div>
            )}
          </div>
          {archetype && (
            <>
              <p className="font-black text-2xl" style={{ color: 'var(--color-primary)' }}>You are the {archetype}</p>
              <p className="text-gray-500 text-lg mt-1">{name}</p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {sessionMode === 'reflection' && (
              <span className="bg-blue-50 text-blue-600 text-base rounded-full px-4 py-1.5 font-semibold border border-blue-200">
                Reflection Mode — results at end
              </span>
            )}
            {anonymousMode && (
              <span className="bg-gray-100 text-gray-600 text-base rounded-full px-4 py-1.5 font-semibold border border-gray-200">
                Anonymous — your name is hidden
              </span>
            )}
            {team && (
              <span className="text-white text-base rounded-full px-4 py-1.5 font-bold" style={{ background: team.color }}>
                Team {team.name}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-lg mt-6 mb-3">Waiting for host to start</p>
          <div className="flex justify-center gap-2">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-3 h-3 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
          <p className="text-gray-400 text-lg mt-4 font-medium">{quizTitle}</p>
        </div>
      </div>
    )
  }

  // ─── Question Phase ────────────────────────────────────────────────────────
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen p-4 flex flex-col max-w-xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {archetype && <Avatar archetype={archetype} size={40} />}
            <span className="text-gray-500 text-base">{archetype}</span>
            {team && (
              <span className="text-white text-xs rounded-full px-2 py-0.5 font-bold" style={{ background: team.color }}>{team.name}</span>
            )}
          </div>
          <CircularTimer timeLeft={timeLeft} total={question.timerSeconds} />
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-blue-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
            style={{ width: `${(timeLeft / question.timerSeconds) * 100}%` }}
          />
        </div>

        {/* Scenario card — shown for 'case' type questions */}
        {question.type === 'case' && question.scenarioText && (
          <div className="rounded-2xl p-5 mb-3 border" style={{ background: '#1B2559', borderColor: '#2D3A6E' }}>
            <p className="text-base font-bold uppercase tracking-widest mb-2" style={{ color: '#6B8AFF' }}>Scenario</p>
            <p className="text-lg leading-relaxed" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
            {question.supportingDetail && (
              <p className="mt-2 font-bold text-lg" style={{ color: '#FFD166' }}>{question.supportingDetail}</p>
            )}
          </div>
        )}

        {/* Question card */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 mb-4 ${question.type === 'case' ? 'border-blue-200 border-t-4 border-t-blue-500' : 'border-gray-200 border-t-4 border-t-amber-400'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-base text-gray-400 font-semibold">Q{question.index + 1} / {question.total}</span>
            {question.type !== 'case' && question.type !== 'poll' && (
              <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>{question.points} pts</span>
            )}
            {question.type === 'case' && (
              <span className="text-base font-semibold" style={{ color: 'var(--color-primary)' }}>Scenario</span>
            )}
          </div>
          <p className="font-bold text-2xl leading-snug" style={{ color: 'var(--color-dark)' }}>{question.text}</p>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain" loading="lazy" />
          )}
        </div>

        {/* Answer options / text input */}
        {TEXT_INPUT_TYPES.includes(question.type) ? (
          <div className="flex flex-col gap-3 flex-1">
            <textarea
              className={`w-full rounded-2xl border-2 p-4 text-lg resize-none focus:outline-none transition-colors min-h-[140px] ${
                selectedAnswer !== null ? 'opacity-60 pointer-events-none border-gray-200 bg-gray-50' : 'border-gray-200 bg-white focus:border-blue-400'
              }`}
              placeholder={question.type === 'qa' ? 'Type your question…' : 'Type your answer…'}
              value={textAnswer}
              onChange={e => setTextAnswer(e.target.value)}
              disabled={selectedAnswer !== null}
            />
            <button
              onClick={submitTextAnswer}
              disabled={selectedAnswer !== null || !textAnswer.trim()}
              className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all disabled:opacity-40"
              style={{ background: selectedAnswer !== null ? '#9ca3af' : 'var(--brand-gradient)' }}
            >
              {selectedAnswer !== null ? 'Submitted ✓' : 'Submit →'}
            </button>
          </div>
        ) : (
          <div className={`gap-3 flex-1 ${question.type === 'rating' && question.options?.length === 5 ? 'grid grid-cols-5' : 'grid grid-cols-2'}`}>
            {question.options?.map((opt, idx) => {
              const isSelected = selectedAnswer === String(idx)
              const isDisabled = selectedAnswer !== null || timeLeft <= 0
              const optText = getOptText(opt)
              const optImage = getOptImage(opt)
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerTap(idx)}
                  disabled={isDisabled}
                  className={`${OPTION_GRADIENTS[idx]} rounded-2xl p-4 text-white text-left transition-all min-h-[90px]
                    ${isSelected ? 'ring-4 ring-white scale-[0.97]' : ''}
                    ${isDisabled && !isSelected ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  {optImage && (
                    <img src={optImage} alt="" className="w-full h-20 object-cover rounded-xl mb-2" loading="lazy" />
                  )}
                  <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-black text-lg mb-2 mx-auto">
                    {question.type === 'rating' ? optText : OPTION_LABELS[idx]}
                  </span>
                  {question.type !== 'rating' && (
                    <span className="text-lg font-semibold leading-snug">{optText}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Confidence overlay */}
        {pendingAnswer !== null && confidence === null && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
              <p className="font-black text-2xl mb-2" style={{ color: 'var(--color-dark)' }}>How confident are you?</p>
              <p className="text-gray-500 text-lg mb-6">Your answer is locked in — this is just for you.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => submitWithConfidence('sure')}
                  className="flex-1 text-white font-black rounded-xl py-5 text-xl hover:opacity-90 transition-colors"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Sure
                </button>
                <button
                  onClick={() => submitWithConfidence('unsure')}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-black rounded-xl py-5 text-xl hover:border-gray-400 transition-colors"
                >
                  Not Sure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Answered Phase ────────────────────────────────────────────────────────
  if (phase === 'answered') {
    const isNonScored = question?.type === 'case' || question?.type === 'poll' || TEXT_INPUT_TYPES.includes(question?.type ?? '') || question?.type === 'ranking'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto text-center gap-5 relative overflow-hidden">
        {/* Red flash overlay on wrong answer */}
        {showRedFlash && (
          <div className="fixed inset-0 pointer-events-none z-50" style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0) 70%)',
            animation: 'redFlash 0.6s ease-out forwards',
          }} />
        )}

        {/* Confetti burst on correct answer */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="absolute w-3 h-3 rounded-sm" style={{
                left: `${10 + Math.random() * 80}%`,
                top: '50%',
                background: ['#4361EE', '#FF6B6B', '#FFD166', '#16A34A', '#7C3AED', '#F59E0B'][i % 6],
                animation: `confettiBurst ${0.8 + Math.random() * 0.8}s ease-out ${Math.random() * 0.2}s forwards`,
              }} />
            ))}
          </div>
        )}

        {isNonScored ? (
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-5xl bg-blue-50 border-2 border-blue-200">
            ✓
          </div>
        ) : (
          <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl
            ${isCorrect ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}
            style={isCorrect ? { animation: 'correctPop 0.4s ease-out' } : { animation: 'wrongShake 0.4s ease-out' }}
          >
            {isCorrect ? '✓' : '✗'}
          </div>
        )}
        {isNonScored ? (
          <p className="font-black text-4xl" style={{ color: 'var(--color-primary)' }}>Recorded!</p>
        ) : (
          <p className={`font-black text-4xl ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
            {isCorrect ? 'Correct!' : 'Wrong!'}
          </p>
        )}

        {/* Streak badge */}
        {isCorrect && streak >= 2 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
            background: streak >= 5 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'linear-gradient(135deg, #4361EE, #7C3AED)',
            animation: 'correctPop 0.4s ease-out',
          }}>
            <span className="text-white font-black text-xl">{streak} Streak!</span>
          </div>
        )}

        {isCorrect && sessionMode === 'competitive' && (
          <p className="font-bold text-2xl animate-pulse" style={{ color: 'var(--color-primary)' }}>+{pointsEarned} pts</p>
        )}
        {sessionMode === 'competitive' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full">
            <p className="text-gray-500 text-lg">Your score</p>
            <p className="text-6xl font-black" style={{ color: 'var(--color-primary)' }}>{totalScore}</p>
          </div>
        )}
        {explanation && (
          <div className={`rounded-xl p-5 text-lg text-left w-full ${question?.type === 'case' ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
            <p className={`font-bold mb-1 text-base uppercase tracking-wide ${question?.type === 'case' ? 'text-blue-600' : 'text-blue-600'}`}>
              {question?.type === 'case' ? 'Expert View' : 'Why?'}
            </p>
            <p>{explanation}</p>
          </div>
        )}
        <p className="text-gray-400 text-lg">Waiting for next question…</p>

        <style>{`
          @keyframes confettiBurst {
            0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
            100% { transform: translateY(-200px) translateX(${Math.random() > 0.5 ? '' : '-'}${40 + Math.random() * 60}px) rotate(720deg) scale(0); opacity: 0; }
          }
          @keyframes redFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes correctPop {
            0% { transform: scale(0.5); }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
          @keyframes wrongShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
          }
        `}</style>
      </div>
    )
  }

  // ─── Ended Phase ───────────────────────────────────────────────────────────
  if (phase === 'ended') {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto">
        <h2 className="text-4xl font-black mb-6 text-center" style={{ color: 'var(--color-dark)' }}>Quiz Over!</h2>

        {/* Team leaderboard */}
        {teamLeaderboard && teamLeaderboard.length > 0 && (
          <div className="space-y-2 mb-6">
            <h3 className="text-lg font-black text-center" style={{ color: 'var(--color-dark)' }}>Team Standings</h3>
            {teamLeaderboard.map((t, i) => {
              const isMyTeam = team && t.name === team.name
              return (
                <div key={t.name} className={`flex items-center gap-3 rounded-xl p-3 ${isMyTeam ? 'ring-2 ring-blue-400' : ''}`}
                  style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <span className="text-lg font-black w-6 text-center" style={{ color: t.color }}>
                    {i === 0 ? '🏆' : i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: t.color }}>
                    {t.name[0]}
                  </div>
                  <span className="flex-1 font-bold text-sm" style={{ color: '#1E1B4B' }}>Team {t.name}</span>
                  {sessionMode === 'competitive' && (
                    <span className="text-sm font-black tabular-nums" style={{ color: t.color }}>{t.score.toLocaleString()}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Podium leaderboard={leaderboard} sessionMode={sessionMode} highlightName={displayNameRef.current} />

        {reflectionVisible && shownQuestionsRef.current.length > 0 && (
          <ReflectionMoment
            gameCode={gameCodeRef.current}
            participantName={displayNameRef.current}
            questions={shownQuestionsRef.current}
          />
        )}

        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-4 text-lg hover:border-gray-400 transition-colors font-semibold mt-6"
        >
          Attempt Again
        </button>
      </div>
    )
  }

  // ─── Self-paced Follow-up Phase ────────────────────────────────────────────
  if (phase === 'selfpaced' && spQuestions.length > 0) {
    const q = spQuestions[spIndex]
    return (
      <div className="min-h-screen p-4 flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>{spLabel}</p>
            <p className="text-lg text-gray-500">{quizTitle}</p>
          </div>
          <span className="text-base text-gray-400">{spIndex + 1} / {spQuestions.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((spIndex + 1) / spQuestions.length) * 100}%`, background: 'var(--brand-gradient)' }} />
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 border-t-4 border-t-blue-500">
          <p className="font-bold text-2xl leading-snug" style={{ color: 'var(--color-dark)' }}>{q.text}</p>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain" loading="lazy" />
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {q.options?.map((opt, idx) => {
            const isSelected = spSelected === String(idx)
            const isCorrectOpt = spShowAnswer && String(idx) === String(q.correctAnswer)
            const isWrongOpt = spShowAnswer && isSelected && !isCorrectOpt
            const optText = getOptText(opt)
            const optImage = getOptImage(opt)
            let bg = OPTION_GRADIENTS[idx]
            if (spShowAnswer) {
              if (isCorrectOpt) bg = 'bg-gradient-to-br from-green-600 to-green-500'
              else if (isWrongOpt) bg = 'bg-gradient-to-br from-red-600 to-red-500'
              else bg = 'bg-gray-200 shadow-none'
            }
            return (
              <button
                key={idx}
                onClick={() => handleSpAnswer(idx)}
                disabled={spSelected !== null}
                className={`${bg} rounded-2xl p-5 text-white text-left transition-all
                  ${isSelected ? 'ring-4 ring-white scale-[0.97]' : ''}
                  ${spSelected !== null && !isSelected && !isCorrectOpt ? 'opacity-50' : ''}
                `}
                style={spShowAnswer && !isCorrectOpt && !isWrongOpt ? { color: '#6B7280' } : {}}
              >
                {optImage && (
                  <img src={optImage} alt="" className="w-full h-16 object-cover rounded-xl mb-2" loading="lazy" />
                )}
                <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-black text-lg mb-2">
                  {OPTION_LABELS[idx]}
                </span>
                <span className="text-lg font-semibold leading-snug">{optText}</span>
              </button>
            )
          })}
        </div>

        {/* Result feedback + next button */}
        {spShowAnswer && (
          <div className="space-y-3">
            {spCorrect !== null && (
              <div className={`rounded-xl p-4 text-lg font-semibold text-center ${spCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {spCorrect ? `Correct! +${q.points} pts` : 'Not quite — see the correct answer above.'}
              </div>
            )}
            {q.explanation && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-lg text-blue-800">
                <span className="font-bold text-blue-600 text-base uppercase tracking-wide">Why? </span>{q.explanation}
              </div>
            )}
            <button
              onClick={handleSpNext}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:opacity-90"
              style={{ background: 'var(--brand-gradient)', color: '#fff' }}
            >
              {spIndex + 1 >= spQuestions.length ? 'See Results' : 'Next'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── Self-paced Done Phase ──────────────────────────────────────────────────
  if (phase === 'selfpaced-done') {
    const maxPossible = spQuestions
      .filter(q => q.type === 'mcq' || q.type === 'truefalse')
      .reduce((s, q) => s + q.points, 0)
    const pct = maxPossible > 0 ? Math.round((spScore / maxPossible) * 100) : 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto text-center gap-5">
        <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{ background: 'var(--brand-gradient)' }}>
          <span style={{ color: '#fff' }}>{pct >= 80 ? '★' : pct >= 50 ? '✓' : '→'}</span>
        </div>
        <p className="font-black text-4xl" style={{ color: 'var(--color-dark)' }}>{spScore} pts</p>
        <p className="text-gray-500 text-lg">{spLabel} complete · {pct}% accuracy</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full text-left">
          <p className="text-base font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>Quiz</p>
          <p className="font-bold text-xl" style={{ color: 'var(--color-dark)' }}>{quizTitle}</p>
          <p className="text-base text-gray-500 mt-1">{spQuestions.length} questions · spaced retrieval practice</p>
        </div>
        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-4 text-lg hover:border-gray-400 transition-colors font-semibold"
        >
          Back to Home
        </button>
      </div>
    )
  }

  // ─── Presenter Lobby ───────────────────────────────────────────────────────
  if (phase === 'presenter-lobby') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
        style={{ background: 'var(--color-bg)' }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--brand-gradient)' }}>
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-dark)' }}>{presenterTitle}</h1>
          <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
            Waiting for the presenter to start...
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--color-primary)' }} />
          <span className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>Connected</span>
        </div>
      </div>
    )
  }

  // ─── Presenter Voting ──────────────────────────────────────────────────────
  if (phase === 'presenter-voting' && presenterCurrentSlide) {
    const slide = presenterCurrentSlide
    const bgDark = '#0a0a1a'
    const textLight = 'white'

    function submitVote(response: string | number | { x: number; y: number }) {
      socketRef.current?.emit('submit_presenter_response', {
        gameCode: gameCodeRef.current,
        slideIndex: presenterSlideIndex,
        response,
      })
    }

    const OPTION_COLORS_P = ['#4361EE','#FF6B6B','#0891B2','#16A34A','#EA580C']

    return (
      <div className="min-h-screen flex flex-col p-4 gap-4" style={{ background: bgDark }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-base font-bold opacity-40" style={{ color: textLight }}>
            Slide {presenterSlideIndex + 1} / {presenterTotalSlides}
          </span>
          <span className="text-base font-semibold" style={{ color: '#6B8AFF' }}>{presenterTitle}</span>
        </div>

        {/* Question */}
        <h2 className="text-3xl font-black leading-snug" style={{ color: textLight }}>
          {slide.question || slide.heading || slide.title || ''}
        </h2>

        {/* Vote area by type */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          {(slide.type === 'multiple_choice' || slide.type === 'quick_fire' || slide.type === 'image_choice') && (
            (slide.options as string[]).map((opt: string, i: number) => (
              <button key={i} onClick={() => submitVote(i)}
                className="w-full py-5 rounded-2xl text-left px-6 text-xl font-bold transition-all active:scale-[0.98]"
                style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff' }}>
                <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-lg mr-3 font-black"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {['A','B','C','D','E'][i]}
                </span>
                {opt || `Option ${i+1}`}
              </button>
            ))
          )}

          {slide.type === 'word_duel' && (
            <div className="grid grid-cols-2 gap-3">
              {[slide.optionA, slide.optionB].map((opt: string, i: number) => (
                <button key={i} onClick={() => submitVote(i)}
                  className="py-8 rounded-2xl text-center text-2xl font-black transition-all active:scale-[0.97]"
                  style={{ background: i === 0 ? '#2563EB' : '#DC2626', color: '#fff' }}>
                  {opt || (i === 0 ? 'Side A' : 'Side B')}
                </button>
              ))}
            </div>
          )}

          {(slide.type === 'live_race' || slide.type === 'ranking') && (
            (slide.options || slide.items || []).map((opt: string, i: number) => (
              <button key={i} onClick={() => submitVote(i)}
                className="w-full py-4 rounded-2xl text-left px-5 text-base font-bold transition-all active:scale-[0.98]"
                style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff' }}>
                {opt || `Option ${i+1}`}
              </button>
            ))
          )}

          {(slide.type === 'word_cloud' || slide.type === 'open_text') && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder={slide.type === 'word_cloud' ? 'Type a word...' : 'Type your response...'}
                id="presenter-text-input"
                className="w-full rounded-xl px-5 py-4 text-xl outline-none focus:ring-2 focus:ring-blue-400"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('presenter-text-input') as HTMLInputElement
                  if (input?.value.trim()) submitVote(input.value.trim())
                }}
                className="w-full py-5 rounded-2xl text-xl font-black"
                style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
                Submit
              </button>
            </div>
          )}

          {slide.type === 'rating_scale' && (
            <StarRating max={slide.maxRating || 5} minLabel={slide.minLabel} maxLabel={slide.maxLabel}
              textLight={textLight} onSubmit={submitVote} />
          )}

          {slide.type === 'scale_100' && (
            <div className="space-y-4">
              <input type="range" min={0} max={100} defaultValue={50}
                id="scale-100-input"
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-base opacity-50" style={{ color: textLight }}>
                <span>0 · {slide.minLabel}</span>
                <span>{slide.maxLabel} · 100</span>
              </div>
              <button
                onClick={() => {
                  const input = document.getElementById('scale-100-input') as HTMLInputElement
                  submitVote(Number(input?.value ?? 50))
                }}
                className="w-full py-5 rounded-2xl text-xl font-black"
                style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
                Submit
              </button>
            </div>
          )}

          {slide.type === 'emoji_pulse' && (
            <div className="grid grid-cols-2 gap-3">
              {(slide.emojis as string[]).map((em: string) => (
                <button key={em} onClick={() => submitVote(em)}
                  className="py-8 rounded-2xl text-5xl transition-all active:scale-[0.95]"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                  {em}
                </button>
              ))}
            </div>
          )}

          {slide.type === 'pinpoint' && (
            <PinpointInput imageUrl={slide.imageUrl} onSubmit={submitVote} />
          )}

          {slide.type === 'grid_2x2' && (
            <Grid2x2Input xMin={slide.xMin} xMax={slide.xMax} yMin={slide.yMin} yMax={slide.yMax} onSubmit={submitVote} />
          )}
        </div>
      </div>
    )
  }

  // ─── Presenter Voted (waiting for next slide) ──────────────────────────────
  if (phase === 'presenter-voted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
        style={{ background: '#0a0a1a' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'var(--brand-gradient)' }}>
          <span className="text-3xl">✓</span>
        </div>
        <div className="text-center space-y-2">
          <p className="text-3xl font-black" style={{ color: 'white' }}>Vote counted!</p>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Waiting for the presenter to move to the next slide...
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#6B8AFF' }} />
          <span className="text-base" style={{ color: '#6B8AFF' }}>Slide {presenterSlideIndex + 1} of {presenterTotalSlides}</span>
        </div>
      </div>
    )
  }

  return null
}

// ─── Outer Wrapper (Suspense required for useSearchParams in Next.js 16) ──────
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a]" />}>
      <JoinPageInner />
    </Suspense>
  )
}
