'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import { motion, useReducedMotion } from 'framer-motion'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { PostSessionHeader } from '@/components/PostSessionHeader'
import { CelebrationConfetti } from '@/components/CelebrationConfetti'
import { SessionReport } from '@/components/SessionReport'
import { LeaderboardView } from '@/components/LeaderboardView'
import { playLeaderboardJingle, playTick, playBackgroundMusic, stopBackgroundMusic } from '@/lib/sounds'
import { getActiveSession, setActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz, QuestionStat, SessionMode } from '@/lib/quiz-types'
import { ReflectionInsights } from '@/components/ReflectionInsights'
import { getOptionText, getOptionImage, isScoredType, getEffectiveOptions } from '@/lib/quiz-types'
import { QuestionResultsView } from '@/components/results/QuestionResultsView'
import { CircularTimer } from '@/components/CircularTimer'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { BrandWatermark } from '@/components/BrandWatermark'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { JoinPill } from '@/components/host/JoinPill'
import { EndQuizConfirmModal } from '@/components/host/EndQuizConfirmModal'
import { getQuizTheme } from '@/lib/quiz-themes'
import { buildLeaderboardStageRows, getPostQuestionAction } from '@/lib/host-stage'
import { startClockSync, getServerNow, resyncClock } from '@/lib/clock-sync'

type Phase = 'loading' | 'error' | 'idle' | 'lobby' | 'question' | 'standings' | 'ended'

// Soft auto-advance on the standings screen — gives the host ~6 seconds to
// review before the engine quietly moves to the next question. The "Hold"
// button cancels the countdown for the current screen only.
const STANDINGS_AUTO_TOTAL_MS = 8000
// Delay between mounting the leaderboard at PRIOR positions and swapping it
// to the NEW standings. This gives framer-motion two distinct layout frames
// so its `layout` prop animates the tile shuffle. Must be less than
// STANDINGS_AUTO_TOTAL_MS so the animation completes before the auto-advance.
const STANDINGS_ANIM_SEED_MS = 900

interface LeaderboardEntry {
  name: string
  archetype?: string
  score: number
}

