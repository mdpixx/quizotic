'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { SessionReport } from '@/components/SessionReport'
import { getActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz, QuestionStat, SessionMode } from '@/lib/quiz-types'

type Phase = 'loading' | 'error' | 'idle' | 'lobby' | 'question' | 'ended'

interface LeaderboardEntry {
  name: string
  archetype?: string
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
  const sessionStartTimeRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>('loading')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [participants, setParticipants] = useState<Map<string, { archetype: string; team?: { index: number; name: string; color: string } | null }>>(new Map())
  // key = displayName, value = { archetype, team }
  const [sessionMode, setSessionMode] = useState<SessionMode>('competitive')
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [teamMode, setTeamMode] = useState(false)
  const [teamCount, setTeamCount] = useState(2)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teamLeaderboard, setTeamLeaderboard] = useState<{ name: string; color: string; score: number; members: number }[] | null>(null)
  const [followups, setFollowups] = useState<{ label: string; code: string }[]>([])
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupError, setFollowupError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
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

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
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

      // Save session record for analytics
      if (quiz && lb.length > 0) {
        const maxScore = lb[0].score || 1
        const avgScore = Math.round(lb.reduce((s, p) => s + (p.score / maxScore * 100), 0) / lb.length)
        const duration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
        const record = {
          id: crypto.randomUUID(),
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
        } catch {}
      }
    })

    return () => { socket.disconnect() }
  }, [quiz])

  async function createSession() {
    if (!quiz) return

    // Ensure quiz is persisted to DB before creating session (so GameSession.quizId is valid)
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
        if (data?.id) setQuiz(prev => prev ? { ...prev, id: data.id } : prev)
      }
    } catch {
      // DB save failed — proceed anyway, session will work but quizId may be orphaned
    }

    socketRef.current?.emit('create_session', { quizData: quiz, sessionMode, anonymousMode, teamMode, teamCount }, (res: { success: boolean; gameCode: string }) => {
      if (res.success) {
        setGameCode(res.gameCode)
        setPhase('lobby')
      }
    })
  }

  function startQuiz() {
    sessionStartTimeRef.current = Date.now()
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

  return (
    <div className="min-h-screen text-gray-900">

      {/* IDLE */}
      {phase === 'idle' && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <h1 className="text-4xl font-black mb-1" style={{ color: 'var(--color-dark)' }}>{quiz.title}</h1>
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
              <button
                onClick={() => setSessionMode('competitive')}
                className={`rounded-2xl p-4 border-2 text-left transition-all ${
                  sessionMode === 'competitive'
                    ? 'border-violet-500 bg-violet-50 shadow-sm'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <svg className="w-6 h-6 mb-2" viewBox="0 0 24 24" fill="none" stroke={sessionMode === 'competitive' ? '#4361EE' : '#9CA3AF'} strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round"/>
                </svg>
                <p className={`font-bold text-sm ${sessionMode === 'competitive' ? 'text-violet-700' : 'text-gray-900'}`}>Competitive</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">Live leaderboard, speed scoring</p>
              </button>
              <button
                onClick={() => setSessionMode('reflection')}
                className={`rounded-2xl p-4 border-2 text-left transition-all ${
                  sessionMode === 'reflection'
                    ? 'border-violet-500 bg-violet-50 shadow-sm'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <svg className="w-6 h-6 mb-2" viewBox="0 0 24 24" fill="none" stroke={sessionMode === 'reflection' ? '#4361EE' : '#9CA3AF'} strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinejoin="round"/>
                </svg>
                <p className={`font-bold text-sm ${sessionMode === 'reflection' ? 'text-violet-700' : 'text-gray-900'}`}>Reflection</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">Calmer pace, results at end</p>
              </button>
            </div>
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
              className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{ background: anonymousMode ? '#4361EE' : '#E5E7EB' }}
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
                className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
                style={{ background: teamMode ? '#4361EE' : '#E5E7EB' }}
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
                    style={teamCount === n ? { background: 'var(--color-primary)' } : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={createSession}
            className="w-full font-black rounded-2xl py-5 text-xl transition-all hover:opacity-90"
            style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}
          >
            Create Session
          </button>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-dark)' }}>Quizo<span style={{ color: 'var(--color-primary)' }}>tic</span></h1>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold px-4 py-1.5 rounded-full border ${
                sessionMode === 'reflection'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                {sessionMode === 'reflection' ? 'Reflection' : 'Competitive'}
              </span>
              <span className="bg-green-50 border border-green-200 text-green-700 text-base font-bold px-4 py-1.5 rounded-full">
                {participants.size} players
              </span>
            </div>
          </div>

          {/* Game code + QR code */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-hidden">
            <div className="flex gap-4 items-center min-w-0">
              <div className="flex-1 min-w-0 text-center">
                <p className="text-base font-bold text-gray-400 uppercase tracking-widest mb-3">Game Code</p>
                <p className="text-6xl font-black tracking-[0.3em]" style={{ color: 'var(--color-primary)' }}>{gameCode}</p>
                <p className="text-gray-400 text-base mt-3">quizotic.live</p>
              </div>
              <div className="flex-shrink-0 text-center">
                <p className="text-base font-bold text-gray-400 uppercase tracking-widest mb-3">Scan to Join</p>
                <div className="bg-white rounded-2xl p-3 border border-gray-200">
                  <QRCode
                    value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}`}
                    size={128}
                    bgColor="#ffffff"
                    fgColor="#4361EE"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Avatar grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <p className="text-base font-bold text-gray-400 uppercase tracking-wide mb-3">
              {participants.size === 0 ? 'Waiting for participants...' : `${participants.size} joined`}
            </p>
            <div className="flex flex-wrap gap-4">
              {Array.from(participants.entries()).map(([pName, pInfo]) => (
                <div key={pName} className="flex flex-col items-center gap-1">
                  <div className="ring-2 rounded-full overflow-hidden" style={{ borderColor: pInfo.team?.color ?? '#DBEAFE' }}>
                    <Avatar archetype={pInfo.archetype} size={56} />
                  </div>
                  <p className="text-base text-gray-700 font-semibold max-w-[72px] truncate text-center">{pName}</p>
                  {pInfo.team ? (
                    <p className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: pInfo.team.color }}>{pInfo.team.name}</p>
                  ) : (
                    <p className="text-sm text-gray-400 max-w-[72px] truncate text-center">{pInfo.archetype}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={startQuiz}
            disabled={participants.size === 0}
            className="w-full bg-amber-400 text-black font-black rounded-2xl py-5 text-xl hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {participants.size === 0 ? 'Waiting for players...' : 'Start Quiz'}
          </button>
        </div>
      )}

      {/* QUESTION */}
      {phase === 'question' && currentQuestion && quiz && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xl text-gray-500 font-semibold">Q{questionIndex + 1} / {quiz.questions.length}</span>
            <span className="bg-blue-50 border border-blue-100 rounded-full px-5 py-2 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {answered} / {participants.size} answered
            </span>
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
            <div className="rounded-2xl p-6 border" style={{ background: '#1B2559', borderColor: '#2D3A6E' }}>
              <p className="text-base font-bold uppercase tracking-widest mb-2" style={{ color: '#6B8AFF' }}>Scenario</p>
              <p className="text-xl leading-relaxed" style={{ color: '#E0E7FF' }}>{currentQuestion.scenarioText}</p>
              {currentQuestion.supportingDetail && (
                <p className="mt-3 font-bold text-lg" style={{ color: '#FFD166' }}>{currentQuestion.supportingDetail}</p>
              )}
            </div>
          )}

          {/* Question card */}
          <div className={`bg-white rounded-2xl shadow-sm border p-8 ${currentQuestion.type === 'case' ? 'border-blue-200 border-t-4 border-t-blue-500' : 'border-gray-200 border-t-4 border-t-amber-400'}`}>
            <p className="text-3xl font-bold leading-snug" style={{ color: 'var(--color-dark)' }}>{currentQuestion.text}</p>
          </div>

          {/* Options with live vote bars */}
          <div className="grid grid-cols-2 gap-4">
            {currentQuestion.options?.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = participants.size > 0 ? (votes / participants.size) * 100 : 0
              const isCorrect = String(i) === currentQuestion.correctAnswer
              const isCaseType = currentQuestion.type === 'case' || currentQuestion.type === 'poll'
              return (
                <div
                  key={i}
                  className={`rounded-xl overflow-hidden border ${!isCaseType && isCorrect ? 'ring-2 ring-green-400 border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}
                >
                  <div className="p-5 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${OPTION_COLORS[i]}`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-xl flex-1 text-gray-800 font-medium">{opt}</span>
                    <span className="text-lg font-bold text-gray-400">{votes}</span>
                    {!isCaseType && isCorrect && <span className="text-green-600 text-lg font-bold">✓</span>}
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

          {/* Explanation / Debrief (shown after question_ended event) */}
          {explanation && (
            <div className={`rounded-xl p-5 text-lg ${currentQuestion.type === 'case' ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
              <span className={`font-bold ${currentQuestion.type === 'case' ? 'text-blue-600' : 'text-blue-600'}`}>
                {currentQuestion.type === 'case' ? 'Expert View: ' : 'Explanation: '}
              </span>
              {explanation}
            </div>
          )}

          <button
            onClick={nextQuestion}
            className={`w-full py-5 bg-amber-400 text-black font-black text-2xl rounded-2xl hover:bg-amber-300 transition-colors ${
              answered === participants.size && participants.size > 0 ? 'animate-pulse' : ''
            }`}
          >
            {questionIndex + 1 >= quiz.questions.length ? 'End Quiz' : 'Next Question'}
          </button>
        </div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <div className="p-4 max-w-2xl mx-auto py-8 space-y-4">
          <h2 className="text-4xl font-black" style={{ color: 'var(--color-dark)' }}>Session Complete</h2>

          {/* Team Leaderboard */}
          {teamLeaderboard && teamLeaderboard.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-black" style={{ color: 'var(--color-dark)' }}>Team Standings</h3>
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

          {/* Animated Podium Leaderboard */}
          <Podium leaderboard={leaderboard} sessionMode={sessionMode} />

          {/* Session Report */}
          <SessionReport
            questionStats={questionStats}
            quizTitle={quiz?.title}
            participantCount={leaderboard.length}
            sessionDate={new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          />

          {/* Spaced Follow-up Series */}
          <div className="rounded-2xl border p-5" style={{ borderColor: '#DBEAFE', background: '#F0F4FF' }}>
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
                  style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}
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
                      <p className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>{fu.code}</p>
                    </div>
                    <button
                      onClick={() => copyFollowupLink(fu.code)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all"
                      style={{
                        borderColor: copiedCode === fu.code ? '#4361EE' : '#DBEAFE',
                        color: copiedCode === fu.code ? '#4361EE' : '#6B7280',
                        background: copiedCode === fu.code ? '#F0F4FF' : '#fff',
                      }}
                    >
                      {copiedCode === fu.code ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
