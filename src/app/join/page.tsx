'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

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
  score: number
}

const OPTION_COLORS = [
  'bg-pink-500 active:bg-pink-400',
  'bg-orange-500 active:bg-orange-400',
  'bg-blue-600 active:bg-blue-500',
  'bg-green-600 active:bg-green-500',
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

// ─── Component ────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answerTimeRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>('form')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')

  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)

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
      setTimeLeft(question.timerSeconds)
      setPhase('question')
      answerTimeRef.current = Date.now()

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })

    socket.on('answer_confirmed', ({ isCorrect, points, totalScore }: { isCorrect: boolean; points: number; totalScore: number }) => {
      setIsCorrect(isCorrect)
      setPointsEarned(points)
      setTotalScore(totalScore)
      setPhase('answered')
      if (timerRef.current) clearInterval(timerRef.current)
    })

    socket.on('session_end', ({ leaderboard }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(leaderboard)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setMyRank(rank)
      setPhase('ended')
      if (timerRef.current) clearInterval(timerRef.current)
    })

    socket.on('host_disconnected', () => {
      setError('The host has disconnected. Session ended.')
      setPhase('form')
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      socket.disconnect()
    }
  }, [])

  // ─── Actions ─────────────────────────────────────────────────────────────

  function joinGame() {
    const trimCode = code.replace(/\s/g, '').trim()
    const trimName = name.trim()

    if (trimCode.length !== 6) { setError('Enter a 6-digit game code'); return }
    if (trimName.length < 1) { setError('Enter your name'); return }
    if (trimName.length > 20) { setError('Name must be 20 characters or less'); return }

    setError('')
    setPhase('connecting')
    gameCodeRef.current = trimCode
    displayNameRef.current = trimName

    socketRef.current?.emit(
      'join_session',
      { gameCode: trimCode, displayName: trimName },
      (res: { success: boolean; error?: string; status?: string; quizTitle?: string }) => {
        if (!res.success) {
          setError(res.error ?? 'Could not join. Try again.')
          setPhase('form')
          return
        }
        setQuizTitle(res.quizTitle ?? '')
        setPhase(res.status === 'active' ? 'question' : 'lobby')
      },
    )
  }

  function submitAnswer(answerIndex: string) {
    if (selectedAnswer !== null) return // already answered
    setSelectedAnswer(answerIndex)

    const timeMs = Date.now() - answerTimeRef.current
    socketRef.current?.emit('submit_answer', {
      gameCode: gameCodeRef.current,
      answer: answerIndex,
      timeMs,
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Nav ── */}
      <header className="border-b border-zinc-800 px-6 py-4 text-center">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-8">

        {/* ── FORM ── */}
        {(phase === 'form' || phase === 'connecting') && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-1">Join a Quiz</h1>
              <p className="text-zinc-400 text-sm">Enter the game code your host shared</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Game code (e.g. 482937)"
                maxLength={7}
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-lime-400 transition-colors"
              />
              <input
                type="text"
                placeholder="Your name"
                maxLength={20}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 focus:outline-none focus:border-lime-400 transition-colors"
              />
            </div>

            <button
              onClick={joinGame}
              disabled={phase === 'connecting'}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {phase === 'connecting' ? 'Joining...' : 'Join Game →'}
            </button>
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-lime-400/10 border-2 border-lime-400/30 flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{quizTitle || 'Quiz'}</h2>
              <p className="text-zinc-400 mt-1">You&apos;re in! Waiting for the host to start...</p>
            </div>
            <div className="flex gap-1 mt-4">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-lime-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="text-zinc-600 text-sm">Playing as <span className="text-zinc-400">{displayNameRef.current}</span></p>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === 'question' && question && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Header: progress + timer */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                {question.index + 1} / {question.total}
              </span>
              <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-lg ${
                timeLeft > 5 ? 'border-lime-400 text-lime-400' : 'border-red-500 text-red-500'
              }`}>
                {timeLeft}
              </div>
            </div>

            {/* Timer bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${timeLeft > 5 ? 'bg-lime-400' : 'bg-red-500'}`}
                style={{ width: `${(timeLeft / (question.timerSeconds || 20)) * 100}%` }}
              />
            </div>

            {/* Question text */}
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 border-t-4 border-t-lime-400 flex-1 flex items-center justify-center">
              <p className="text-lg font-semibold text-center leading-snug">{question.text}</p>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3">
              {question.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => submitAnswer(String(i))}
                  disabled={selectedAnswer !== null || timeLeft === 0}
                  className={`rounded-xl p-4 text-left transition-all ${
                    selectedAnswer === String(i)
                      ? 'ring-4 ring-white opacity-90 scale-95'
                      : selectedAnswer !== null || timeLeft === 0
                      ? 'opacity-40 cursor-not-allowed'
                      : 'active:scale-95'
                  } ${OPTION_COLORS[i]}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-sm font-black shrink-0">
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm font-medium leading-snug">{opt}</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedAnswer !== null && (
              <p className="text-center text-sm text-zinc-500 animate-pulse">
                Waiting for next question...
              </p>
            )}

            {timeLeft === 0 && selectedAnswer === null && (
              <p className="text-center text-sm text-red-400">
                Time&apos;s up! No answer submitted.
              </p>
            )}
          </div>
        )}

        {/* ── ANSWERED ── */}
        {phase === 'answered' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-6xl ${
              isCorrect ? 'bg-green-500/20 border-2 border-green-500/40' : 'bg-red-500/20 border-2 border-red-500/40'
            }`}>
              {isCorrect ? '✓' : '✗'}
            </div>

            <div>
              <p className={`text-3xl font-black ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? 'Correct!' : 'Wrong!'}
              </p>
              <p className={`text-zinc-400 mt-1 text-sm animate-bounce`}>
                {isCorrect ? `+${pointsEarned.toLocaleString()} points` : 'No points this round'}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-8 py-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Your Score</p>
              <p className="text-4xl font-black text-lime-400">{totalScore.toLocaleString()}</p>
            </div>

            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="text-sm text-zinc-500">Waiting for next question...</p>
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <div className="flex-1 flex flex-col space-y-6">
            <div className="text-center">
              <p className="text-sm text-zinc-500 uppercase tracking-wider mb-1">Game Over</p>
              <p className="text-4xl font-black">
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
              </p>
              <p className="text-zinc-400 mt-1">
                You finished <span className="text-white font-bold">#{myRank}</span> with{' '}
                <span className="text-lime-400 font-bold">{totalScore.toLocaleString()} pts</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Leaderboard</p>
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                    entry.name === displayNameRef.current
                      ? 'bg-lime-400/10 border border-lime-400/30'
                      : 'bg-zinc-900'
                  }`}
                >
                  <span className="w-6 text-center text-sm font-bold text-zinc-500">{i + 1}</span>
                  <span className={`flex-1 font-medium ${entry.name === displayNameRef.current ? 'text-lime-400' : ''}`}>
                    {entry.name}
                    {entry.name === displayNameRef.current && ' (you)'}
                  </span>
                  <span className="font-bold tabular-nums text-sm">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setPhase('form')
                setCode('')
                setName('')
                setTotalScore(0)
                setLeaderboard([])
              }}
              className="w-full py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:border-zinc-500 transition-colors text-sm"
            >
              Play Again
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
