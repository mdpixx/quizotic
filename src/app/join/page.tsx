'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { CircularTimer } from '@/components/CircularTimer'
import { Avatar } from '@/components/Avatar'

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'form' | 'connecting' | 'lobby' | 'question' | 'answered' | 'ended' | 'selfpaced' | 'selfpaced-done'

interface Question {
  id: string
  type: string
  text: string
  options?: string[]
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
]
const OPTION_LABELS = ['A', 'B', 'C', 'D']

// ─── Inner Component (uses useSearchParams — requires Suspense) ───────────────
function JoinPageInner() {
  const searchParams = useSearchParams()
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answerTimeRef = useRef<number>(0)

  const followupParam = searchParams.get('followup')
  const [phase, setPhase] = useState<Phase>(followupParam ? 'connecting' : 'form')
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')

  // Avatar
  const [archetype, setArchetype] = useState<string | null>(null)
  const [avatarRevealed, setAvatarRevealed] = useState(false)
  const [sessionMode, setSessionMode] = useState<'competitive' | 'reflection'>('competitive')
  const [anonymousMode, setAnonymousMode] = useState(false)

  // Question
  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  // Confidence tap
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure' | null>(null)

  // Answered
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [explanation, setExplanation] = useState<string | null>(null)

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

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('question_show', ({ question, index, total }: { question: Omit<Question, 'index' | 'total'>; index: number; total: number }) => {
      setQuestion({ ...question, index, total })
      setSelectedAnswer(null)
      setPendingAnswer(null)
      setConfidence(null)
      setExplanation(null)
      setTimeLeft(question.timerSeconds)
      setPhase('question')
      answerTimeRef.current = Date.now()

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
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
    })

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
    })

    socket.on('session_ended', ({ leaderboard, sessionMode: sm }: { leaderboard: LeaderboardEntry[]; sessionMode: 'competitive' | 'reflection' }) => {
      setLeaderboard(leaderboard)
      if (sm) setSessionMode(sm)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setMyRank(rank)
      setPhase('ended')
    })

    socket.on('host_disconnected', () => {
      setError('The host has left. Session ended.')
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

    return () => { socket.disconnect() }
  }, [])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setError('')
    setPhase('connecting')

    gameCodeRef.current = code.trim()
    displayNameRef.current = name.trim()

    socketRef.current?.emit('join_session', {
      gameCode: code.trim(),
      displayName: name.trim(),
    }, (res: { success: boolean; error?: string; status?: string; quizTitle?: string; archetype?: string; sessionMode?: 'competitive' | 'reflection'; anonymousMode?: boolean }) => {
      if (!res.success) {
        setError(res.error ?? 'Could not join. Try again.')
        setPhase('form')
        return
      }
      setQuizTitle(res.quizTitle ?? '')
      setArchetype(res.archetype ?? null)
      if (res.sessionMode) setSessionMode(res.sessionMode)
      if (res.anonymousMode) setAnonymousMode(true)

      if (res.status === 'active') {
        setPhase('question')
      } else {
        setPhase('lobby')
        setTimeout(() => setAvatarRevealed(true), 100)
      }
    })
  }

  function handleAnswerTap(idx: number) {
    if (selectedAnswer !== null || pendingAnswer !== null) return
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
            background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 68%)',
          }} />
          {STARS.map((star, i) => (
            <div key={i} style={{
              position: 'absolute', top: star.top, left: star.left,
              width: star.s, height: star.s, borderRadius: '50%',
              background: star.amber ? '#A78BFA' : 'white',
              opacity: star.o,
            }} />
          ))}
        </div>

        <div className="w-full max-w-sm relative" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight">
              <span style={{ color: 'white' }}>Quizo</span><span style={{ color: '#A78BFA' }}>tic</span>
            </h1>
            <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              ready to play?
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Game code"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full rounded-xl px-4 py-3 text-lg font-bold tracking-widest text-center outline-none transition-all placeholder:text-white/30 focus:ring-2 focus:ring-[#7C3AED]/50"
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
              className="w-full rounded-xl px-4 py-3 outline-none transition-all placeholder:text-white/30 focus:ring-2 focus:ring-[#7C3AED]/50"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: 'white',
              }}
              maxLength={24}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={phase === 'connecting'}
              className="w-full font-black rounded-2xl py-4 text-base transition-all disabled:opacity-50 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: 'white' }}
            >
              {phase === 'connecting' ? 'Joining…' : 'Join →'}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.28)' }}>
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
                <div className="ring-4 ring-indigo-100 rounded-full">
                  <Avatar archetype={archetype} size={96} />
                </div>
              </div>
            )}
          </div>
          {archetype && (
            <>
              <p className="text-indigo-600 font-black text-xl">You are the {archetype}</p>
              <p className="text-gray-500 text-sm mt-1">{name}</p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {sessionMode === 'reflection' && (
              <span className="bg-violet-50 text-violet-600 text-xs rounded-full px-3 py-1 font-semibold border border-violet-200">
                Reflection Mode — results at end
              </span>
            )}
            {anonymousMode && (
              <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-3 py-1 font-semibold border border-gray-200">
                Anonymous — your name is hidden
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-6 mb-3">Waiting for host to start</p>
          <div className="flex justify-center gap-1.5">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
          <p className="text-gray-400 text-sm mt-4 font-medium">{quizTitle}</p>
        </div>
      </div>
    )
  }

  // ─── Question Phase ────────────────────────────────────────────────────────
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen p-4 flex flex-col max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {archetype && <Avatar archetype={archetype} size={32} />}
            <span className="text-gray-500 text-xs">{archetype}</span>
          </div>
          <CircularTimer timeLeft={timeLeft} total={question.timerSeconds} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-400'}`}
            style={{ width: `${(timeLeft / question.timerSeconds) * 100}%` }}
          />
        </div>

        {/* Scenario card — shown for 'case' type questions */}
        {question.type === 'case' && question.scenarioText && (
          <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#1E1B4B', borderColor: '#3730A3' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#A78BFA' }}>Scenario</p>
            <p className="text-sm leading-relaxed" style={{ color: '#E9E2FF' }}>{question.scenarioText}</p>
            {question.supportingDetail && (
              <p className="mt-2 font-bold text-sm" style={{ color: '#FDE68A' }}>{question.supportingDetail}</p>
            )}
          </div>
        )}

        {/* Question card */}
        <div className={`bg-white rounded-2xl shadow-sm border p-5 mb-4 ${question.type === 'case' ? 'border-violet-200 border-t-4 border-t-violet-500' : 'border-gray-200 border-t-4 border-t-lime-400'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Q{question.index + 1} / {question.total}</span>
            {question.type !== 'case' && question.type !== 'poll' && (
              <span className="text-xs text-indigo-600 font-semibold">{question.points} pts</span>
            )}
            {question.type === 'case' && (
              <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>Scenario</span>
            )}
          </div>
          <p className="text-gray-900 font-bold text-lg leading-snug">{question.text}</p>
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {question.options?.map((opt, idx) => {
            const isSelected = selectedAnswer === String(idx)
            const isDisabled = selectedAnswer !== null
            return (
              <button
                key={idx}
                onClick={() => handleAnswerTap(idx)}
                disabled={isDisabled}
                className={`${OPTION_GRADIENTS[idx]} rounded-2xl p-5 text-white text-left transition-all
                  ${isSelected ? 'ring-4 ring-white scale-[0.97]' : ''}
                  ${isDisabled && !isSelected ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-black text-sm mb-2">
                  {OPTION_LABELS[idx]}
                </span>
                <span className="text-sm font-semibold leading-snug">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Confidence overlay */}
        {pendingAnswer !== null && confidence === null && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <p className="font-black text-gray-900 text-lg mb-1">How confident are you?</p>
              <p className="text-gray-500 text-sm mb-5">Your answer is locked in — this is just for you.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => submitWithConfidence('sure')}
                  className="flex-1 bg-indigo-600 text-white font-black rounded-xl py-4 text-base hover:bg-indigo-700 transition-colors"
                >
                  Sure ✓
                </button>
                <button
                  onClick={() => submitWithConfidence('unsure')}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-black rounded-xl py-4 text-base hover:border-gray-400 transition-colors"
                >
                  Not Sure ~
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-sm mx-auto text-center gap-4">
        {question?.type === 'case' || question?.type === 'poll' ? (
          <div className="w-28 h-28 rounded-full flex items-center justify-center text-4xl bg-violet-50 border-2 border-violet-200">
            ✓
          </div>
        ) : (
          <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl
            ${isCorrect ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}
          >
            {isCorrect ? '✓' : '✗'}
          </div>
        )}
        {question?.type === 'case' || question?.type === 'poll' ? (
          <p className="font-black text-3xl text-violet-600">Recorded!</p>
        ) : (
          <p className={`font-black text-3xl ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
            {isCorrect ? 'Correct!' : 'Wrong!'}
          </p>
        )}
        {isCorrect && sessionMode === 'competitive' && (
          <p className="text-indigo-600 font-bold text-xl animate-pulse">+{pointsEarned} pts</p>
        )}
        {sessionMode === 'competitive' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 w-full">
            <p className="text-gray-500 text-sm">Your score</p>
            <p className="text-indigo-600 text-5xl font-black">{totalScore}</p>
          </div>
        )}
        {explanation && (
          <div className={`rounded-xl p-4 text-sm text-left w-full ${question?.type === 'case' ? 'bg-violet-50 border border-violet-200 text-violet-900' : 'bg-indigo-50 border border-indigo-100 text-indigo-800'}`}>
            <p className={`font-bold mb-1 text-xs uppercase tracking-wide ${question?.type === 'case' ? 'text-violet-600' : 'text-indigo-600'}`}>
              {question?.type === 'case' ? 'Expert View' : 'Why?'}
            </p>
            <p>{explanation}</p>
          </div>
        )}
        <p className="text-gray-400 text-sm">Waiting for next question…</p>
      </div>
    )
  }

  // ─── Ended Phase ───────────────────────────────────────────────────────────
  if (phase === 'ended') {
    return (
      <div className="min-h-screen p-4 max-w-sm mx-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-4 text-center">Quiz Over!</h2>

        <div className="space-y-2 mb-4">
          {leaderboard.map((entry, i) => {
            const isMe = entry.name === displayNameRef.current
            const podiumClass = i === 0 ? 'bg-lime-400 text-black' : i === 1 ? 'bg-gray-200 text-black' : i === 2 ? 'bg-amber-200 text-amber-900' : 'bg-white border border-gray-200 text-gray-700'
            return (
              <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ${podiumClass} ${isMe ? 'ring-2 ring-violet-400' : ''}`}>
                <span className="font-black w-5 text-center text-sm">{i + 1}</span>
                <Avatar archetype={entry.archetype ?? ''} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm">{entry.name}</p>
                  <p className="text-xs opacity-60 truncate">{entry.archetype}</p>
                </div>
                {sessionMode === 'competitive' && (
                  <span className="font-black tabular-nums text-sm">{entry.score}</span>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
        >
          Play Again
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
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7C3AED' }}>{spLabel}</p>
            <p className="text-sm text-gray-500">{quizTitle}</p>
          </div>
          <span className="text-xs text-gray-400">{spIndex + 1} / {spQuestions.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((spIndex + 1) / spQuestions.length) * 100}%`, background: 'linear-gradient(90deg,#7C3AED,#EC4899)' }} />
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4 border-t-4 border-t-violet-500">
          <p className="text-gray-900 font-bold text-lg leading-snug">{q.text}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {q.options?.map((opt, idx) => {
            const isSelected = spSelected === String(idx)
            const isCorrectOpt = spShowAnswer && String(idx) === String(q.correctAnswer)
            const isWrongOpt = spShowAnswer && isSelected && !isCorrectOpt
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
                <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-black text-sm mb-2">
                  {OPTION_LABELS[idx]}
                </span>
                <span className="text-sm font-semibold leading-snug">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Result feedback + next button */}
        {spShowAnswer && (
          <div className="space-y-3">
            {spCorrect !== null && (
              <div className={`rounded-xl p-3 text-sm font-semibold text-center ${spCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {spCorrect ? `Correct! +${q.points} pts` : 'Not quite — see the correct answer above.'}
              </div>
            )}
            {q.explanation && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                <span className="font-bold text-indigo-600 text-xs uppercase tracking-wide">Why? </span>{q.explanation}
              </div>
            )}
            <button
              onClick={handleSpNext}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff' }}
            >
              {spIndex + 1 >= spQuestions.length ? 'See Results' : 'Next →'}
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-sm mx-auto text-center gap-4">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}>
          <span style={{ color: '#fff' }}>{pct >= 80 ? '★' : pct >= 50 ? '✓' : '→'}</span>
        </div>
        <p className="font-black text-3xl" style={{ color: '#1E1B4B' }}>{spScore} pts</p>
        <p className="text-gray-500 text-sm">{spLabel} complete · {pct}% accuracy</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 w-full text-left">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7C3AED' }}>Quiz</p>
          <p className="font-bold text-gray-900">{quizTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{spQuestions.length} questions · spaced retrieval practice</p>
        </div>
        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
        >
          Back to Home
        </button>
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
