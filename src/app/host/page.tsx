'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

// ─── Test quiz for the walking skeleton ──────────────────────────────────────
const TEST_QUIZ = {
  title: 'AI Trivia Challenge',
  questions: [
    {
      id: 'q1',
      type: 'mcq',
      text: 'Which company created ChatGPT?',
      options: ['Google', 'OpenAI', 'Meta', 'Microsoft'],
      correctAnswer: '1',
      timerSeconds: 20,
      points: 1000,
    },
    {
      id: 'q2',
      type: 'truefalse',
      text: 'Claude AI was made by Anthropic.',
      options: ['True', 'False'],
      correctAnswer: '0',
      timerSeconds: 15,
      points: 1000,
    },
    {
      id: 'q3',
      type: 'mcq',
      text: 'What does GPT stand for?',
      options: [
        'General Processing Technology',
        'Guided Pattern Training',
        'Generative Pre-trained Transformer',
        'Global Processing Tool',
      ],
      correctAnswer: '2',
      timerSeconds: 25,
      points: 1000,
    },
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'lobby' | 'question' | 'ended'

interface LeaderboardEntry {
  name: string
  score: number
}

const OPTION_COLORS = [
  'bg-red-500 hover:bg-red-400',
  'bg-blue-500 hover:bg-blue-400',
  'bg-amber-500 hover:bg-amber-400',
  'bg-green-600 hover:bg-green-500',
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

// ─── Component ────────────────────────────────────────────────────────────────
export default function HostPage() {
  const socketRef = useRef<Socket | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [gameCode, setGameCode] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const currentQuestion = TEST_QUIZ.questions[questionIndex] ?? null

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('participant_joined', ({ name, count }: { name: string; count: number }) => {
      setParticipants(prev => [...prev, name])
      void count
    })

    socket.on('participant_left', ({ name }: { name: string }) => {
      setParticipants(prev => prev.filter(n => n !== name))
    })

    socket.on('answer_received', ({ count }: { count: number }) => {
      setAnswered(count)
    })

    socket.on('session_end', ({ leaderboard }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(leaderboard)
      setPhase('ended')
    })

    return () => { socket.disconnect() }
  }, [])

  // ─── Actions ─────────────────────────────────────────────────────────────

  function createSession() {
    socketRef.current?.emit('create_session', { quizData: TEST_QUIZ }, (res: { success: boolean; gameCode: string }) => {
      if (res.success) {
        setGameCode(res.gameCode)
        setPhase('lobby')
      }
    })
  }

  function startQuiz() {
    socketRef.current?.emit('start_quiz', { gameCode })
    setAnswered(0)
    setQuestionIndex(0)
    setPhase('question')
  }

  function nextQuestion() {
    const nextIndex = questionIndex + 1
    if (nextIndex >= TEST_QUIZ.questions.length) {
      socketRef.current?.emit('end_session', { gameCode })
    } else {
      socketRef.current?.emit('next_question', { gameCode })
      setQuestionIndex(nextIndex)
      setAnswered(0)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Nav ── */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Host</span>
        </span>
        {phase !== 'idle' && (
          <span className="text-sm text-zinc-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Ready to host?</h1>
              <p className="text-zinc-400">This session will use the test quiz below.</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Quiz Preview</p>
              <h2 className="text-lg font-semibold mb-3">{TEST_QUIZ.title}</h2>
              <div className="space-y-2">
                {TEST_QUIZ.questions.map((q, i) => (
                  <div key={q.id} className="flex gap-3 text-sm text-zinc-400">
                    <span className="text-zinc-600">{i + 1}.</span>
                    <span>{q.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={createSession}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
            >
              Create Session
            </button>
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <div className="space-y-8 text-center">
            <div>
              <p className="text-zinc-400 mb-2">Share this code with participants</p>
              <p className="text-xs text-zinc-500 mb-4">
                Go to <span className="text-lime-400">quizotic.net</span> and enter code:
              </p>
              <div className="inline-block bg-zinc-900 border border-zinc-700 rounded-2xl px-10 py-6">
                <span className="text-6xl font-bold tracking-[0.3em] text-lime-400">
                  {gameCode.slice(0, 3)} {gameCode.slice(3)}
                </span>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 text-left">
              <p className="text-sm text-zinc-500 mb-3">
                {participants.length === 0
                  ? 'Waiting for participants...'
                  : `${participants.length} joined:`}
              </p>
              {participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {participants.map((name, i) => (
                    <span key={i} className="px-3 py-1 bg-zinc-800 rounded-full text-sm">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={startQuiz}
              disabled={participants.length === 0}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {participants.length === 0 ? 'Waiting for players...' : 'Start Quiz →'}
            </button>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === 'question' && currentQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Question {questionIndex + 1} of {TEST_QUIZ.questions.length}
              </span>
              <span className="text-sm px-3 py-1 bg-zinc-800 rounded-full">
                <span className="text-lime-400 font-bold">{answered}</span>
                <span className="text-zinc-500"> / {participants.length} answered</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-lime-400 rounded-full transition-all duration-300"
                style={{ width: participants.length > 0 ? `${(answered / participants.length) * 100}%` : '0%' }}
              />
            </div>

            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <p className="text-xl font-semibold leading-snug">{currentQuestion.text}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options?.map((opt, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-4 flex items-center gap-3 ${
                    String(i) === currentQuestion.correctAnswer
                      ? 'ring-2 ring-lime-400 bg-lime-400/10'
                      : 'bg-zinc-800'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white ${OPTION_COLORS[i].split(' ')[0]}`}>
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="text-sm">{opt}</span>
                  {String(i) === currentQuestion.correctAnswer && (
                    <span className="ml-auto text-lime-400 text-xs font-bold">✓ correct</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={nextQuestion}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
            >
              {questionIndex + 1 >= TEST_QUIZ.questions.length ? 'End Quiz' : 'Next Question →'}
            </button>
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-zinc-500 uppercase tracking-widest mb-1">Quiz Complete</p>
              <h1 className="text-3xl font-bold">{TEST_QUIZ.title}</h1>
            </div>

            <div className="space-y-3">
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-xl px-5 py-4 ${
                    i === 0
                      ? 'bg-lime-400 text-zinc-950'
                      : i === 1
                      ? 'bg-zinc-300 text-zinc-950'
                      : i === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-zinc-800 text-white'
                  }`}
                >
                  <span className="text-2xl font-black w-8 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span className="font-semibold flex-1">{entry.name}</span>
                  <span className="font-bold tabular-nums">{entry.score.toLocaleString()} pts</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setPhase('idle')
                setParticipants([])
                setGameCode('')
                setQuestionIndex(0)
                setAnswered(0)
                setLeaderboard([])
              }}
              className="w-full py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:border-zinc-500 transition-colors"
            >
              Host Another Quiz
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
