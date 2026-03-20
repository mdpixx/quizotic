'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { CircularTimer } from '@/components/CircularTimer'
import { Avatar } from '@/components/Avatar'

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'form' | 'connecting' | 'lobby' | 'question' | 'answered' | 'ended'

interface Question {
  id: string
  type: string
  text: string
  options?: string[]
  timerSeconds: number
  points: number
  index: number
  total: number
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

  const [phase, setPhase] = useState<Phase>('form')
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')

  // Avatar
  const [archetype, setArchetype] = useState<string | null>(null)
  const [avatarRevealed, setAvatarRevealed] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)

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

    socket.on('session_ended', ({ leaderboard, practiceMode: pm }: { leaderboard: LeaderboardEntry[]; practiceMode: boolean }) => {
      setLeaderboard(leaderboard)
      setPracticeMode(pm)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setMyRank(rank)
      setPhase('ended')
    })

    socket.on('host_disconnected', () => {
      setError('The host has left. Session ended.')
      setPhase('form')
    })

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
    }, (res: { success: boolean; error?: string; status?: string; quizTitle?: string; archetype?: string; practiceMode?: boolean }) => {
      if (!res.success) {
        setError(res.error ?? 'Could not join. Try again.')
        setPhase('form')
        return
      }
      setQuizTitle(res.quizTitle ?? '')
      setArchetype(res.archetype ?? null)
      setPracticeMode(res.practiceMode ?? false)

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

  function handlePlayAgain() {
    setPhase('form')
    setCode('')
    setName('')
    setError('')
    setArchetype(null)
    setAvatarRevealed(false)
    setPracticeMode(false)
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            Quizo<span className="text-lime-400">tic</span>
          </h1>
          <p className="text-gray-500 text-sm mb-6">Enter your details to join</p>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Game code"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold tracking-widest text-center focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
              maxLength={6}
            />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
              maxLength={24}
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={phase === 'connecting'}
              className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {phase === 'connecting' ? 'Joining…' : 'Join →'}
            </button>
          </form>
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
          {practiceMode && (
            <span className="inline-block mt-3 bg-indigo-50 text-indigo-600 text-xs rounded-full px-3 py-1 font-semibold">
              Practice Mode — no leaderboard
            </span>
          )}
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

        {/* Question card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400 p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Q{question.index + 1} / {question.total}</span>
            <span className="text-xs text-indigo-600 font-semibold">{question.points} pts</span>
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
        <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl
          ${isCorrect ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}
        >
          {isCorrect ? '✓' : '✗'}
        </div>
        <p className={`font-black text-3xl ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrect ? 'Correct!' : 'Wrong!'}
        </p>
        {isCorrect && (
          <p className="text-indigo-600 font-bold text-xl animate-pulse">+{pointsEarned} pts</p>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 w-full">
          <p className="text-gray-500 text-sm">Your score</p>
          <p className="text-indigo-600 text-5xl font-black">{totalScore}</p>
        </div>
        {explanation && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 text-left w-full">
            <p className="font-bold text-indigo-600 mb-1 text-xs uppercase tracking-wide">Why?</p>
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

        {practiceMode ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center mb-4">
            <p className="text-5xl font-black text-indigo-600">{totalScore}</p>
            <p className="text-gray-500 mt-1">Your score</p>
            <p className="text-gray-400 text-sm mt-3">Practice session complete — no leaderboard in this mode</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {leaderboard.map((entry, i) => {
              const isMe = entry.name === displayNameRef.current
              const podiumClass = i === 0 ? 'bg-lime-400 text-black' : i === 1 ? 'bg-gray-200 text-black' : i === 2 ? 'bg-amber-200 text-amber-900' : 'bg-white border border-gray-200 text-gray-700'
              return (
                <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ${podiumClass} ${isMe ? 'ring-2 ring-indigo-400' : ''}`}>
                  <span className="font-black w-5 text-center text-sm">{i + 1}</span>
                  <Avatar archetype={entry.archetype ?? ''} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">{entry.name}</p>
                    <p className="text-xs opacity-60 truncate">{entry.archetype}</p>
                  </div>
                  <span className="font-black tabular-nums text-sm">{entry.score}</span>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
        >
          Play Again
        </button>
      </div>
    )
  }

  return null
}

// ─── Outer Wrapper (Suspense required for useSearchParams in Next.js 16) ──────
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf8]" />}>
      <JoinPageInner />
    </Suspense>
  )
}