interface TopMover {
  name: string
  archetype?: string
  fromRank: number
  toRank: number
  delta: number
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

function buildHostStagePreviewQuiz(): Quiz {
  return {
    id: 'preview-host-stage',
    title: 'Host Stage Preview',
    subject: 'Demo',
    language: 'en',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        text: 'Which planet is closest to the Sun?',
        options: ['Mercury', 'Venus', 'Earth', 'Mars'],
        correctAnswer: '0',
        timerSeconds: 20,
        points: 1000,
        explanation: 'Mercury is the innermost planet in our Solar System.',
        bloomsLevel: 'remember',
      },
      {
        id: 'q2',
        type: 'mcq',
        text: 'A student answers correctly in the final second. What should the scoring system still reward?',
        options: ['Nothing', 'Accuracy with lower speed points', 'Only streaks', 'Manual points'],
        correctAnswer: '1',
        timerSeconds: 30,
        points: 1000,
        explanation: 'A good live quiz rewards correctness while still making speed matter.',
        bloomsLevel: 'understand',
      },
    ],
  }
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
  const reduceStageMotion = useReducedMotion()
  const isHostStagePreview = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.search.includes('preview=host-stage')
  const [initialQuiz] = useState<Quiz | null>(() => {
    const session = getActiveSession()
    if (session) return session
    return isHostStagePreview ? buildHostStagePreviewQuiz() : null
  })
  const socketRef = useRef<Socket | null>(null)
  const sessionStartTimeRef = useRef<number>(0)
  // Refs that initSocket's stable closure needs to read on reconnect.
  const gameCodeRef = useRef<string>('')
  const hostResumeTokenRef = useRef<string>('')

  const [phase, setPhase] = useState<Phase>(initialQuiz ? 'idle' : 'loading')
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz)
  const quizRef = useRef<Quiz | null>(null)
  const questionIndexRef = useRef<number>(0)
  const [gameCode, setGameCode] = useState('')
  // key = participantId (preferred) or `name:<displayName>` for legacy events.
  // Storing connection state here lets us render a single list with offline
  // dimming during the disconnect grace period instead of removing entries.
  const [participants, setParticipants] = useState<Map<string, { name: string; archetype: string; team?: { index: number; name: string; color: string } | null; connected: boolean }>>(new Map())
  // Derived: count of currently CONNECTED participants. Used everywhere the
  // host UI shows a "players" number — drives the lobby chip, the start
  // button, the answered/total fraction, and the % calculations during
  // questions. Disconnected entries (within grace) are not counted here so
  // the host UI matches the server's authoritative connectedCount.
  const connectedCount = useMemo(() => {
    let n = 0
    for (const p of participants.values()) if (p.connected) n++
    return n
  }, [participants])
  // Connected entries first, then disconnected (greyed) — keeps the lobby
  // tile order stable so a momentary blip doesn't reshuffle the grid.
  const playerEntries = useMemo(() => {
    const list = Array.from(participants.entries())
    list.sort((a, b) => Number(b[1].connected) - Number(a[1].connected))
    return list
  }, [participants])
  const [sessionMode, setSessionMode] = useState<SessionMode>('competitive')
  const sessionModeRef = useRef<SessionMode>('competitive')
  useEffect(() => { sessionModeRef.current = sessionMode }, [sessionMode])
  useEffect(() => { quizRef.current = quiz }, [quiz])
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [teamMode, setTeamMode] = useState(false)
  // Shared-screen classroom mode — phones show only colour tap zones, no
  // question text. Falls back to full-device for non-MCQ types automatically.
  const [displayMode, setDisplayMode] = useState<'full-device' | 'shared-screen'>('full-device')
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
  const [showOverflowMenu, setShowOverflowMenu] = useState(false)
  const [showEndQuizConfirm, setShowEndQuizConfirm] = useState(false)
  const [followups, setFollowups] = useState<{ label: string; code: string }[]>([])
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupError, setFollowupError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [optionCounts, setOptionCounts] = useState<number[]>([])
  const [paused, setPaused] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  const [hostTimeLeft, setHostTimeLeft] = useState(0)
  const hostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null)
  const [rankingSubmissions, setRankingSubmissions] = useState<number[][]>([])
  const [attendees, setAttendees] = useState<Array<{ joinedAt: string; leftAt: string | null; durationSec: number | null }>>([])
  const [intermediateLeaderboard, setIntermediateLeaderboard] = useState<LeaderboardEntry[]>([])
  const intermediateLeaderboardRef = useRef<LeaderboardEntry[]>([])
  useEffect(() => { intermediateLeaderboardRef.current = intermediateLeaderboard }, [intermediateLeaderboard])
  const [previousIntermediateLeaderboard, setPreviousIntermediateLeaderboard] = useState<LeaderboardEntry[]>([])
  // Visually-displayed leaderboard for the standings phase. Seeded with the
  // PREVIOUS standings on phase entry so framer-motion's `layout` prop has
  // a starting position to animate FROM. After 900ms we swap to the new
  // standings — that bounding-box delta triggers the rank-shuffle motion.
  // Without this, the LeaderboardView mounts with already-sorted new data
  // and tiles snap to position instantly (no Kahoot-style movement).
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState<LeaderboardEntry[]>([])
  const [topMovers, setTopMovers] = useState<TopMover[]>([])
  const [standingsRecommended, setStandingsRecommended] = useState(false)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [endNowArmed, setEndNowArmed] = useState(false)
  const endNowArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Soft auto-advance on standings — null means disabled / cancelled.
  // Number is the remaining ms before nextQuestion() fires automatically.
  const [standingsAutoMs, setStandingsAutoMs] = useState<number | null>(null)
  useEffect(() => {
    const html = document.documentElement
    const shouldHideFeedback = phase === 'question' || phase === 'standings' || phase === 'ended'
    if (shouldHideFeedback) html.setAttribute('data-feedback-hidden', 'host-session')
    else if (html.getAttribute('data-feedback-hidden') === 'host-session') html.removeAttribute('data-feedback-hidden')

    return () => {
      if (html.getAttribute('data-feedback-hidden') === 'host-session') html.removeAttribute('data-feedback-hidden')
    }
  }, [phase])

  useEffect(() => {
    // Always reset scroll on phase change so the projector view starts at
    // the top — the host shouldn't have to scroll up to see the podium when
    // the quiz ends.
    if (phase === 'question' || phase === 'standings' || phase === 'ended') window.scrollTo(0, 0)
  }, [phase, questionIndex])

  // Leaderboard tile-shuffle animation: when we enter the standings phase,
  // first show the PRIOR standings, then after STANDINGS_ANIM_SEED_MS swap
  // to the new ones. The bounding-box change triggers framer-motion's
  // `layout` prop on LeaderboardView rows, producing the Kahoot-style rank
  // movement. See STANDINGS_ANIM_SEED_MS comment for why.
  useEffect(() => {
    if (phase !== 'standings') return
    // Seed: if there is no prior standings (first question), show current
    // immediately — animating from nothing looks like a snap anyway.
    if (previousIntermediateLeaderboard.length === 0) {
      setDisplayedLeaderboard(intermediateLeaderboard)
      return
    }
    setDisplayedLeaderboard(previousIntermediateLeaderboard)
    const t = setTimeout(() => setDisplayedLeaderboard(intermediateLeaderboard), STANDINGS_ANIM_SEED_MS)
    return () => clearTimeout(t)
  }, [phase, intermediateLeaderboard, previousIntermediateLeaderboard])

  // Soft auto-advance — when the host enters the standings phase, start the
  // countdown. Hitting "Hold" sets standingsAutoMs to null and the countdown
  // stops. Reaching 0 fires nextQuestion() once.
  useEffect(() => {
    if (phase !== 'standings') {
      setStandingsAutoMs(null)
      return
    }
    if (isHostStagePreview) {
      setStandingsAutoMs(null)
      return
    }
    setStandingsAutoMs(STANDINGS_AUTO_TOTAL_MS)
  }, [phase, isHostStagePreview])

  useEffect(() => {
    if (phase !== 'standings') return
    if (standingsAutoMs === null) return
    if (standingsAutoMs <= 0) {
      setStandingsAutoMs(null)
      nextQuestion()
      return
    }
    const id = setTimeout(() => {
      setStandingsAutoMs(prev => (prev === null ? null : Math.max(0, prev - 100)))
    }, 100)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, standingsAutoMs])
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
  // Running aggregate for non-scored questions — fed by `live_responses` while
  // the question is open, frozen by `question_reveal` after it closes.
  const [liveStat, setLiveStat] = useState<Partial<QuestionStat> | null>(null)
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
    // useState lazy initializer already loaded the quiz from localStorage —
    // re-setting it here with a fresh JSON.parse'd object would change the
    // reference, retrigger the socket-init useEffect's cleanup, and kill the
    // socket. See plans/in-quizotic-the-quiz-shimmering-quasar.md.
    if (quiz) return
    const session = getActiveSession()
    if (!session && isHostStagePreview) {
      const previewQuiz = buildHostStagePreviewQuiz()
      setActiveSession(previewQuiz)
      setQuiz(previewQuiz)
      setPhase('idle')
      return
    }
    if (!session) {
      setPhase('error')
      return
    }
    setQuiz(session)
    setPhase('idle')
  }, [isHostStagePreview, quiz])

  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

  // Hydrate background-music preference from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('quizotic_host_musicOn') === 'true') setMusicOn(true)
  }, [])

  // Drive background music on/off + persist the host's choice. Cleanup stops
  // the loop on unmount so navigating away or ending the session kills audio.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (musicOn) playBackgroundMusic()
    else stopBackgroundMusic()
    localStorage.setItem('quizotic_host_musicOn', String(musicOn))
    return () => { stopBackgroundMusic() }
  }, [musicOn])

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

    // Start NTP-style clock sync so host's timer math is anchored on server
    // time, not the drifted local clock. Without this, a host laptop whose
    // clock has drifted (common on projector laptops with NTP disabled)
    // computes elapsed = clientNow - serverStartAt and ends up showing the
    // timer in the red zone immediately.
    const stopClockSync = startClockSync(socket)

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

    // participantId (UUID) is the durable identity. We fall back to name-keyed
    // entries only for older server payloads that haven't been redeployed yet.
    const keyFor = (participantId?: string | null, name?: string) =>
      participantId ? `pid:${participantId}` : `name:${(name || 'unknown').toLowerCase()}`

    socket.on('participant_joined', ({ name, archetype, team, participantId }: { name: string; archetype: string; count?: number; connectedCount?: number; team?: { index: number; name: string; color: string } | null; participantId?: string }) => {
      setParticipants(prev => new Map(prev).set(keyFor(participantId, name), { name, archetype, team, connected: true }))
    })

    // Same person returning (server matched by participantId or name-grace).
    // Map.set is idempotent on the participantId key, so the count never
    // inflates even if this fires multiple times.
    socket.on('participant_rejoined', ({ name, archetype, team, participantId }: { name: string; archetype: string; team?: { index: number; name: string; color: string } | null; participantId?: string; connectedCount?: number }) => {
      setParticipants(prev => new Map(prev).set(keyFor(participantId, name), { name, archetype, team, connected: true }))
    })

    // Immediate disconnect — flip to offline but DO NOT remove. Removal only
    // happens on participant_left (after the 20-min grace expires).
    socket.on('participant_disconnected', ({ name, participantId }: { name: string; participantId?: string; connectedCount?: number }) => {
      setParticipants(prev => {
        const next = new Map(prev)
        const k = keyFor(participantId, name)
        const existing = next.get(k)
        if (existing) next.set(k, { ...existing, connected: false })
        return next
      })
    })

    socket.on('participant_left', ({ name, participantId }: { name: string; participantId?: string; count?: number; connectedCount?: number }) => {
      setParticipants(prev => {
        const next = new Map(prev)
        next.delete(keyFor(participantId, name))
        // Legacy fallback — older server emits may have only sent name.
        if (!participantId) next.delete(`name:${(name || '').toLowerCase()}`)
        return next
      })
    })

    // Authoritative state from server every 5s — replace the entire Map so
    // any drift (missed events, late hot-reload) is corrected.
    socket.on('session_state', ({ active, disconnected }: { active: Array<{ participantId: string | null; name: string; archetype: string | null; team: { index: number; name: string; color: string } | null }>; disconnected: Array<{ participantId: string | null; name: string; archetype: string | null; team: { index: number; name: string; color: string } | null }>; connectedCount: number; totalCount: number }) => {
      setParticipants(() => {
        const next = new Map<string, { name: string; archetype: string; team?: { index: number; name: string; color: string } | null; connected: boolean }>()
        for (const p of active || []) {
          next.set(keyFor(p.participantId, p.name), { name: p.name, archetype: p.archetype || '', team: p.team, connected: true })
        }
        for (const p of disconnected || []) {
          next.set(keyFor(p.participantId, p.name), { name: p.name, archetype: p.archetype || '', team: p.team, connected: false })
        }
        return next
      })
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
      setEndNowArmed(false)
      if (endNowArmTimerRef.current) { clearTimeout(endNowArmTimerRef.current); endNowArmTimerRef.current = null }
      setQuestionStartedAt(effectiveStart)
      setRankingSubmissions([])
      setDrawings([]) // reset drawing gallery for each new question
      setWordcloudWords([])
      setQaEntries([])
      setOpenendedEntries([])
      setRatingValues([])
      setLiveStat(null)

      // Tighten the clock offset right when a new question arrives — same
      // reasoning as the participant client.
      resyncClock()

      const msUntilStart = Math.max(0, effectiveStart - getServerNow())
      const rawTimerSeconds = quiz?.questions[index]?.timerSeconds ?? 20
      const timerSeconds = Math.max(5, Math.min(120, Number(rawTimerSeconds) || 20))

      if (msUntilStart > 500) {
        // Wall-clock-anchored 3-2-1 countdown. Both host and participant use
        // the SAME formula — Math.min(3, Math.ceil((effectiveStart - now)/1000))
        // — polled every 100ms, so the displayed number flips at the same
        // moment on both screens regardless of when each one received the
        // question_show event.
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        let lastShown = 0
        const updateCountdown = () => {
          const remainingMs = effectiveStart - getServerNow()
          const value = Math.max(0, Math.min(3, Math.ceil(remainingMs / 1000)))
          if (value <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current)
              countdownTimerRef.current = null
            }
            setCountdownValue(null)
            startHostTimer(timerSeconds, effectiveStart)
            return
          }
          if (value !== lastShown) {
            lastShown = value
            setCountdownValue(value)
            playTick()
          }
        }
        updateCountdown()
        countdownTimerRef.current = setInterval(updateCountdown, 100)
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

    socket.on('leaderboard_update', ({ top, teamLeaderboard: tlb, topMovers: tm, standingsRecommended: sr }: {
      top: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      topMovers?: TopMover[];
      standingsRecommended?: boolean;
    }) => {
      setPreviousIntermediateLeaderboard(intermediateLeaderboardRef.current)
      setIntermediateLeaderboard(top)
      if (tlb) setTeamLeaderboard(tlb)
      setTopMovers(tm ?? [])
      setStandingsRecommended(!!sr)
      // Server only emits this after scored questions end, so every arrival
      // marks a genuine rank-change moment — play the reveal jingle.
      try { playLeaderboardJingle() } catch {}
    })

    socket.on('drawing_submitted', (entry: { name: string; archetype: string; dataUrl: string }) => {
      setDrawings(prev => [...prev, entry])
    })

    // Running aggregate for non-scored questions while the question is open.
    // The shape mirrors QuestionStat so it can feed QuestionResultsView directly.
    socket.on('live_responses', (payload: Partial<QuestionStat> & { questionIndex: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { questionIndex: _qi, ...stat } = payload
      setLiveStat(stat)
    })

    // Final reveal aggregate after a non-scored question closes.
    socket.on('question_reveal', ({ stat }: { questionIndex: number; stat: QuestionStat; totalParticipants: number }) => {
      setLiveStat(stat)
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
      socket.off('participant_rejoined')
      socket.off('participant_disconnected')
      socket.off('participant_left')
      socket.off('session_state')
      socket.off('answer_received')
      socket.off('question_started')
      socket.off('ranking_submission')
      socket.off('question_show')
      socket.off('question_ended')
      socket.off('session_ended')
      socket.off('leaderboard_update')
      socket.off('drawing_submitted')
      socket.off('live_responses')
      socket.off('question_reveal')
      stopClockSync()
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

    socketRef.current.emit('create_session', { quizData: quizDataForSession, sessionMode, anonymousMode, teamMode, teamCount, displayMode, ghostSessionId: ghostMode && ghostSessionId ? ghostSessionId : undefined }, (res: { success: boolean; gameCode: string; error?: string; hostResumeToken?: string }) => {
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
    // Belt-and-suspenders clamp matching server-side sanitizeQuestion.
    const safeSeconds = Math.max(5, Math.min(120, Number(seconds) || 20))
    timerDurationRef.current = safeSeconds
    // Anchor on the server timestamp (always). getServerNow() vs server start
    // means we measure elapsed in SERVER time regardless of how the host
    // laptop's clock has drifted — this was the source of the red-zone bug.
    timerStartRef.current = serverTimestamp ?? getServerNow()
    setHostTimeLeft(safeSeconds)
    let lastTickSecond = safeSeconds + 1
    hostTimerRef.current = setInterval(() => {
      const elapsed = (getServerNow() - timerStartRef.current) / 1000
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
    setIntermediateLeaderboard([])
    setPreviousIntermediateLeaderboard([])
    setDisplayedLeaderboard([])
    setTopMovers([])
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

  function endCurrentQuestion(): Promise<boolean> {
    if (!socketRef.current?.connected || !gameCode) return Promise.resolve(false)
    return new Promise(resolve => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        resolve(false)
      }, 3000)
      socketRef.current?.emit('end_question', { gameCode }, (res?: { success?: boolean; error?: string; ended?: boolean; questionIndex?: number }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(!!res?.success)
      })
    })
  }

  function stopLiveQuestionTimer() {
    if (hostTimerRef.current) {
      clearInterval(hostTimerRef.current)
      hostTimerRef.current = null
    }
    setHostTimeLeft(0)
  }

  async function revealCurrentAnswer() {
    if (!questionEnded) {
      const ok = await endCurrentQuestion()
      if (!ok) return
      setQuestionEnded(true)
      stopLiveQuestionTimer()
    }
    setCorrectRevealed(true)
  }

  async function advanceAfterEndingCurrentQuestion() {
    if (!questionEnded) {
      const ok = await endCurrentQuestion()
      if (!ok) return
      setQuestionEnded(true)
      stopLiveQuestionTimer()
    }
    nextQuestion()
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

  function seedHostStagePreviewParticipants() {
    const previewPlayers: Array<[string, { name: string; archetype: string; connected: boolean }]> = [
      ['pid:preview-asha', { name: 'Asha', archetype: 'Solar Panther', connected: true }],
      ['pid:preview-ravi', { name: 'Ravi', archetype: 'Mystic Eagle', connected: true }],
      ['pid:preview-meera', { name: 'Meera', archetype: 'Neon Tiger', connected: true }],
      ['pid:preview-kabir', { name: 'Kabir', archetype: 'Cosmic Fox', connected: true }],
      ['pid:preview-zoya', { name: 'Zoya', archetype: 'Pixel Falcon', connected: true }],
      ['pid:preview-isha', { name: 'Isha', archetype: 'Thunder Panda', connected: true }],
      ['pid:preview-aman', { name: 'Aman', archetype: 'Lunar Shark', connected: true }],
      ['pid:preview-nia', { name: 'Nia', archetype: 'Emerald Lynx', connected: true }],
    ]
    setParticipants(new Map(previewPlayers))
    setAnswered(6)
    setOptionCounts([4, 1, 1, 0])
    setQuestionEnded(false)
    setCorrectRevealed(false)
    setExplanation(null)
  }

  function revealHostStagePreviewAnswers() {
    if (participants.size === 0) seedHostStagePreviewParticipants()
    setAnswered(8)
    setOptionCounts([5, 1, 1, 1])
    setQuestionEnded(true)
    setCorrectRevealed(true)
    setExplanation(currentQuestion?.explanation ?? null)
    setHostTimeLeft(0)
    if (hostTimerRef.current) { clearInterval(hostTimerRef.current); hostTimerRef.current = null }
  }

  function showHostStagePreviewStandings() {
    setPreviousIntermediateLeaderboard([
      { name: 'Asha', archetype: 'Solar Panther', score: 1840 },
      { name: 'Ravi', archetype: 'Mystic Eagle', score: 1710 },
      { name: 'Meera', archetype: 'Neon Tiger', score: 1320 },
      { name: 'Kabir', archetype: 'Cosmic Fox', score: 1120 },
      { name: 'Zoya', archetype: 'Pixel Falcon', score: 900 },
      { name: 'Isha', archetype: 'Thunder Panda', score: 820 },
    ])
    setIntermediateLeaderboard([
      { name: 'Meera', archetype: 'Neon Tiger', score: 2310 },
      { name: 'Asha', archetype: 'Solar Panther', score: 2190 },
      { name: 'Ravi', archetype: 'Mystic Eagle', score: 1810 },
      { name: 'Isha', archetype: 'Thunder Panda', score: 1640 },
      { name: 'Kabir', archetype: 'Cosmic Fox', score: 1120 },
      { name: 'Zoya', archetype: 'Pixel Falcon', score: 900 },
    ])
    setTopMovers([
      { name: 'Meera', archetype: 'Neon Tiger', fromRank: 3, toRank: 1, delta: 2 },
      { name: 'Isha', archetype: 'Thunder Panda', fromRank: 6, toRank: 4, delta: 2 },
    ])
    setStandingsRecommended(true)
    setPhase('standings')
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
  const isLiveHostStage = phase === 'question' || phase === 'standings' || phase === 'ended'

  return (
    <div
      className="min-h-screen"
      style={{ background: quizTheme.background, color: quizTheme.textColor }}
      data-theme={quizTheme.id}
    >
      {!isLiveHostStage && <BrandWatermark placement="host" />}

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
                { mode: 'accuracy' as const, label: 'Accuracy', desc: '100 pts per correct, no speed pressure', icon: 'M12 2l1.5 4.5L18 8l-4 3.5L15 16l-3-2-3 2 1-4.5L6 8l4.5-1.5L12 2z', comingSoon: false },
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

          {/* Display mode toggle — shared-screen vs full-device */}
          <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: '#FEF3C7' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm" style={{ color: '#1E1B4B' }}>Shared-Screen Mode</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Phones show colour buttons only — host display shows the question. Best for in-room classrooms.</p>
              </div>
              <button
                onClick={() => setDisplayMode(m => m === 'shared-screen' ? 'full-device' : 'shared-screen')}
                aria-pressed={displayMode === 'shared-screen'}
                aria-label="Toggle shared-screen mode"
                className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                style={{ background: displayMode === 'shared-screen' ? '#0F1B3D' : '#E5E7EB' }}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${displayMode === 'shared-screen' ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
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
                  {{ competitive: '⚡ Competitive', accuracy: '✓ Accuracy', reflection: '🌙 Reflection', selfpaced: '🎯 Self-paced', assessment: '📋 Assessment' }[sessionMode] ?? '⚡ Competitive'}
                </span>
                <span className="text-sm font-black px-4 py-1.5 rounded-full text-[#46107a]" style={{ background: '#F5E642', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>
                  {connectedCount} {connectedCount === 1 ? 'player' : 'players'}
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
                  {connectedCount === 0 ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#F5E642' }} />
                      Waiting for players…
                    </>
                  ) : (
                    <>
                      <span>🎉</span> {connectedCount} joined
                    </>
                  )}
                </p>
              </div>
              {playerEntries.length === 0 ? (
                <p className="text-white/70 text-sm">Players will appear here as they join. Share the code above.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {playerEntries.map(([pKey, pInfo]) => (
                    <div
                      key={pKey}
                      className="flex flex-col items-center gap-1 lobby-join-pop"
                      style={{ opacity: pInfo.connected ? 1 : 0.45, filter: pInfo.connected ? 'none' : 'grayscale(0.6)' }}
                      title={pInfo.connected ? '' : 'Offline — waiting for reconnect'}
                    >
                      <div className="ring-2 rounded-full overflow-hidden" style={{ borderColor: pInfo.team?.color ?? '#F5E642' }}>
                        <Avatar archetype={pInfo.archetype} size={56} />
                      </div>
                      <p className="text-sm text-white font-bold max-w-[80px] truncate text-center">
                        {pInfo.name}{pInfo.connected ? '' : ' (offline)'}
                      </p>
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
              disabled={(!isHostStagePreview && connectedCount === 0) || !socketConnected}
              className="w-full font-black rounded-2xl py-5 text-xl disabled:opacity-40 disabled:pointer-events-none transition-all hover:scale-[1.01]"
              style={{
                background: (connectedCount > 0 || isHostStagePreview) && socketConnected ? 'linear-gradient(135deg, #F5E642 0%, #FFB800 100%)' : 'rgba(255,255,255,0.25)',
                color: (connectedCount > 0 || isHostStagePreview) && socketConnected ? '#46107a' : '#ffffff',
                boxShadow: (connectedCount > 0 || isHostStagePreview) && socketConnected ? '0 8px 0 rgba(0,0,0,0.2)' : undefined,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {!socketConnected ? 'Reconnecting…' : connectedCount === 0 && !isHostStagePreview ? 'Waiting for players…' : `▶ Start Quiz (${connectedCount})`}
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
        <motion.div
          key={`host-question-${questionIndex}-${currentQuestion.type}`}
          initial={reduceStageMotion ? false : { opacity: 0, y: 18, scale: 0.99 }}
          animate={reduceStageMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
          className="min-h-screen h-screen max-h-screen overflow-hidden px-4 pt-3 pb-3 lg:px-8 lg:pt-4 lg:pb-4 flex flex-col gap-3 host-question-stage"
          style={{
            background: 'linear-gradient(135deg, #071126 0%, #0F1B3D 55%, #102A43 100%)',
            color: '#FFFFFF',
          }}
        >
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

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: 'rgba(255,255,255,0.52)' }}>
                Live Question
              </span>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-3xl md:text-4xl font-black tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: '#F5E642' }}>
                  Q{questionIndex + 1}
                </span>
                <span className="text-lg md:text-xl font-bold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  of {quiz.questions.length}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3">
              {currentQuestion.timerSeconds > 0 && (
                questionStartedAt == null || Date.now() < questionStartedAt ? (
                  <span className="min-w-16 text-center text-sm font-semibold animate-pulse px-4 py-2 rounded-full" style={{ color: '#F5E642', background: 'rgba(255,255,255,0.08)' }}>Loading…</span>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(15,27,61,0.42)' }}>
                    <CircularTimer timeLeft={hostTimeLeft} total={currentQuestion.timerSeconds} />
                  </div>
                )
              )}
              <span className="inline-flex h-14 items-center rounded-full px-5 text-xl font-black tabular-nums whitespace-nowrap" style={{ color: '#0F1B3D', background: '#F5E642', boxShadow: '0 6px 0 rgba(0,0,0,0.24)' }}>
                {answered}/{connectedCount}
                <span className="ml-2 text-sm uppercase tracking-wider">answered</span>
              </span>
              <div className="hidden xl:block">
                <JoinPill gameCode={gameCode} variant="dock" />
              </div>
              <div className="hidden md:block xl:hidden">
                <JoinPill gameCode={gameCode} variant="compact" />
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="max-w-7xl mx-auto h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: connectedCount > 0 ? `${(answered / connectedCount) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #F5E642 0%, #22C55E 100%)',
              }}
            />
          </div>

          {isHostStagePreview && (
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.58)' }}>
                Preview simulator
              </span>
              <button
                type="button"
                onClick={seedHostStagePreviewParticipants}
                className="px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.02]"
                style={{ background: '#FFFFFF', color: '#0F1B3D' }}
              >
                Fill live answers
              </button>
              <button
                type="button"
                onClick={revealHostStagePreviewAnswers}
                className="px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.02]"
                style={{ background: '#16A34A', color: '#FFFFFF' }}
              >
                Reveal sample answer
              </button>
              <button
                type="button"
                onClick={showHostStagePreviewStandings}
                className="px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.02]"
                style={{ background: '#F5E642', color: '#0F1B3D' }}
              >
                Show moving standings
              </button>
            </div>
          )}

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
          <div
            className={`max-w-7xl mx-auto w-full rounded-[28px] shadow-2xl border ${currentQuestion.type === 'wordcloud' ? 'p-4 md:p-5 host-question-card-compact' : 'p-5 md:p-7'} ${currentQuestion.type === 'case' ? 'border-blue-300' : 'border-white/20'}`}
            style={{
              background: 'rgba(255,255,255,0.96)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            }}
          >
            <p
              className="font-bold leading-snug break-words"
              style={{
                color: '#0F1B3D',
                // Capped font sizes so a long question + image + 4 options
                // still fit on a 1080p projector without scrolling. Prior
                // upper bound was 3.25rem which alone ate ~80px.
                fontSize: (() => {
                  const len = currentQuestion.text.length
                  if (currentQuestion.type === 'wordcloud') {
                    if (len > 150) return '1.45rem'
                    if (len > 90) return '1.8rem'
                    return '2.15rem'
                  }
                  if (len > 240) return '1.55rem'
                  if (len > 180) return '1.85rem'
                  if (len > 120) return '2.15rem'
                  if (len > 70) return '2.55rem'
                  return '3rem'
                })(),
                lineHeight: 1.1,
                fontFamily: 'var(--font-heading)',
              }}
            >
              {currentQuestion.text}
            </p>
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt={`Image for question ${questionIndex + 1}`} className="mt-3 rounded-xl w-full object-contain" style={{ maxHeight: 'min(22vh, 240px)' }} loading="lazy" />
            )}
          </div>

          {/* Ranking: show correct order (if scored) and consensus ranking */}
          {currentQuestion.type === 'ranking' ? (
            (() => {
              const isSequenceRanking = currentQuestion.correctOrder && currentQuestion.correctOrder.length > 0
              const numOpts = currentQuestion.options?.length ?? 0
              const sums = Array(numOpts).fill(0)
              const counts = Array(numOpts).fill(0)
              const getRankingOptionId = (opt: NonNullable<typeof currentQuestion.options>[number]) => {
                if (typeof opt === 'string') return opt
                const maybeWithId = opt as unknown as Record<string, unknown>
                return typeof maybeWithId.id === 'string' ? maybeWithId.id : opt.text
              }
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
                <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 space-y-3 host-answer-stage host-ranking-stage">
                  {/* Correct order panel (for sequence ranking) */}
                  {isSequenceRanking && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Correct order</p>
                      {(currentQuestion.correctOrder ?? []).map((optIdx, pos) => {
                        const opt = typeof optIdx === 'number' ? currentQuestion.options?.[optIdx] : currentQuestion.options?.find((o) => getRankingOptionId(o) === optIdx)
                        return (
                          <div key={`${optIdx}-${pos}`} className="host-ranking-row flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black bg-green-500 text-white flex-shrink-0">
                              {pos + 1}
                            </span>
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${typeof optIdx === 'number' && optIdx >= 0 && optIdx < OPTION_COLORS.length ? OPTION_COLORS[optIdx] : 'bg-gray-400'}`}>
                              {typeof optIdx === 'number' ? (OPTION_LABELS[optIdx] ?? String(optIdx + 1)) : String(optIdx)}
                            </span>
                            <span className="flex-1 text-base text-gray-800 font-medium">{opt ? getOptionText(opt) : `Option ${typeof optIdx === 'number' ? optIdx + 1 : optIdx}`}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Consensus ranking */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                      {isSequenceRanking ? 'Consensus ranking' : 'Rankings'} · {rankingSubmissions.length} submission{rankingSubmissions.length !== 1 ? 's' : ''}
                    </p>
                    {rows.map((row, pos) => (
                      <div key={row.i} className="host-ranking-row flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
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
                </div>
              )
            })()
          ) : currentQuestion.type === 'wordcloud' ? (
            (() => {
              // Industry-standard wordcloud: square-root perceptual scaling so
              // the most-mentioned word reads as visually dominant without a
              // 10×-mention word being literally 10× larger (which looks
              // broken). Clean horizontal flow, no rotation, brand-aligned
              // colors instead of a clown-suit rainbow.
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
              // sqrt scaling: count=1 → 35% of range, count=max → 100% of range.
              // This matches how humans perceive area/scale differences.
              const MIN_PX = 28
              const MAX_PX = 118
              return (
                <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 bg-white rounded-2xl border border-gray-200 p-5 md:p-7 relative overflow-hidden host-answer-stage host-wordcloud-stage">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Word cloud · {wordcloudWords.length} word{wordcloudWords.length !== 1 ? 's' : ''} from {freq.size} unique
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-gray-400 italic text-center py-12">Waiting for responses…</p>
                  ) : (
                    <div className="host-wordcloud-words flex flex-wrap items-center justify-center gap-x-5 gap-y-3 py-6">
                      {entries.map((entry, i) => {
                        const ratio = Math.sqrt(entry.count / maxCount)
                        const fontSize = Math.round(MIN_PX + ratio * (MAX_PX - MIN_PX))
                        // Top-3 most-mentioned words get deep navy + yellow
                        // accent underline; the long tail goes to warm grey.
                        const isTop = i < 3
                        const color = isTop ? '#0F1B3D' : '#475569'
                        return (
                          <span
                            key={entry.display + i}
                            className="inline-block font-black"
                            style={{
                              fontSize,
                              color,
                              fontFamily: 'var(--font-heading)',
                              lineHeight: 1.05,
                              padding: '2px 6px',
                              borderBottom: isTop ? '4px solid #F5E642' : 'none',
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
                <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 bg-white rounded-2xl border border-gray-200 p-6 space-y-5 host-answer-stage">
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
          ) : currentQuestion.type === 'qa' || currentQuestion.type === 'openended' ? (
            // Raw participant text is intentionally hidden from the projected
            // host view — matches Kahoot/Slido/Mentimeter, protects privacy in
            // mixed rooms, keeps the screen calm. Host reviews individual
            // answers post-session in the SessionReport.
            (() => {
              const count = currentQuestion.type === 'qa' ? qaEntries.length : openendedEntries.length
              return (
                <div className="max-w-3xl mx-auto w-full flex-1 min-h-0 bg-white rounded-2xl border border-gray-200 p-8 md:p-10 host-answer-stage host-text-stage flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-400 mb-4">
                    Answers Collected
                  </p>
                  <div className="text-[6rem] md:text-[8rem] leading-none font-black tabular-nums" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                    {count}
                  </div>
                  <p className="mt-3 text-base md:text-lg font-semibold text-gray-500">
                    {connectedCount > 0
                      ? `of ${connectedCount} participant${connectedCount === 1 ? '' : 's'} responded`
                      : 'Waiting for responses…'}
                  </p>
                  {connectedCount > 0 && (
                    <div className="mt-6 w-full max-w-md h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (count / connectedCount) * 100)}%`,
                          background: 'linear-gradient(90deg, #F5E642 0%, #22C55E 100%)',
                        }}
                      />
                    </div>
                  )}
                  <p className="mt-5 text-xs font-medium text-gray-400 max-w-md">
                    Individual responses stay private here — review them in the post-session report.
                  </p>
                </div>
              )
            })()
          ) : (
          <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 grid grid-cols-2 gap-3 md:gap-5 host-answer-stage host-options-stage">
            {getEffectiveOptions(currentQuestion)?.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = connectedCount > 0 ? (votes / connectedCount) * 100 : 0
              const isCorrect = String(i) === currentQuestion.correctAnswer
              // Green ring only for scored types AND only after host reveals the answer.
              // This prevents leaking the correct answer on projector screens.
              const highlightCorrect = isScoredType(currentQuestion.type) && isCorrect && correctRevealed
              const optText = getOptionText(opt)
              const optImage = getOptionImage(opt)
              return (
                <div
                  key={i}
                  className={`rounded-2xl overflow-hidden border-2 transition-all ${highlightCorrect ? 'ring-4 ring-green-300 border-green-200' : 'border-white/15'}`}
                  style={{
                    background: highlightCorrect
                      ? '#DCFCE7'
                      : 'rgba(255,255,255,0.96)',
                    boxShadow: highlightCorrect
                      ? '0 18px 50px rgba(34,197,94,0.3)'
                      : '0 12px 34px rgba(0,0,0,0.22)',
                  }}
                >
                  {optImage && (
                    <img src={optImage} alt="" className="w-full object-cover" style={{ height: 'min(14vh, 128px)' }} loading="lazy" />
                  )}
                  <div className="min-h-[112px] p-4 md:p-5 flex items-center gap-4">
                    <span className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-white flex-shrink-0 ${OPTION_COLORS[i]}`} style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.16)' }}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-xl md:text-3xl flex-1 min-w-0 break-words text-gray-900 font-black leading-tight">{optText}</span>
                    {correctRevealed && <span className="text-xl font-black tabular-nums text-gray-500">{votes}</span>}
                    {highlightCorrect && <span className="text-green-600 text-2xl font-black">✓</span>}
                  </div>
                  <div className={`h-3 ${highlightCorrect ? 'bg-[#BBF7D0]' : 'bg-gray-100'}`}>
                    <div
                      className={`h-full transition-all duration-500 ${highlightCorrect ? 'bg-green-500' : OPTION_COLORS[i]}`}
                      style={{ width: highlightCorrect ? '100%' : correctRevealed ? `${pct}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {isScoredType(currentQuestion.type) && questionEnded && correctRevealed && (
            <div
              className="max-w-7xl mx-auto rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Answer Reveal
                </p>
                <p className="mt-1 text-2xl md:text-3xl font-black" style={{ color: '#FFFFFF', fontFamily: 'var(--font-heading)' }}>
                  {connectedCount > 0
                    ? `${Math.round(((optionCounts[Number(currentQuestion.correctAnswer)] ?? 0) / connectedCount) * 100)}% got it right`
                    : 'Waiting for answers'}
                </p>
              </div>
              {explanation && (
                <p className="md:max-w-2xl text-base md:text-lg leading-snug font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  {explanation}
                </p>
              )}
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

          {/* Non-scored final reveal — Mentimeter-style result screen after
              the timer ends. Bars (poll), word cloud (wordcloud), text list
              (openended/qa), histogram (rating), ordered list (ranking), or
              thumbnail grid (drawing). Driven by the `question_reveal` socket
              event from server.mjs:emitQuestionEnded. Empty-state handled
              inside QuestionResultsView. */}
          {/* Wordcloud has its own live panel above that already updates in
              real time and stays as the final view once questionEnded — a
              second "Final Results" QuestionResultsView would duplicate it
              with different sizing/font, so exclude that type here. */}
          {!isScoredType(currentQuestion.type) && currentQuestion.type !== 'wordcloud' && questionEnded && liveStat && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Final Results
                {typeof liveStat.totalResponses === 'number' && (
                  <span className="ml-2 font-normal text-gray-500">· {liveStat.totalResponses} response{liveStat.totalResponses === 1 ? '' : 's'}</span>
                )}
              </p>
              <QuestionResultsView
                questionType={currentQuestion.type}
                stat={liveStat}
                mode="final"
              />
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

          <div className="mt-auto w-full">
            <div
              className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl px-4 py-3"
              style={{
                background: 'rgba(15,27,61,0.78)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 18px 60px rgba(0,0,0,0.34)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMusicOn(m => !m)}
                  title={musicOn ? 'Background music is playing — click to mute' : 'Play low-volume background music during the quiz'}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0"
                  style={{
                    background: musicOn ? '#FEF3C7' : 'rgba(255,255,255,0.1)',
                    color: musicOn ? '#B45309' : '#FFFFFF',
                    border: `1.5px solid ${musicOn ? '#FCD34D' : 'rgba(255,255,255,0.16)'}`,
                  }}>
                  {musicOn ? 'Music On' : 'Music Off'}
                </button>
                <span className="hidden md:inline-flex items-center rounded-full px-3 py-2 text-xs font-black tracking-wide" style={{ color: '#0F1B3D', background: '#F5E642' }}>
                  Quizotic
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
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
              const action = getPostQuestionAction({
                sessionMode,
                isScored: scoredQ,
                questionEnded,
                correctRevealed,
                isLastQuestion: isLast,
                answered,
                connectedCount,
              })
              if (!questionEnded && action === 'waiting') {
                // Live question — primary action is intentionally muted to
                // prevent accidental skips. Two-tap confirmation: first tap
                // arms, second tap fires.
                const armed = endNowArmed
                return (
                  <button
                    onClick={() => {
                      if (!armed) {
                        setEndNowArmed(true)
                        if (endNowArmTimerRef.current) clearTimeout(endNowArmTimerRef.current)
                        endNowArmTimerRef.current = setTimeout(() => setEndNowArmed(false), 2500)
                        return
                      }
                      if (endNowArmTimerRef.current) clearTimeout(endNowArmTimerRef.current)
                      setEndNowArmed(false)
                      void endCurrentQuestion().then(ok => {
                        if (!ok) return
                        setQuestionEnded(true)
                        stopLiveQuestionTimer()
                      })
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border-2 transition-all"
                    style={{
                      borderColor: armed ? '#DC2626' : '#9CA3AF',
                      color: armed ? '#FFFFFF' : '#6B7280',
                      background: armed ? '#DC2626' : 'transparent',
                    }}
                  >
                    {armed ? 'Tap again to confirm' : 'End Now'}
                  </button>
                )
              }
              const label = action === 'reveal'
                ? 'Reveal Answer'
                : action === 'standings'
                  ? (standingsRecommended ? 'View Standings (recommended)' : 'View Standings')
                  : action === 'end'
                    ? 'End Quiz'
                    : 'Next Question'
              const onClick = action === 'reveal'
                ? () => { void revealCurrentAnswer() }
                : action === 'standings'
                  ? advanceFromQuestion
                  : questionEnded
                    ? nextQuestion
                    : () => { void advanceAfterEndingCurrentQuestion() }
              return (
                <button
                  onClick={onClick}
                  className="inline-flex items-center gap-2 px-6 py-2.5 font-black text-sm rounded-full transition-colors shadow-md animate-pulse"
                  style={{
                    background: action === 'reveal' ? '#16A34A' : action === 'standings' && standingsRecommended ? '#F5E642' : '#FBBF24',
                    color: action === 'reveal' ? '#FFFFFF' : '#0F1B3D',
                  }}
                >
                  {label}
                  <span aria-hidden>→</span>
                </button>
              )
              })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* STANDINGS — dedicated between-questions screen for competitive quizzes */}
      {phase === 'standings' && quiz && currentQuestion && (
        <motion.div
          initial={reduceStageMotion ? false : { opacity: 0, y: 20, scale: 0.99 }}
          animate={reduceStageMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
          className="min-h-screen px-4 py-6 lg:px-8 space-y-6"
          style={{
            background:
              'radial-gradient(circle at 20% 10%, rgba(245,230,66,0.18), transparent 26%), radial-gradient(circle at 80% 18%, rgba(34,197,94,0.16), transparent 28%), linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
          }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>
              After Question {questionIndex + 1} of {quiz.questions.length}
            </p>
            <h2 className="text-4xl md:text-6xl font-black mt-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              Places Are Moving
            </h2>
          </div>

          {intermediateLeaderboard.length > 0 && (
            <div className="rounded-[28px]" style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '22px 18px', minHeight: 500, boxShadow: '0 24px 80px rgba(15,27,61,0.12)' }}>
              <LeaderboardView
                variant="fullscreen"
                topN={10}
                heading="Leaderboard"
                rows={buildLeaderboardStageRows(
                  // displayedLeaderboard is seeded with prior standings for
                  // ~900ms then swapped to current → triggers framer-motion
                  // layout animation on the row tiles.
                  displayedLeaderboard.length > 0 ? displayedLeaderboard : intermediateLeaderboard,
                  previousIntermediateLeaderboard,
                  10,
                )}
              />
            </div>
          )}

          {/* Top Movers — recognises the bottom 80% of the room when somebody
              jumps several places, even if they're still mid-pack. */}
          {topMovers.length > 0 && (
            <div className="rounded-[28px] p-5" style={{ background: '#0F1B3D', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 60px rgba(15,27,61,0.22)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Top Movers This Round
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topMovers.map(m => (
                  <div key={m.name} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-lg font-black" style={{ background: '#DCFCE7', color: '#15803D' }}>
                      ↑{m.delta}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-black truncate" style={{ color: '#FFFFFF' }}>{m.name}</p>
                      <p className="text-sm font-bold" style={{ color: '#F5E642' }}>#{m.fromRank} → #{m.toRank}</p>
                    </div>
                  </div>
                ))}
              </div>
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

          <div className="flex justify-center items-center gap-2 pt-2">
            {isHostStagePreview && (
              <button
                onClick={() => {
                  setPhase('question')
                  setQuestionEnded(true)
                  setCorrectRevealed(true)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full font-bold text-sm border-2 transition-all"
                style={{ borderColor: '#CBD5E1', color: '#475569', background: '#FFFFFF' }}
              >
                Back to reveal
              </button>
            )}
            {standingsAutoMs !== null && standingsAutoMs > 0 && (
              <button
                onClick={() => setStandingsAutoMs(null)}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full font-bold text-sm border-2 transition-all"
                style={{ borderColor: '#9CA3AF', color: '#6B7280', background: 'transparent' }}
                title="Cancel auto-advance"
              >
                Hold
              </button>
            )}
            <button
              onClick={() => { setStandingsAutoMs(null); nextQuestion() }}
              className="inline-flex items-center gap-2 px-7 py-3 bg-amber-400 text-black font-black text-base rounded-full hover:bg-amber-300 transition-colors shadow-md relative overflow-hidden"
            >
              {standingsAutoMs !== null && standingsAutoMs > 0 && (
                <span
                  aria-hidden
                  className="absolute left-0 bottom-0 h-1"
                  style={{
                    background: '#0F1B3D',
                    width: `${100 * (standingsAutoMs / STANDINGS_AUTO_TOTAL_MS)}%`,
                    transition: 'width 100ms linear',
                  }}
                />
              )}
              {questionIndex + 1 >= quiz.questions.length ? 'End Quiz' : 'Next Question'}
              <span aria-hidden>→</span>
            </button>
          </div>
          </div>
        </motion.div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <>
        <PostSessionHeader
          title={quiz?.title}
          subtitle={leaderboard.length > 0 ? `${leaderboard.length} participant${leaderboard.length === 1 ? '' : 's'} · Session complete` : 'Session complete'}
          onBack={goBackToLibrary}
          dimmed={false}
        />
        {sessionMode === 'competitive' && leaderboard.length > 0 ? (
          // Viewport-locked hero — fits any projector (720p/768p/1080p) so the
          // podium + winner is always fully visible on the projected screen
          // with no scrolling. Post-game details (team standings, report,
          // share, follow-ups) live in a separate scrollable region below.
          <motion.section
            initial={reduceStageMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceStageMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
            className="relative overflow-hidden flex flex-col items-center justify-center px-4 md:px-8 py-4 md:py-6"
            style={{
              height: 'calc(100vh - 56px)',
              background:
                'radial-gradient(circle at 50% 8%, rgba(245,230,66,0.24), transparent 24%), radial-gradient(circle at 8% 72%, rgba(34,211,238,0.18), transparent 24%), linear-gradient(145deg, #071126 0%, #0F1B3D 58%, #111827 100%)',
              boxShadow: '0 30px 90px rgba(15,27,61,0.28)',
            }}
          >
            <CelebrationConfetti active layer="absolute" />
            <div className="relative z-10 text-center">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.24em]" style={{ color: 'rgba(245,230,66,0.72)' }}>
                Final Standings
              </p>
              <h2 className="mt-1 text-3xl md:text-5xl font-black" style={{ color: '#FFFFFF', fontFamily: 'var(--font-heading)', letterSpacing: 0 }}>
                Session Complete
              </h2>
              <p className="mt-1 text-sm md:text-base font-semibold" style={{ color: 'rgba(255,255,255,0.68)' }}>
                {leaderboard.length} participant{leaderboard.length === 1 ? '' : 's'} finished
              </p>
            </div>

            <div className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center mt-3">
              <div className="w-full max-w-5xl rounded-[28px] p-3 md:p-5" style={{ background: 'rgba(255,255,255,0.96)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
                <Podium
                  leaderboard={leaderboard}
                  sessionMode={sessionMode}
                  loopConfetti={false}
                  showRest={false}
                  variant="finale"
                />
              </div>
            </div>
          </motion.section>
        ) : null}

        <motion.div
          initial={reduceStageMotion ? false : { opacity: 0, y: 18 }}
          animate={reduceStageMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
          className="px-4 max-w-7xl mx-auto py-8 space-y-8"
        >
          {!(sessionMode === 'competitive' && leaderboard.length > 0) && (
            <h2 className="text-4xl font-black max-w-3xl mx-auto" style={{ color: '#0F1B3D' }}>Session Complete</h2>
          )}

          {/* Team Leaderboard */}
          {teamLeaderboard && teamLeaderboard.length > 0 && (
            <div className="space-y-3 max-w-3xl mx-auto">
              <h3 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Team Standings</h3>
              {teamLeaderboard.map((team, i) => (
                <div key={team.name} className="flex items-center gap-3 rounded-xl p-4 bg-white border border-gray-200">
                  <span className="text-2xl font-black w-8 text-center" style={{ color: team.color }}>
                    {i + 1}
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

          {/* Session Report */}
          <div className="max-w-3xl mx-auto">
            <SessionReport
              questionStats={questionStats}
              quizTitle={quiz?.title}
              participantCount={leaderboard.length}
              sessionDate={new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              attendees={attendees}
            />
          </div>

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
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
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

          {/* Action buttons — tight max-w-md block, hierarchical:
              Play Again (primary pill) → Export pills (small) → Back link (ghost). */}
          <div className="max-w-md mx-auto mt-2 space-y-4 text-center">
            {/* Primary CTA */}
            <button
              onClick={() => {
                if (quiz) {
                  setActiveSession(quiz)
                  setPhase('idle')
                  setLeaderboard([])
                  setIntermediateLeaderboard([])
                  setPreviousIntermediateLeaderboard([])
                  setDisplayedLeaderboard([])
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
              className="w-full font-bold rounded-xl py-3 text-base transition-all hover:scale-[1.02]"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              Play Again
            </button>

            {/* Export pills — compact row */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500">Export:</span>
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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:border-gray-400 transition-all text-gray-700 bg-white"
              >
                CSV
              </button>
              {plan === 'pro' && gameCode && (
                <>
                  <a
                    href={`/api/sessions/${gameCode}/export/xlsx`}
                    download
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:border-gray-400 transition-all text-gray-700 bg-white"
                  >
                    XLSX
                  </a>
                  <a
                    href={`/api/sessions/${gameCode}/export/pdf`}
                    download
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:border-gray-400 transition-all text-gray-700 bg-white"
                  >
                    PDF
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Tertiary action — quiet ghost link at the very bottom */}
          <div className="flex justify-center pt-2">
            <button
              onClick={goBackToLibrary}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 underline-offset-4 hover:underline transition-colors"
            >
              ← Back to Library
            </button>
          </div>
        </motion.div>
        </>
      )}

      {/* Floating ⋯ menu in top-right corner. Only visible mid-session
          (question or standings) so the host can end the quiz early without
          having to find a button buried in the bottom action bar (which is
          a high-touch zone and would risk accidental taps). */}
      {(phase === 'question' || phase === 'standings') && (
        <div className="fixed top-3 right-3 z-40">
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={showOverflowMenu}
            onClick={() => setShowOverflowMenu(v => !v)}
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-transform hover:scale-105"
            style={{
              background: 'rgba(15,27,61,0.85)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {showOverflowMenu && (
            <>
              {/* Click-away backdrop */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowOverflowMenu(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-[180px] rounded-xl overflow-hidden z-40"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,27,61,0.12)',
                  boxShadow: '0 12px 28px rgba(15,27,61,0.18)',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowOverflowMenu(false); setShowEndQuizConfirm(true) }}
                  className="w-full text-left px-4 py-3 font-bold text-sm flex items-center gap-2 transition-colors"
                  style={{ color: '#DC2626', background: '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  End Quiz
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <EndQuizConfirmModal
        open={showEndQuizConfirm}
        onClose={() => setShowEndQuizConfirm(false)}
        questionsRemaining={quiz ? Math.max(0, quiz.questions.length - questionIndex - 1) : 0}
        onConfirm={() => {
          if (!socketRef.current?.connected || !gameCode) return
          socketRef.current.emit('end_session', { gameCode })
        }}
      />

    </div>
  )
}
