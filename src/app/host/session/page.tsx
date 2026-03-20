'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import { Avatar } from '@/components/Avatar'
import { SessionReport } from '@/components/SessionReport'
import { getActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz, QuestionStat } from '@/lib/quiz-types'

type Phase = 'loading' | 'error' | 'idle' | 'lobby' | 'question' | 'ended'

interface LeaderboardEntry {
  name: string
  archetype: string
  score: number
}

const OPTION_COLORS = [
  'bg-pink-500',
  'bg-orange-500',
  'bg-blue-600',
  'bg-green-600',
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function SessionPage() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [participants, setParticipants] = useState<Map<string, string>>(new Map())
  // key = displayName, value = archetype
  const [practiceMode, setPracticeMode] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [optionCounts, setOptionCounts] = useState<number[]>([])

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
    if (!quiz) return   // wait until session is confirmed loaded
    const socket = io()
    socketRef.current = socket

    socket.on('participant_joined', ({ name, archetype }: { name: string; archetype: string; count: number }) => {
      setParticipants(prev => new Map(prev).set(name, archetype))
    })

    socket.on('participant_left', ({ name }: { name: string }) => {
      setParticipants(prev => { const next = new Map(prev); next.delete(name); return next })
    })

    socket.on('answer_received', ({ count, optionCounts: counts }: { count: number; optionCounts?: number[] }) => {
      setAnswered(count)
      if (counts) setOptionCounts(counts)
    })

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
    })

    socket.on('session_ended', ({ leaderboard: lb, questionStats: qs }: {
      leaderboard: LeaderboardEntry[];
      questionStats: QuestionStat[];
    }) => {
      setLeaderboard(lb)
      setQuestionStats(qs ?? [])
      setPhase('ended')
    })

    return () => { socket.disconnect() }
  }, [quiz])

  function createSession() {
    if (!quiz) return
    socketRef.current?.emit('create_session', { quizData: quiz, practiceMode }, (res: { success: boolean; gameCode: string }) => {
      if (res.success) {
        setGameCode(res.gameCode)
        setPhase('lobby')
      }
    })
  }

  function startQuiz() {
    socketRef.current?.emit('start_quiz', { gameCode })
    setAnswered(0)
    setOptionCounts([])
    setQuestionIndex(0)
    setPhase('question')
  }

  function nextQuestion() {
    if (!quiz) return
    setExplanation(null)
    const nextIndex = questionIndex + 1
    if (nextIndex >= quiz.questions.length) {
      socketRef.current?.emit('end_session', { gameCode })
    } else {
      socketRef.current?.emit('next_question', { gameCode })
      setQuestionIndex(nextIndex)
      setAnswered(0)
      setOptionCounts([])
    }
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

  return (
    <div className="min-h-screen text-gray-900">

      {/* IDLE */}
      {phase === 'idle' && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <h1 className="text-3xl font-black text-gray-900 mb-1">{quiz.title}</h1>
          <p className="text-gray-500 text-sm">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</p>

          {/* Question preview */}
          <div className="space-y-2">
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3 shadow-sm">
                <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-gray-700 truncate">{q.text}</p>
              </div>
            ))}
          </div>

          {/* Practice Mode toggle */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div>
              <p className="font-bold text-gray-900 text-sm">Practice Mode</p>
              <p className="text-gray-500 text-xs mt-0.5">Hides leaderboard from participants</p>
            </div>
            <button
              onClick={() => setPracticeMode(p => !p)}
              className={`w-12 h-6 rounded-full transition-colors relative ${practiceMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${practiceMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <button
            onClick={createSession}
            className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 transition-colors"
          >
            Create Session
          </button>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-black text-gray-900">Quizo<span className="text-lime-400">tic</span></h1>
            <span className="bg-lime-50 border border-lime-200 text-lime-700 text-xs font-bold px-3 py-1 rounded-full">
              ● LIVE · {participants.size} players
            </span>
          </div>

          {/* Game code + QR code */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex gap-4 items-center">
              <div className="flex-1 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Game Code</p>
                <p className="text-indigo-600 text-5xl font-black tracking-[0.3em]">{gameCode}</p>
                <p className="text-gray-400 text-xs mt-2">quizotic.net</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Scan to Join</p>
                <div className="bg-white rounded-2xl p-3 border border-gray-200">
                  <QRCode
                    value={`https://quizotic.net?code=${gameCode}`}
                    size={120}
                    bgColor="#ffffff"
                    fgColor="#4f46e5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Avatar grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {participants.size === 0 ? 'Waiting for participants...' : `${participants.size} joined`}
            </p>
            <div className="flex flex-wrap gap-3">
              {Array.from(participants.entries()).map(([pName, pArchetype]) => (
                <div key={pName} className="flex flex-col items-center gap-1">
                  <div className="ring-2 ring-indigo-100 rounded-full overflow-hidden">
                    <Avatar archetype={pArchetype} size={48} />
                  </div>
                  <p className="text-xs text-gray-700 font-semibold max-w-[56px] truncate text-center">{pName}</p>
                  <p className="text-xs text-gray-400 max-w-[56px] truncate text-center">{pArchetype}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={startQuiz}
            disabled={participants.size === 0}
            className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {participants.size === 0 ? 'Waiting for players...' : 'Start Quiz →'}
          </button>
        </div>
      )}

      {/* QUESTION */}
      {phase === 'question' && currentQuestion && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">Q{questionIndex + 1} / {quiz.questions.length}</span>
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-3 py-1 text-sm font-bold">
              {answered} / {participants.size} answered
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-400 rounded-full transition-all duration-300"
              style={{ width: participants.size > 0 ? `${(answered / participants.size) * 100}%` : '0%' }}
            />
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400 p-6">
            <p className="text-xl font-semibold leading-snug text-gray-900">{currentQuestion.text}</p>
          </div>

          {/* Options with live vote bars */}
          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.options?.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = participants.size > 0 ? (votes / participants.size) * 100 : 0
              const isCorrect = String(i) === currentQuestion.correctAnswer
              return (
                <div
                  key={i}
                  className={`rounded-xl overflow-hidden border ${isCorrect ? 'ring-2 ring-lime-400 border-lime-300 bg-lime-50' : 'bg-white border-gray-200'}`}
                >
                  <div className="p-4 flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${OPTION_COLORS[i]}`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm flex-1 text-gray-800">{opt}</span>
                    {isCorrect && <span className="text-lime-600 text-xs font-bold">✓</span>}
                  </div>
                  <div className="h-1.5 bg-gray-100">
                    <div
                      className={`h-full transition-all duration-500 ${OPTION_COLORS[i]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Explanation (shown after question_ended event) */}
          {explanation && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
              <span className="font-bold text-indigo-600">Explanation: </span>{explanation}
            </div>
          )}

          <button
            onClick={nextQuestion}
            className={`w-full py-4 bg-lime-400 text-black font-black text-lg rounded-2xl hover:bg-lime-300 transition-colors ${
              answered === participants.size && participants.size > 0 ? 'animate-pulse' : ''
            }`}
          >
            {questionIndex + 1 >= quiz.questions.length ? 'End Quiz' : 'Next Question →'}
          </button>
        </div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <h2 className="text-2xl font-black text-gray-900">Session Complete</h2>

          {/* Leaderboard — always shown to host */}
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const podiumClass = i === 0
                ? 'bg-lime-400 text-black'
                : i === 1 ? 'bg-gray-200 text-black'
                : i === 2 ? 'bg-amber-200 text-amber-900'
                : 'bg-white border border-gray-200 text-gray-700'
              return (
                <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ${podiumClass}`}>
                  <span className="font-black w-5 text-center text-sm">{i + 1}</span>
                  <Avatar archetype={entry.archetype ?? ''} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">{entry.name}</p>
                    <p className="text-xs opacity-60 truncate">{entry.archetype}</p>
                  </div>
                  <span className="font-black tabular-nums text-sm">{entry.score.toLocaleString()}</span>
                </div>
              )
            })}
          </div>

          {/* Session Report */}
          <SessionReport questionStats={questionStats} />

          <button
            onClick={goBackToLibrary}
            className="mt-2 w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
          >
            Back to Library
          </button>
        </div>
      )}

    </div>
  )
}
