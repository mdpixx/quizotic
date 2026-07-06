'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import { motion, useReducedMotion } from 'framer-motion'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { PostSessionHeader } from '@/components/PostSessionHeader'
import { LottieConfetti } from '@/components/LottieConfetti'
import { CelebrationConfetti } from '@/components/CelebrationConfetti'
import { SessionReport } from '@/components/SessionReport'
import { LeaderboardView } from '@/components/LeaderboardView'
import { useFeedback } from '@/components/FeedbackProvider'
import { playLeaderboardJingle, playTick, playBackgroundMusic, stopBackgroundMusic, playBassBoom, playCelebration, playFirecracker, preloadCelebrationSounds, playDrumroll, stopDrumroll, isMuted, toggleMuted } from '@/lib/sounds'
import { getActiveSession, setActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz, QuestionStat, SessionMode } from '@/lib/quiz-types'
import { ReflectionInsights } from '@/components/ReflectionInsights'
import { getOptionText, getOptionImage, isScoredQuestion, getEffectiveOptions } from '@/lib/quiz-types'
import { ANSWER_COLORS, ANSWER_LETTERS } from '@/lib/answer-colors'
import { QuestionResultsView } from '@/components/results/QuestionResultsView'
import { QaModerationPanel, type QaModerationState, type QaStatus } from '@/components/host/QaModerationPanel'
import { CircularTimer } from '@/components/CircularTimer'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { BrandWatermark } from '@/components/BrandWatermark'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { JoinPill } from '@/components/host/JoinPill'
import { PhoneRemoteButton } from '@/components/host/PhoneRemoteButton'
import { NavChevron } from '@/components/ui/NavButton'
import { EndQuizConfirmModal } from '@/components/host/EndQuizConfirmModal'
import { HostWordCloud } from '@/components/host/HostWordCloud'
import { LiveRosterPanel } from '@/components/host/LiveRosterPanel'
import { QuestionNavigator } from '@/components/host/QuestionNavigator'
import { HostStatsRail, type OptionStat as StatsOptionStat } from '@/components/host/HostStatsRail'
import { ImmersiveStatsOverlay, type ImmersiveOptionStat } from '@/components/host/ImmersiveStatsOverlay'
import { getQuizTheme } from '@/lib/quiz-themes'
import { buildLeaderboardStageRows, getHostQuestionFit, getPostQuestionAction } from '@/lib/host-stage'
import { useConfetti } from '@/hooks/useConfetti'
import { startClockSync, getServerNow, resyncClock } from '@/lib/clock-sync'
import { track } from '@/lib/analytics'

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

// Canonical answer-tile palette — single source of truth in answer-colors.ts.
// These 4–5 colours stay constant across quiz AND presentation sequences so
// participants can colour-match their phone to the host screen; only the
// surrounding chrome is themed per sequence (see sequence-theme.ts).
const OPTION_COLORS = ANSWER_COLORS.map(c => c.tw)
const OPTION_LABELS = ANSWER_LETTERS

// P3.1 — Share / LMS links for lobby.
// `variant="compact"` renders small brand-aligned pills for the pinned lobby
// action bar; `card` keeps the original white card (retained for reuse).
function ShareLinks({
  gameCode,
  quizTitle,
  variant = 'card',
}: {
  gameCode: string
  quizTitle: string
  variant?: 'card' | 'compact'
}) {
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

  if (variant === 'compact') {
    const pill = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all hover:scale-[1.04]'
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copyLink} className={`${pill} bg-white/10 border-white/25 text-white`} aria-label="Copy join link">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a href={classroomUrl} target="_blank" rel="noopener noreferrer" className={`${pill} bg-white/10 border-white/25 text-white`}>
          Classroom
        </a>
        <a href={`https://wa.me/?text=${moodleMsg}`} target="_blank" rel="noopener noreferrer" className={`${pill} bg-emerald-400/15 border-emerald-300/40 text-emerald-100`}>
          WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(`Join "${quizTitle}" on Quizotic`)}&body=${moodleMsg}`} className={`${pill} bg-amber-400/15 border-amber-300/45 text-amber-100`}>
          Email
        </a>
      </div>
    )
  }

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
        // Layout stress fixture — long question + four long answers. Catches
        // projector/option clipping regressions in ?preview=host-stage.
        id: 'q-stress',
        type: 'mcq',
        text: 'Which regulatory body oversees the Indian securities and stock market and protects investor interests across exchanges?',
        options: [
          'Securities and Exchange Board of India (SEBI), the statutory regulator for securities',
          'Reserve Bank of India (RBI)',
          'Ministry of Finance, Government of India',
          'Planning Commission of India and NITI Aayog jointly oversee market regulation',
        ],
        correctAnswer: '0',
        timerSeconds: 30,
        points: 1000,
        explanation: 'SEBI is the statutory regulator of the Indian securities market.',
        bloomsLevel: 'remember',
      },
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


// Layer 3.3 — host re-attach. Code + token survive a tab reload but are scoped
// to this browser tab (sessionStorage). Server issues the token at
// create_session and validates it on host_resume to rebind hostSocketId
// without losing the live game. Stored together so a reload can rediscover
// which session to reclaim.
const HOST_RESUME_KEY = 'quizotic_host_resume'
function saveHostResume(gameCode: string, token: string): void {
  if (typeof window === 'undefined' || !gameCode || !token) return
  try { window.sessionStorage.setItem(HOST_RESUME_KEY, JSON.stringify({ gameCode, token })) }
  catch { /* noop */ }
}
function loadHostResume(): { gameCode: string; token: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(HOST_RESUME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { gameCode?: unknown; token?: unknown }
    if (typeof parsed.gameCode === 'string' && parsed.gameCode && typeof parsed.token === 'string' && parsed.token) {
      return { gameCode: parsed.gameCode, token: parsed.token }
    }
    return null
  } catch { return null }
}
function clearHostResume(): void {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(HOST_RESUME_KEY) }
  catch { /* noop */ }
}

export default function SessionPage() {
  const router = useRouter()
  const reduceStageMotion = useReducedMotion()
  const isHostStagePreview = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.search.includes('preview=host-stage')

  // Preview/dev-only test hook: exposes the real bundled confetti factory so a
  // real-browser Playwright test can fire a burst and assert the dedicated
  // canvas renders pixels — without polluting prod (localhost + preview only).
  const fireConfettiForTest = useConfetti()
  useEffect(() => {
    if (!isHostStagePreview) return
    ;(window as unknown as { __quizoticFireConfetti?: (preset?: string) => void }).__quizoticFireConfetti =
      (preset) => fireConfettiForTest((preset as 'winner' | 'mini' | 'milestone' | 'ambient') ?? 'winner')
    return () => {
      delete (window as unknown as { __quizoticFireConfetti?: (preset?: string) => void }).__quizoticFireConfetti
    }
  }, [isHostStagePreview, fireConfettiForTest])
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
  // True while a reload-recovery is in flight: refs were seeded from
  // sessionStorage but the UI hasn't been rebuilt from host_resume yet.
  const resumeRestorePendingRef = useRef(false)

  const [phase, setPhase] = useState<Phase>(initialQuiz ? 'idle' : 'loading')
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz)
  const quizRef = useRef<Quiz | null>(null)
  const questionIndexRef = useRef<number>(0)
  const [gameCode, setGameCode] = useState('')
  // key = participantId (preferred) or `name:<displayName>` for legacy events.
  // Storing connection state here lets us render a single list with offline
  // dimming during the disconnect grace period instead of removing entries.
  const [participants, setParticipants] = useState<Map<string, { name: string; archetype: string; team?: { index: number; name: string; color: string } | null; connected: boolean }>>(new Map())
  // Map keys (pid:… / name:…) of participants who answered the CURRENT
  // question — drives the live roster panel's submitted ticks.
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())
  // Question indexes already presented this session — the navigator renders
  // them dimmed. After a host reload this is approximated as 0..current (a
  // question jumped over before the reload will wrongly show as played; the
  // server still accepts the jump since it tracks the truth).
  const [playedIndexes, setPlayedIndexes] = useState<Set<number>>(new Set())
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
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
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
  // Mirrors the persisted global mute in lib/sounds — initialised in an
  // effect because localStorage isn't available during SSR render.
  const [soundMuted, setSoundMuted] = useState(false)
  useEffect(() => { setSoundMuted(isMuted()) }, [])
  const [hostTimeLeft, setHostTimeLeft] = useState(0)
  const hostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mirror `paused` into a ref so the long-lived countdown interval can freeze
  // the instant the host pauses — without depending on the server's quiz_paused
  // round-trip actually reaching this tab. This is the real fix for "the timer
  // kept counting down after I paused": the tick reads live pause state.
  const pausedRef = useRef(false)
  useEffect(() => { pausedRef.current = paused }, [paused])
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
  // True while the current slide is a host-placed leaderboard "flow" slide
  // (reuses the 'standings' phase but advances straight to the next slide).
  const [onLeaderboardSlide, setOnLeaderboardSlide] = useState(false)
  // Pop-up leaderboard overlay — opened via the trophy button or 'L' key so the
  // host can peek at standings any time without advancing the slide.
  const [showLeaderboardPopup, setShowLeaderboardPopup] = useState(false)
  const { openFeedback } = useFeedback()
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [endNowArmed, setEndNowArmed] = useState(false)
  const endNowArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Full-screen immersive stats overlay — host opens it on demand (button in
  // the stats rail, 'S' key) or optionally auto-shows after each reveal.
  const [showImmersiveStats, setShowImmersiveStats] = useState(false)
  // Per-host preference: auto-open the immersive stats screen after each answer
  // reveal. Persisted in localStorage so it survives reloads / new sessions.
  // The toggle lives inside the ImmersiveStatsOverlay footer.
  const [autoStatsAfterReveal, setAutoStatsAfterReveal] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setAutoStatsAfterReveal(localStorage.getItem('quizotic_host_autoStats') === 'true')
  }, [])
  const toggleAutoStatsAfterReveal = useCallback(() => {
    setAutoStatsAfterReveal(prev => {
      const next = !prev
      try { localStorage.setItem('quizotic_host_autoStats', String(next)) } catch { /* noop */ }
      return next
    })
  }, [])
  // Soft auto-advance on standings — null means disabled / cancelled.
  // Number is the remaining ms before nextQuestion() fires automatically.
  const [standingsAutoMs, setStandingsAutoMs] = useState<number | null>(null)

  useEffect(() => {
    // Reset scroll on phase change so the projector view starts at the top —
    // but ONLY when the page is actually scrolled, and with instant behavior.
    // Previously this fired unconditionally on every phase entry (including
    // 'ended'), which combined with the podium's staggered reveal produced a
    // visible position shift the moment the podium mounted.
    if ((phase === 'question' || phase === 'standings' || phase === 'ended') && window.scrollY > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    }
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
  // Server-computed correct count for the reveal donut — exact across all
  // scored types (optionCounts only covers mcq/truefalse).
  const [revealCorrectCount, setRevealCorrectCount] = useState<number | null>(null)
  // P3.4 — Drawing question gallery
  const [drawings, setDrawings] = useState<Array<{ name: string; archetype: string; dataUrl: string }>>([])
  // Host-side aggregates for text-based / rating / Q&A types. Reset on every
  // new question via question_show. Populated by text_submission events.
  const [wordcloudWords, setWordcloudWords] = useState<string[]>([])
  const [qaEntries, setQaEntries] = useState<Array<{ name: string; archetype: string; text: string; at: number }>>([])
  // Host-side Q&A moderation: status + curated upvotes keyed by `${at}-${name}`.
  const [qaModeration, setQaModeration] = useState<Record<string, QaModerationState>>({})
  const [qaPanelOpen, setQaPanelOpen] = useState(false)
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
  // Progress counts exclude leaderboard flow slides so "Question X of N" reflects
  // answerable questions only (the raw index still addresses the server array).
  const answerableTotal = quiz ? quiz.questions.filter(q => q.type !== 'leaderboard').length : 0
  const answerableNumber = quiz ? quiz.questions.slice(0, questionIndex + 1).filter(q => q.type !== 'leaderboard').length : 0
  const isAnswerRevealStage = Boolean(
    currentQuestion && isScoredQuestion(currentQuestion) && questionEnded && correctRevealed,
  )
  // Fit is computed from LIVE-stage pressure ONLY and held constant across the
  // reveal. Previously this flipped `stage` to 'reveal' on answer-reveal, which
  // re-sized the question text (font-size + card height) the instant the host
  // revealed — a visible stutter. Now the card keeps its pre-reveal footprint;
  // the reveal donut/bars live in the left rail, so the center never needs to
  // compress to make room.
  // hasExplanation reads the QUIZ data, not the `explanation` state — the state
  // only arrives with question_ended, which used to flip the fit (and the
  // question font size) at the exact moment of the reveal.
  const hostQuestionFit = currentQuestion
    ? getHostQuestionFit({
        stage: 'live',
        questionText: currentQuestion.text,
        optionTexts: (getEffectiveOptions(currentQuestion) ?? []).map(getOptionText),
        hasExplanation: Boolean(currentQuestion.explanation),
      })
    : null

  // Per-option stats payload shared by the left stats rail and the immersive
  // overlay. Built once here so both stay in sync and the question phase's
  // JSX stays readable.
  const statsOptions: StatsOptionStat[] = useMemo(() => {
    if (!currentQuestion) return []
    const opts = getEffectiveOptions(currentQuestion) ?? []
    return opts.map((opt, i) => ({
      letter: OPTION_LABELS[i] ?? String(i + 1),
      text: getOptionText(opt),
      votes: optionCounts[i] ?? 0,
      isCorrect: String(i) === currentQuestion.correctAnswer,
    }))
  }, [currentQuestion, optionCounts])
  const immersiveOptions: ImmersiveOptionStat[] = statsOptions

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

  // Auto-start background music at the FIRST question if the host hasn't
  // muted. Toggling the Music button later still overrides this. Once-only —
  // guarded by a ref so re-renders of the question phase don't re-trigger.
  const musicAutostartedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'question') return
    if (musicAutostartedRef.current) return
    if (musicOn) return // already on (persisted preference)
    musicAutostartedRef.current = true
    if (!isMuted()) setMusicOn(true)
  }, [phase, musicOn])

  // Host sound cues keyed to phase transitions (D). preloading the
  // celebration MP3s before the ended phase avoids audible latency on the
  // winner reveal. The standings jingle plays once on phase entry (the
  // per-update jingle still fires from the leaderboard_update listener).
  useEffect(() => {
    if (phase === 'standings') {
      try { playLeaderboardJingle() } catch {}
    } else if (phase === 'ended') {
      // Stop any lingering countdown drumroll before celebration overlaps.
      try { stopDrumroll() } catch {}
      try { preloadCelebrationSounds() } catch {}
      // Firecracker pop fires once, timed to the confetti launch on this screen.
      try { playFirecracker() } catch {}
      try { playBassBoom() } catch {}
      try { playCelebration() } catch {}
      // Session is over — fade the background loop out.
      stopBackgroundMusic()
    }
  }, [phase])

  // Hydrate session prefs from the host's last setup. Without this, every
  // session resets to the hardcoded defaults and a host who always runs
  // Reflection mode with Teams ON has to re-toggle them every time.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('quizotic_host_session_prefs')
      if (!raw) return
      const p = JSON.parse(raw) as Partial<{
        sessionMode: SessionMode
        anonymousMode: boolean
        teamMode: boolean
        teamCount: number
        displayMode: 'full-device' | 'shared-screen'
        advancedSettingsOpen: boolean
      }>
      if (p.sessionMode === 'competitive' || p.sessionMode === 'accuracy' || p.sessionMode === 'reflection') {
        setSessionMode(p.sessionMode)
      }
      if (typeof p.anonymousMode === 'boolean') setAnonymousMode(p.anonymousMode)
      if (typeof p.teamMode === 'boolean') setTeamMode(p.teamMode)
      if (typeof p.teamCount === 'number' && p.teamCount >= 2 && p.teamCount <= 6) setTeamCount(p.teamCount)
      if (p.displayMode === 'full-device' || p.displayMode === 'shared-screen') setDisplayMode(p.displayMode)
      if (typeof p.advancedSettingsOpen === 'boolean') setAdvancedSettingsOpen(p.advancedSettingsOpen)
    } catch {
      // Corrupted blob; fall back silently to defaults.
    }
  }, [])

  // Persist whenever any session pref changes. One atomic write keeps the
  // localStorage entries tidy and avoids race conditions across the keys.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('quizotic_host_session_prefs', JSON.stringify({
        sessionMode,
        anonymousMode,
        teamMode,
        teamCount,
        displayMode,
        advancedSettingsOpen,
      }))
    } catch {
      // Quota exceeded or storage disabled — non-fatal.
    }
  }, [sessionMode, anonymousMode, teamMode, teamCount, displayMode, advancedSettingsOpen])

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

    // Reload recovery: if this tab hosted a session before a reload, the
    // refs are empty but sessionStorage still has the code + resume token.
    // Seed the refs so the connect handler below reclaims the session, and
    // remember that the UI needs rebuilding from the host_resume callback.
    // The pending flag lives in a ref, not this closure — StrictMode runs
    // this effect twice and the refs persist across the double-invoke.
    if (!gameCodeRef.current) {
      const persisted = loadHostResume()
      if (persisted) {
        gameCodeRef.current = persisted.gameCode
        hostResumeTokenRef.current = persisted.token
        resumeRestorePendingRef.current = true
      }
    }

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
        socket.emit('host_resume', { gameCode: code, token }, (res?: {
          success?: boolean
          error?: string
          type?: string
          status?: string
          currentQuestionIndex?: number
        }) => {
          if (res?.success) {
            console.log('[host_resume] reattached to', code)
            // After a plain socket reconnect the React state is intact and we
            // must not touch it. After a reload it was lost — rebuild the UI
            // from the server's snapshot. Participant list and answer counts
            // refill via the 5s session_state broadcast and live events.
            if (resumeRestorePendingRef.current) {
              resumeRestorePendingRef.current = false
              const restoredQuiz = quizRef.current
              if ((res.type ?? 'quiz') === 'quiz' && restoredQuiz) {
                setGameCode(code)
                if (res.status === 'lobby') {
                  setPhase('lobby')
                } else if (res.status === 'active') {
                  const idx = Math.min(
                    Math.max(res.currentQuestionIndex ?? 0, 0),
                    restoredQuiz.questions.length - 1,
                  )
                  questionIndexRef.current = idx
                  setQuestionIndex(idx)
                  // Timer/answer counts for the in-flight question aren't
                  // recoverable; the host lands on the question controls and
                  // can reveal or advance — both resync everyone.
                  setPhase('question')
                }
              }
            }
          } else if (res?.error) {
            console.warn('[host_resume] failed:', res.error)
            if (resumeRestorePendingRef.current) {
              // Session is gone (ended or expired) — drop the stale handle so
              // the next reload doesn't retry forever.
              resumeRestorePendingRef.current = false
              gameCodeRef.current = ''
              hostResumeTokenRef.current = ''
              clearHostResume()
            }
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
    socket.on('session_state', ({ active, disconnected, questionIndex: snapshotQuestionIndex }: { active: Array<{ participantId: string | null; name: string; archetype: string | null; team: { index: number; name: string; color: string } | null; answeredCurrent?: boolean }>; disconnected: Array<{ participantId: string | null; name: string; archetype: string | null; team: { index: number; name: string; color: string } | null; answeredCurrent?: boolean }>; connectedCount: number; totalCount: number; questionIndex?: number | null }) => {
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
      // Authoritative re-seed of the roster panel's submitted ticks — makes a
      // reloading host converge within one snapshot interval. Union, not
      // replace: within the same question both sources are true positives,
      // and union can't flash-remove a tick that arrived after the snapshot
      // was built. Skip snapshots from another question (in-flight during a
      // transition); question_show clears the set.
      if (snapshotQuestionIndex === questionIndexRef.current) {
        setAnsweredKeys(prev => {
          const next = new Set(prev)
          for (const p of [...(active || []), ...(disconnected || [])]) {
            if (p.answeredCurrent) next.add(keyFor(p.participantId, p.name))
          }
          return next
        })
      }
    })

    socket.on('answer_received', ({ count, optionCounts: counts, participantId }: { count: number; optionCounts?: number[]; participantId?: string | null }) => {
      setAnswered(count)
      if (counts) setOptionCounts(counts)
      if (participantId) {
        setAnsweredKeys(prev => {
          const next = new Set(prev)
          next.add(keyFor(participantId))
          return next
        })
      }
    })

    // question_show fires for host too (host is in session: room).
    // Use it to synchronize the host timer with server's startAt and show 3-2-1 countdown.
    socket.on('question_show', ({ startAt, index }: { startAt?: number; index: number; question: unknown; total: number }) => {
      const effectiveStart = typeof startAt === 'number' ? startAt : Date.now()
      // Leaving the standings screen for the next question.
      setPhase('question')
      setOnLeaderboardSlide(false)
      setEndNowArmed(false)
      // The server is the navigation authority: converge the projector's
      // question index and per-question flags here so local advance, phone
      // remote advance and goto_question all land on one code path. Without
      // this, server-driven navigation left currentQuestion stale.
      questionIndexRef.current = index
      setQuestionIndex(index)
      setExplanation(null)
      setQuestionEnded(false)
      setCorrectRevealed(false)
      setAnswered(0)
      setOptionCounts([])
      setPlayedIndexes(prev => {
        const next = new Set(prev)
        if (next.size === 0) {
          // First question_show after load — seed everything up to here so a
          // reloaded host doesn't render past questions as jumpable.
          for (let i = 0; i <= index; i++) next.add(i)
        } else {
          next.add(index)
        }
        return next
      })
      if (endNowArmTimerRef.current) { clearTimeout(endNowArmTimerRef.current); endNowArmTimerRef.current = null }
      setQuestionStartedAt(effectiveStart)
      setRankingSubmissions([])
      setDrawings([]) // reset drawing gallery for each new question
      setWordcloudWords([])
      setQaEntries([])
      setQaModeration({})
      setQaPanelOpen(false)
      setOpenendedEntries([])
      setRatingValues([])
      setLiveStat(null)
      setRevealCorrectCount(null)
      setAnsweredKeys(new Set())

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
            // Countdown is over — kill the '3' drumroll so it never bleeds
            // into the question timer or a later celebration cue.
            try { stopDrumroll() } catch {}
            startHostTimer(timerSeconds, effectiveStart)
            return
          }
          if (value !== lastShown) {
            lastShown = value
            setCountdownValue(value)
            if (value === 3) {
              // Rising tension on '3'; ticks carry 2 and 1. Stopped above.
              try { playDrumroll() } catch {}
            } else {
              playTick()
            }
          }
        }
        updateCountdown()
        countdownTimerRef.current = setInterval(updateCountdown, 100)
      } else {
        startHostTimer(timerSeconds, effectiveStart)
      }
    })

    // Keep the host display timer honest across pause/resume. Without these,
    // the wall-clock-anchored countdown kept running through a pause and the
    // host screen hit 0 while the server (and participants) still had time.
    socket.on('quiz_paused', () => {
      setPaused(true)
      if (hostTimerRef.current) { clearInterval(hostTimerRef.current); hostTimerRef.current = null }
    })

    socket.on('quiz_resumed', ({ remainingMs }: { remainingMs?: number }) => {
      setPaused(false)
      if (typeof remainingMs !== 'number' || remainingMs <= 0) return
      setHostTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)))
      runHostCountdown(getServerNow() + remainingMs)
    })

    // Host extended or restarted the timer mid-question — same re-anchor
    // contract as quiz_resumed. While paused only the display updates; the
    // countdown restarts on resume.
    socket.on('timer_adjusted', ({ remainingMs, paused: stillPaused }: { remainingMs?: number; action?: 'extend' | 'restart'; paused?: boolean }) => {
      if (typeof remainingMs !== 'number' || remainingMs < 0) return
      setHostTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)))
      if (!stillPaused) runHostCountdown(getServerNow() + remainingMs)
    })

    socket.on('ranking_submission', ({ ranking }: { ranking: number[] }) => {
      if (Array.isArray(ranking)) {
        setRankingSubmissions(prev => [...prev, ranking])
      }
    })

    socket.on('question_ended', ({ explanation: exp, correctCount: cc }: { correctAnswer: string; explanation: string | null; correctCount?: number | null }) => {
      setExplanation(exp)
      setRevealCorrectCount(typeof cc === 'number' ? cc : null)
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

    // Host-placed leaderboard slide reached during play — show standings and
    // wait for the host to advance. Reuses the 'standings' phase.
    socket.on('leaderboard_slide_show', ({ index, top, teamLeaderboard: tlb }: {
      index: number;
      total?: number;
      title?: string | null;
      top: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      totalPlayers?: number;
    }) => {
      setQuestionIndex(index)
      setOnLeaderboardSlide(true)
      setQuestionEnded(true)
      setExplanation(null)
      setTopMovers([])
      setPreviousIntermediateLeaderboard([])
      setIntermediateLeaderboard(top ?? [])
      setDisplayedLeaderboard([])
      if (tlb) setTeamLeaderboard(tlb)
      if (hostTimerRef.current) { clearInterval(hostTimerRef.current); hostTimerRef.current = null }
      setHostTimeLeft(0)
      setPhase('standings')
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
      track('live_session_completed', {
        participants: lb.length,
        questionCount: qs?.length ?? 0,
        durationSec: sessionStartTimeRef.current ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000) : null,
      })
      // Game over — invalidate the host resume handle.
      clearHostResume()
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
      socket.off('leaderboard_slide_show')
      socket.off('question_ended')
      socket.off('session_ended')
      socket.off('leaderboard_update')
      socket.off('drawing_submitted')
      socket.off('live_responses')
      socket.off('question_reveal')
      socket.off('timer_adjusted')
      stopClockSync()
      socket.disconnect()
      // Reset the init guard so the effect re-creates the socket if it runs
      // again (React StrictMode double-invokes effects in dev). In production
      // the effect runs once, so this only fires on unmount.
      socketInitialized.current = false
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
          saveHostResume(res.gameCode, res.hostResumeToken)
        }
        setPhase('lobby')
      } else {
        setSessionError(res.error ?? 'Failed to create session. Please try again.')
      }
    })
  }

  const timerStartRef = useRef<number>(0)
  const timerDurationRef = useRef<number>(0)

  // Foreground recovery: when the host machine sleeps or the tab is
  // backgrounded, intervals throttle and the clock offset can go stale.
  // Resync on visibility — the running 100ms timer picks up the corrected
  // offset on its next tick.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncClock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Pop-up leaderboard shortcut: 'L' toggles, Escape closes. 'S' toggles the
  // full-screen immersive stats overlay. Ignored while the host is typing in an
  // input/textarea so we don't hijack real keystrokes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setShowLeaderboardPopup(s => !s)
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setShowImmersiveStats(s => !s)
      } else if (e.key === 'Escape') {
        setShowLeaderboardPopup(false)
        setShowImmersiveStats(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-show the immersive stats overlay after each answer reveal, when the
  // host has opted in. Fires once per question (guarded by questionEnded +
  // correctRevealed) so re-renders don't re-trigger it.
  useEffect(() => {
    if (!autoStatsAfterReveal) return
    if (phase !== 'question') return
    if (questionEnded && correctRevealed) setShowImmersiveStats(true)
  }, [autoStatsAfterReveal, phase, questionEnded, correctRevealed])

  // End-anchored remaining-time math, the same shape and 100ms cadence as
  // the participant timer in join/page.tsx — the two screens flip digits
  // within one tick of each other. Reused by quiz_resumed, where the
  // remaining window must not go through the [5,120] full-question clamp.
  function runHostCountdown(endAt: number) {
    if (hostTimerRef.current) clearInterval(hostTimerRef.current)
    let lastTickSecond = Math.ceil((endAt - getServerNow()) / 1000) + 1
    hostTimerRef.current = setInterval(() => {
      // Frozen while paused — the interval keeps spinning but the displayed
      // countdown holds. quiz_resumed re-anchors endAt on resume, so the digits
      // continue from where they stopped. Correct even if the interval outlives
      // a dropped quiz_paused event.
      if (pausedRef.current) return
      const remaining = Math.max(0, Math.ceil((endAt - getServerNow()) / 1000))
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
    }, 100)
  }

  function startHostTimer(seconds: number, serverTimestamp?: number) {
    // Belt-and-suspenders clamp matching server-side sanitizeQuestion.
    const safeSeconds = Math.max(5, Math.min(120, Number(seconds) || 20))
    timerDurationRef.current = safeSeconds
    // Anchor on the server timestamp (always). getServerNow() vs server start
    // means we measure elapsed in SERVER time regardless of how the host
    // laptop's clock has drifted — this was the source of the red-zone bug.
    timerStartRef.current = serverTimestamp ?? getServerNow()
    setHostTimeLeft(safeSeconds)
    runHostCountdown(timerStartRef.current + safeSeconds * 1000)
  }

  function startQuiz() {
    if (!socketRef.current?.connected) {
      setSessionError('Connection lost. Please refresh the page.')
      return
    }
    setSessionError('')
    sessionStartTimeRef.current = Date.now()
    track('live_session_started', { questionCount: quiz?.questions.length ?? 0, sessionMode })
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

  // Remove a disruptive participant. Server confirms via the existing
  // participant_left event, which already prunes the roster Map.
  function kickParticipant(key: string) {
    const pid = key.startsWith('pid:') ? key.slice(4) : null
    if (!pid || !socketRef.current?.connected || !gameCode) return
    socketRef.current.emit('kick_participant', { gameCode, participantId: pid }, () => {})
  }

  // Flip anonymous names mid-session; local state follows the server ack so
  // the toggle can't drift from the authoritative session flag.
  function toggleAnonymousMode() {
    if (!socketRef.current?.connected || !gameCode) return
    const next = !anonymousMode
    socketRef.current.emit('set_anonymous_mode', { gameCode, anonymous: next }, (res?: { success?: boolean }) => {
      if (res?.success) setAnonymousMode(next)
    })
  }

  // Question navigator jump — the server ends the live question (if any),
  // presents the target, and the shared question_show handler converges the
  // projector state. Resolves with the server's verdict for popover feedback.
  function gotoQuestion(index: number): Promise<{ success: boolean; reason?: string }> {
    if (!socketRef.current?.connected || !gameCode) return Promise.resolve({ success: false, reason: 'not_active' })
    return new Promise(resolve => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        resolve({ success: false })
      }, 3000)
      socketRef.current?.emit('goto_question', { gameCode, index }, (res?: { success?: boolean; reason?: string }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve({ success: !!res?.success, reason: res?.reason })
      })
    })
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
    const current = quiz?.questions?.[questionIndex]
    const scored = current ? isScoredQuestion(current) : false
    // If the very next slide is a host-placed leaderboard, skip the built-in
    // between-question standings — the leaderboard slide will show them instead
    // (avoids standings appearing twice in a row).
    const nextIsLeaderboard = quiz?.questions?.[questionIndex + 1]?.type === 'leaderboard'
    if (sessionMode === 'competitive' && scored && !nextIsLeaderboard) {
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
      className="min-h-svh"
      style={{ background: quizTheme.background, color: quizTheme.textColor }}
      data-theme={quizTheme.id}
    >
      {!isLiveHostStage && <BrandWatermark placement="host" />}

      {/* IDLE */}
      {phase === 'idle' && quiz && (
        <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
          <button
            onClick={() => {
              clearActiveSession()
              router.push(quiz?.id ? `/host/build?edit=${quiz.id}` : '/host')
            }}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to edit
          </button>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <section className="min-w-0 rounded-3xl border bg-white p-5 shadow-sm md:p-7" style={{ borderColor: '#E2E8F0' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#16A34A' }}>Ready to host</p>
              <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{quiz.title}</h1>
              <p className="mt-3 text-sm md:text-base" style={{ color: '#64748B' }}>
                {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} ready. Start the lobby, share the join code, and begin when participants arrive.
              </p>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Mode</p>
                  <p className="mt-1 text-sm font-black capitalize" style={{ color: '#0F1B3D' }}>{sessionMode}</p>
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Names</p>
                  <p className="mt-1 text-sm font-black" style={{ color: '#0F1B3D' }}>{anonymousMode ? 'Anonymous' : 'Visible'}</p>
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Teams</p>
                  <p className="mt-1 text-sm font-black" style={{ color: '#0F1B3D' }}>{teamMode ? `${teamCount} teams` : 'Off'}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {quiz.questions.slice(0, 4).map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ background: '#EEF2FF', color: '#4F46E5' }}>{i + 1}</span>
                    <p className="min-w-0 truncate text-sm font-semibold" style={{ color: '#334155' }}>{q.text}</p>
                  </div>
                ))}
                {quiz.questions.length > 4 && (
                  <p className="px-1 text-xs font-semibold" style={{ color: '#94A3B8' }}>+ {quiz.questions.length - 4} more question{quiz.questions.length - 4 === 1 ? '' : 's'}</p>
                )}
              </div>

              {sessionError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {sessionError}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={createSession}
                  disabled={!socketConnected || creating}
                  className="flex-1 rounded-2xl py-4 text-lg font-black transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D', fontFamily: 'var(--font-heading)' }}
                >
                  {!socketConnected ? 'Connecting...' : creating ? 'Starting lobby...' : 'Start lobby'}
                </button>
                <button
                  onClick={() => {
                    clearActiveSession()
                    router.push(quiz?.id ? `/host/build?edit=${quiz.id}` : '/host')
                  }}
                  className="rounded-2xl border px-5 py-4 text-sm font-black transition-all hover:bg-gray-50"
                  style={{ borderColor: '#CBD5E1', color: '#334155' }}
                >
                  Back to edit
                </button>
              </div>
            </section>

            <aside className="min-w-0 space-y-3">
              <section className="rounded-3xl border bg-white p-4 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: '#7C3AED' }}>Quick settings</p>
                    <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>Defaults are ready to start.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Mode</p>
                    <div className="grid gap-2">
                      {([
                        { mode: 'competitive' as const, label: 'Competitive', desc: 'Leaderboard + speed' },
                        { mode: 'accuracy' as const, label: 'Accuracy', desc: 'Correctness only' },
                        { mode: 'reflection' as const, label: 'Reflection', desc: 'Calmer review' },
                      ]).map(opt => (
                        <button
                          key={opt.mode}
                          onClick={() => setSessionMode(opt.mode)}
                          className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all"
                          style={{
                            borderColor: sessionMode === opt.mode ? '#7C3AED' : '#E2E8F0',
                            background: sessionMode === opt.mode ? '#F5F3FF' : '#FFFFFF',
                          }}
                        >
                          <span>
                            <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>{opt.label}</span>
                            <span className="block text-xs" style={{ color: '#64748B' }}>{opt.desc}</span>
                          </span>
                          {sessionMode === opt.mode && <span className="text-sm font-black" style={{ color: '#7C3AED' }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setAnonymousMode(m => !m)}
                    aria-pressed={anonymousMode}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-all"
                    style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
                  >
                    <span>
                      <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>Names</span>
                      <span className="block text-xs" style={{ color: '#64748B' }}>{anonymousMode ? 'Anonymous archetypes only' : 'Participant names visible'}</span>
                    </span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: anonymousMode ? '#0F1B3D' : '#ECFDF5', color: anonymousMode ? '#FBD13B' : '#047857' }}>
                      {anonymousMode ? 'Anonymous' : 'Visible'}
                    </span>
                  </button>

                  <div className="rounded-xl border p-3" style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}>
                    <button
                      onClick={() => setTeamMode(m => !m)}
                      aria-pressed={teamMode}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span>
                        <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>Teams</span>
                        <span className="block text-xs" style={{ color: '#64748B' }}>{teamMode ? `${teamCount} automatic teams` : 'Individual play'}</span>
                      </span>
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: teamMode ? '#EEF2FF' : '#F8FAFC', color: teamMode ? '#4F46E5' : '#64748B' }}>
                        {teamMode ? 'On' : 'Off'}
                      </span>
                    </button>
                    {teamMode && (
                      <div className="mt-3 flex items-center gap-2">
                        {[2, 3, 4, 5, 6].map(n => (
                          <button
                            key={n}
                            onClick={() => setTeamCount(n)}
                            className="h-8 w-8 rounded-lg text-xs font-black transition-all"
                            style={teamCount === n ? { background: '#0F1B3D', color: '#FFFFFF' } : { background: '#F1F5F9', color: '#64748B' }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: '#E2E8F0' }}>
                <button
                  onClick={() => setAdvancedSettingsOpen(open => !open)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>Advanced settings</span>
                    <span className="block text-xs" style={{ color: '#94A3B8' }}>Shared-screen and pro race options</span>
                  </span>
                  <span className="text-lg font-black" style={{ color: '#64748B' }}>{advancedSettingsOpen ? '−' : '+'}</span>
                </button>

                {advancedSettingsOpen && (
                  <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: '#E2E8F0' }}>
                    <button
                      onClick={() => setDisplayMode(m => m === 'shared-screen' ? 'full-device' : 'shared-screen')}
                      aria-pressed={displayMode === 'shared-screen'}
                      className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left"
                      style={{ borderColor: '#FEF3C7', background: '#FFFBEB' }}
                    >
                      <span>
                        <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>Shared-screen mode</span>
                        <span className="block text-xs" style={{ color: '#92400E' }}>Phones show colour buttons only</span>
                      </span>
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: displayMode === 'shared-screen' ? '#0F1B3D' : '#FFFFFF', color: displayMode === 'shared-screen' ? '#FBD13B' : '#92400E' }}>
                        {displayMode === 'shared-screen' ? 'On' : 'Off'}
                      </span>
                    </button>

                    {plan === 'pro' && (
                      <div className="rounded-xl border p-3" style={{ borderColor: '#E0E7FF', background: '#F8FAFC' }}>
                        <button
                          onClick={() => setGhostMode(m => !m)}
                          aria-pressed={ghostMode}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span>
                            <span className="block text-sm font-black" style={{ color: '#0F1B3D' }}>Ghost mode</span>
                            <span className="block text-xs" style={{ color: '#64748B' }}>Race against top players from a past session</span>
                          </span>
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: ghostMode ? '#7C3AED' : '#FFFFFF', color: ghostMode ? '#FFFFFF' : '#64748B' }}>
                            {ghostMode ? 'On' : 'Off'}
                          </span>
                        </button>
                        {ghostMode && (
                          <div className="mt-3">
                            {ghostCandidates.length === 0 ? (
                              <p className="text-xs text-gray-400">No past sessions found for this quiz.</p>
                            ) : (
                              <select
                                value={ghostSessionId}
                                onChange={e => setGhostSessionId(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
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
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="relative h-svh overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #2D2A66 60%, #0F1B3D 100%)' }}>
          {/* Animated floating blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="lobby-blob" style={{ top: '-10%', left: '-10%', width: 420, height: 420, background: 'radial-gradient(circle, rgba(251,209,59,0.40), transparent 70%)', animationDelay: '0s' }} />
            <div className="lobby-blob" style={{ bottom: '-15%', right: '-5%', width: 520, height: 520, background: 'radial-gradient(circle, rgba(45,42,102,0.55), transparent 70%)', animationDelay: '-3s' }} />
            <div className="lobby-blob" style={{ top: '40%', left: '55%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(251,209,59,0.30), transparent 70%)', animationDelay: '-6s' }} />
            <div className="lobby-sparkle" style={{ top: '15%', left: '20%', animationDelay: '0s' }}>★</div>
            <div className="lobby-sparkle" style={{ top: '25%', right: '18%', animationDelay: '-1s' }}>✦</div>
            <div className="lobby-sparkle" style={{ bottom: '20%', left: '12%', animationDelay: '-2s' }}>✧</div>
            <div className="lobby-sparkle" style={{ bottom: '30%', right: '22%', animationDelay: '-1.5s' }}>★</div>
          </div>

          <div className="relative z-10 h-full flex flex-col gap-4 p-4 md:p-6 max-w-7xl mx-auto">

            {/* ── Header row ── */}
            <div className="flex items-center justify-between shrink-0">
              <QuizoticLogo variant="onDark" className="text-2xl" markSize={40} />
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-sm font-bold px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white backdrop-blur">
                  {{ competitive: '⚡ Competitive', accuracy: '✓ Accuracy', reflection: '🌙 Reflection', selfpaced: '🎯 Self-paced', assessment: '📋 Assessment' }[sessionMode] ?? '⚡ Competitive'}
                </span>
                <span className="text-sm font-black px-4 py-1.5 rounded-full text-[#0F1B3D]" style={{ background: '#FBD13B', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>
                  {connectedCount} {connectedCount === 1 ? 'player' : 'players'}
                </span>
              </div>
            </div>

            {/* ── Scoring explanation (competitive / accuracy only) ── */}
            {(sessionMode === 'competitive' || sessionMode === 'accuracy') && (
              <div className="shrink-0 rounded-xl px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1.5 items-center" style={{ background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.18)' }}>
                <p className="text-xs font-black uppercase tracking-widest text-white/60 w-full sm:w-auto">How scoring works</p>
                {sessionMode === 'competitive' ? (
                  <>
                    <span className="text-xs sm:text-sm text-white font-semibold">⚡ Answer faster = more points (50–100% of question value)</span>
                    <span className="hidden sm:inline text-white/30">·</span>
                    <span className="text-xs sm:text-sm text-white font-semibold">🔥 Streak: +100 for 2 right, +200 for 3, +500 for 4+</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm text-white font-semibold">✓ Any correct answer earns full points — no time pressure</span>
                    <span className="hidden sm:inline text-white/30">·</span>
                    <span className="text-xs sm:text-sm text-white font-semibold">🔥 Streak: +100 for 2 right, +200 for 3, +500 for 4+</span>
                  </>
                )}
              </div>
            )}

            {/* ── Two-column: PIN/QR left | Players canvas right ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] lg:grid-rows-1 gap-4 lg:gap-5 overflow-y-auto lg:overflow-hidden [&>*]:min-w-0">

              {/* Left column: Game PIN card + phone remote */}
              <div className="space-y-4 min-h-0 lg:overflow-y-auto pr-1">
                <div className="rounded-3xl p-7 text-center relative" style={{ background: 'rgba(255,255,255,0.96)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                  <p className="text-xs tracking-[0.4em] font-black uppercase mb-2" style={{ color: '#2D2A66' }}>Game PIN</p>
                  <p
                    className="font-display font-black leading-none select-all whitespace-nowrap"
                    style={{
                      fontSize: 'clamp(40px, 4.5vw, 64px)',
                      letterSpacing: '0.04em',
                      backgroundImage: 'linear-gradient(135deg, #0F1B3D 0%, #2D2A66 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {gameCode}
                  </p>

                  <div className="flex flex-col items-center gap-3 mt-6">
                    <div className="p-3 bg-white rounded-2xl border-2" style={{ borderColor: '#2D2A66', boxShadow: '0 6px 0 rgba(15,27,61,0.25)' }}>
                      <QRCode
                        value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}`}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#0F1B3D"
                      />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#2D2A66' }}>Scan to join</p>
                    <div className="text-center">
                      <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: '#2D2A66' }}>Or visit</p>
                      <p className="text-xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>quizotic.live/join</p>
                      <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>enter code <span className="font-mono font-black" style={{ color: '#0F1B3D' }}>{gameCode}</span></p>
                    </div>
                  </div>

                  {/* Phone-remote affordance — account-based, no PIN. Safe to
                      show because identity (not a visible code) is the gate. */}
                  <div className="mt-5 -mb-1 flex justify-center">
                    <PhoneRemoteButton variant="lobby" />
                  </div>
                </div>

              </div>

              {/* Right column: Players canvas — always visible without scrolling */}
              <div className="rounded-3xl p-6 min-h-[320px] lg:min-h-0 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: '1.5px solid rgba(251,209,59,0.30)' }}>
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <p className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                    {connectedCount === 0 ? (
                      <>
                        <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#FBD13B' }} />
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
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
                    <p className="text-white/50 text-sm text-center">Players appear here as they join.</p>
                    <p className="text-white/40 text-xs text-center">Share the Game PIN or QR code on the left.</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-wrap gap-3 content-start pr-1">
                    {playerEntries.map(([pKey, pInfo]) => (
                      <div
                        key={pKey}
                        className="flex flex-col items-center gap-1 lobby-join-pop"
                        style={{ opacity: pInfo.connected ? 1 : 0.45, filter: pInfo.connected ? 'none' : 'grayscale(0.6)' }}
                        title={pInfo.connected ? '' : 'Offline — waiting for reconnect'}
                      >
                        <div className="ring-2 rounded-full overflow-hidden" style={{ borderColor: pInfo.team?.color ?? '#FBD13B' }}>
                          <Avatar archetype={pInfo.archetype} size={playerEntries.length > 48 ? 40 : 56} />
                        </div>
                        <p className="text-sm text-white font-bold max-w-[80px] truncate text-center">
                          {pInfo.name}{pInfo.connected ? '' : ' (offline)'}
                        </p>
                        {playerEntries.length <= 48 && (
                          pInfo.team ? (
                            <p className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: pInfo.team.color }}>{pInfo.team.name}</p>
                          ) : (
                            <p className="text-xs text-white/60 max-w-[80px] truncate text-center">{pInfo.archetype}</p>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Error banners ── */}
            {!socketConnected && (
              <div className="shrink-0 bg-red-500/90 text-white rounded-xl p-4 text-sm font-bold border border-red-300">
                Connection lost. Reconnecting…
              </div>
            )}

            {sessionError && (
              <div className="shrink-0 bg-red-500/90 text-white rounded-xl p-4 text-sm font-bold border border-red-300">
                {sessionError}
              </div>
            )}

            {/* ── Pinned action bar: share + Start (always visible, no scroll) ── */}
            <div
              className="shrink-0 rounded-2xl px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3"
              style={{ background: 'rgba(15,27,61,0.55)', backdropFilter: 'blur(10px)', border: '1.5px solid rgba(251,209,59,0.28)' }}
            >
              {gameCode && (
                <ShareLinks gameCode={gameCode} quizTitle={quiz?.title ?? ''} variant="compact" />
              )}
              <button
                onClick={startQuiz}
                disabled={(!isHostStagePreview && connectedCount === 0) || !socketConnected}
                className="inline-flex items-center justify-center gap-2 font-black rounded-2xl px-8 py-3.5 text-base md:text-lg w-full sm:w-auto disabled:opacity-40 disabled:pointer-events-none transition-all hover:scale-[1.03]"
                style={{
                  background: (connectedCount > 0 || isHostStagePreview) && socketConnected ? 'linear-gradient(135deg, #FBD13B 0%, #FFB800 100%)' : 'rgba(255,255,255,0.15)',
                  color: (connectedCount > 0 || isHostStagePreview) && socketConnected ? '#0F1B3D' : '#ffffff',
                  boxShadow: (connectedCount > 0 || isHostStagePreview) && socketConnected ? '0 4px 0 #E0B528' : undefined,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {!socketConnected ? 'Reconnecting…' : connectedCount === 0 && !isHostStagePreview ? 'Waiting for players…' : `▶ Start Quiz (${connectedCount})`}
              </button>
            </div>
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
          /* Height model is responsive: phones get an auto-height, page-scrolling
             stage so the sticky control bar is always reachable (the old fixed
             h-svh + overflow-hidden clipped it below the fold). lg+ keeps the
             fixed projector-fit stage that compresses content without scroll. */
          className="min-h-svh lg:h-svh lg:max-h-svh lg:overflow-hidden px-4 pt-3 pb-3 lg:px-8 lg:pt-4 lg:pb-4 flex flex-col gap-3 host-question-stage"
          style={{
            background: 'linear-gradient(135deg, #071126 0%, #0F1B3D 55%, #102A43 100%)',
            color: '#FFFFFF',
          }}
        >
          {/* Mobile (<lg): per-participant roster as a fixed edge-tab drawer so
              the narrow projected question stays full-bleed. On lg+ the roster
              lives in the dedicated right rail of the 3-column grid below. */}
          <div className="lg:hidden">
            <LiveRosterPanel
              participants={participants}
              answeredKeys={answeredKeys}
              answered={answered}
              connectedCount={connectedCount}
              onKick={kickParticipant}
              anonymous={anonymousMode}
              onToggleAnonymous={toggleAnonymousMode}
            />
          </div>

          {/* 3-2-1 Countdown overlay */}
          {countdownValue !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,27,61,0.92)' }}>
              <div className="text-center">
                <div
                  key={countdownValue}
                  className="font-display text-white font-black"
                  style={{
                    fontSize: 200,
                    lineHeight: 1,
                    fontFamily: 'var(--font-display)',
                    color: '#FBD13B',
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

          {/* Header — ONE structure for live AND reveal. Swapping to a compact
              "Answer Reveal" bar here used to change the header height the
              moment the host revealed, which moved the question and every
              answer box below it. Only the label text and the timer circle's
              inner content change now; every box keeps its exact geometry. */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:gap-4 [&>*]:min-w-0">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: isAnswerRevealStage ? '#FBD13B' : 'rgba(255,255,255,0.52)' }}>
                  {isAnswerRevealStage ? 'Answer Reveal' : 'Live Question'}
                </span>
                <QuestionNavigator
                  questions={quiz.questions}
                  currentIndex={questionIndex}
                  playedIndexes={playedIndexes}
                  answerableNumber={answerableNumber}
                  answerableTotal={answerableTotal}
                  onJump={gotoQuestion}
                />
              </div>
              <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 lg:gap-3">
                {currentQuestion.timerSeconds > 0 && (
                  questionStartedAt == null || Date.now() < questionStartedAt ? (
                    <span className="min-w-16 text-center text-sm font-semibold animate-pulse px-4 py-2 rounded-full" style={{ color: '#FBD13B', background: 'rgba(255,255,255,0.08)' }}>Loading…</span>
                  ) : (
                    <div className="font-display flex h-12 w-12 lg:h-16 lg:w-16 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(15,27,61,0.42)', fontFamily: 'var(--font-display)' }}>
                      {questionEnded ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 lg:w-7 lg:h-7" aria-label="Question ended">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <>
                          {/* Phone header is a single tight row — smaller dial. */}
                          <span className="lg:hidden"><CircularTimer timeLeft={hostTimeLeft} total={currentQuestion.timerSeconds} size={48} /></span>
                          <span className="hidden lg:inline"><CircularTimer timeLeft={hostTimeLeft} total={currentQuestion.timerSeconds} size={64} /></span>
                        </>
                      )}
                    </div>
                  )
                )}
                <span className="inline-flex h-10 lg:h-12 items-center rounded-full px-3 lg:px-4 text-base lg:text-lg font-black tabular-nums whitespace-nowrap" style={{ color: '#0F1B3D', background: '#FBD13B', boxShadow: '0 5px 0 rgba(0,0,0,0.24)' }}>
                  {answered}/{connectedCount}
                  <span className="ml-2 text-xs uppercase tracking-wider">answered</span>
                </span>
                {/* Full Join QR now lives at the top of the participants rail
                    (right column) to slim this bar and reclaim vertical space for
                    the question. Below lg the rail is hidden, so a compact code
                    chip stays here to keep the join code visible. */}
                <div className="lg:hidden">
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
                background: 'linear-gradient(90deg, #FBD13B 0%, #22C55E 100%)',
              }}
            />
          </div>

          {/* Kept mounted through the reveal so the dev preview stage doesn't
              reflow when it disappears — buttons stay usable at any stage. */}
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
                style={{ background: '#FBD13B', color: '#0F1B3D' }}
              >
                Show moving standings
              </button>
            </div>
          )}

          {/* ── 3-column stage (lg+): STATS LEFT | QUESTION CENTER | ROSTER RIGHT ──
              The question body (case card, question card, answer stage, reveal
              breakdown) sits in the center; the left stats rail and right roster
              rail are always visible on desktop. On mobile the grid collapses to
              a single column (roster stays in its edge-tab drawer above), so the
              question keeps full width on phones. The grid itself never reflows
              on reveal — its columns are fixed; only rail contents swap in place. */}
          <div className="host-3col-stage flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-3">

            {/* LEFT — live stats rail (lg+). Hidden on mobile to keep the question
                full-bleed; the immersive overlay (button in the control bar) is
                the mobile equivalent. */}
            <div className="hidden lg:block min-h-0">
              <HostStatsRail
                answered={answered}
                connectedCount={connectedCount}
                optionCounts={optionCounts}
                options={statsOptions}
                correctRevealed={correctRevealed}
                isScored={isScoredQuestion(currentQuestion)}
                onExpand={() => setShowImmersiveStats(true)}
              />
            </div>

            {/* CENTER — question + answers (full width on mobile) */}
            <div className="flex flex-col gap-3 min-w-0 min-h-0">

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
            className={`host-question-card ${hostQuestionFit?.questionClass ?? 'host-question-fit-large'} w-full rounded-[28px] shadow-2xl border ${currentQuestion.type === 'wordcloud' ? 'p-4 md:p-5 host-question-card-compact' : 'p-5 md:p-7'} ${currentQuestion.type === 'case' ? 'border-blue-300' : 'border-white/20'}`}
            style={{
              background: 'rgba(255,255,255,0.96)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            }}
          >
            <p
              className="font-display font-bold leading-snug break-words"
              style={{
                color: '#0F1B3D',
                lineHeight: 1.1,
                fontFamily: 'var(--font-display)',
              }}
            >
              {currentQuestion.text}
            </p>
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt={`Image for question ${questionIndex + 1}`} className="mt-3 rounded-xl w-full object-contain" style={{ maxHeight: 'min(18vh, 200px)' }} loading="eager" />
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
              const perfectCount = isSequenceRanking
                ? rankingSubmissions.filter(arr =>
                    Array.isArray(arr) &&
                    arr.length === (currentQuestion.correctOrder ?? []).length &&
                    arr.every((optIdx, pos) => String(optIdx) === String((currentQuestion.correctOrder ?? [])[pos])),
                  ).length
                : 0

              return (
                <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 host-answer-stage host-ranking-stage">
                  <div className={`grid gap-3 ${isSequenceRanking ? 'lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]' : ''} max-h-[min(46vh,520px)] overflow-y-auto pr-1`}>
                  {/* Correct order panel (for sequence ranking) */}
                  {isSequenceRanking && (
                    <div className="rounded-2xl bg-white border border-green-200 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700">Correct sequence</p>
                        <span className="text-xs font-black rounded-full px-3 py-1 bg-green-100 text-green-800">
                          {perfectCount} perfect
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(currentQuestion.correctOrder ?? []).map((optIdx, pos) => {
                          const opt = typeof optIdx === 'number' ? currentQuestion.options?.[optIdx] : currentQuestion.options?.find((o) => getRankingOptionId(o) === optIdx)
                          return (
                            <div key={`${optIdx}-${pos}`} className="host-ranking-row flex items-center gap-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl px-3 py-2">
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black bg-green-500 text-white flex-shrink-0">
                                {pos + 1}
                              </span>
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${typeof optIdx === 'number' && optIdx >= 0 && optIdx < OPTION_COLORS.length ? OPTION_COLORS[optIdx] : 'bg-gray-400'}`}>
                                {typeof optIdx === 'number' ? (OPTION_LABELS[optIdx] ?? String(optIdx + 1)) : String(optIdx)}
                              </span>
                              <span className="flex-1 min-w-0 text-sm text-gray-800 font-semibold truncate">{opt ? getOptionText(opt) : `Option ${typeof optIdx === 'number' ? optIdx + 1 : optIdx}`}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Consensus ranking */}
                  <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Class consensus
                      </p>
                      <span className="text-xs font-black rounded-full px-3 py-1 bg-gray-100 text-gray-600">
                        {rankingSubmissions.length} submission{rankingSubmissions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {rows.map((row, pos) => (
                        <div key={row.i} className="host-ranking-row flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black bg-white text-gray-600 flex-shrink-0 border border-gray-200">
                            {pos + 1}
                          </span>
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${OPTION_COLORS[row.i]}`}>
                            {row.label}
                          </span>
                          <span className="flex-1 min-w-0 text-sm text-gray-800 font-semibold truncate">{row.text}</span>
                          <span className="text-xs font-bold text-gray-600 tabular-nums">
                            {row.hasData ? `avg ${row.avg.toFixed(1)}` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>
                </div>
              )
            })()
          ) : currentQuestion.type === 'wordcloud' ? (
            <HostWordCloud words={wordcloudWords} />
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
              const isQa = currentQuestion.type === 'qa'
              const count = isQa ? qaEntries.length : openendedEntries.length
              return (
                <>
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
                          background: 'linear-gradient(90deg, #FBD13B 0%, #22C55E 100%)',
                        }}
                      />
                    </div>
                  )}
                  {isQa ? (
                    <button
                      onClick={() => setQaPanelOpen(true)}
                      className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: '#0F1B3D', color: '#fff' }}
                    >
                      Moderate questions ({count})
                    </button>
                  ) : (
                    <p className="mt-5 text-xs font-medium text-gray-400 max-w-md">
                      Individual responses stay private here — review them in the post-session report.
                    </p>
                  )}
                </div>
                {isQa && qaPanelOpen && (
                  <QaModerationPanel
                    entries={qaEntries}
                    moderation={qaModeration}
                    onClose={() => setQaPanelOpen(false)}
                    onUpvote={key => setQaModeration(prev => ({
                      ...prev,
                      [key]: { status: prev[key]?.status ?? 'pending', votes: (prev[key]?.votes ?? 0) + 1 },
                    }))}
                    onSetStatus={(key, status: QaStatus) => setQaModeration(prev => {
                      // Only one question can hold the spotlight at a time.
                      const next = { ...prev }
                      if (status === 'spotlight') {
                        for (const k of Object.keys(next)) {
                          if (next[k].status === 'spotlight') next[k] = { ...next[k], status: 'pending' }
                        }
                      }
                      next[key] = { status, votes: prev[key]?.votes ?? 0 }
                      return next
                    })}
                  />
                )}
                </>
              )
            })()
          ) : (
          /* Options: single column on phones — the always-mounted vote/check
             slots + letter chip leave a 2-col layout ~zero px for the answer
             text at 375px, wrapping it one character per line. */
          <div className={`max-w-7xl mx-auto w-full flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-5 host-answer-stage host-options-stage ${hostQuestionFit?.optionClass ?? 'host-option-fit-large'}`}>
            {getEffectiveOptions(currentQuestion)?.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = connectedCount > 0 ? (votes / connectedCount) * 100 : 0
              const isCorrect = String(i) === currentQuestion.correctAnswer
              // Green ring only for scored types AND only after host reveals the answer.
              // This prevents leaking the correct answer on projector screens.
              const highlightCorrect = isScoredQuestion(currentQuestion) && isCorrect && correctRevealed
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
                  <div className="flex-1 min-h-0 p-3 md:p-5 flex items-center gap-4">
                    <span className={`w-11 h-11 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-white flex-shrink-0 ${OPTION_COLORS[i]}`} style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.16)' }}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="host-opt-text flex-1 min-w-0 break-words text-gray-900 font-black">{optText}</span>
                    {/* Vote count + check occupy FIXED-width slots that are
                        always mounted — they fade in on reveal instead of
                        being inserted, so the answer text never re-wraps. */}
                    <span
                      className={`host-reveal-votes w-10 text-right font-black tabular-nums text-gray-500 flex-shrink-0 transition-opacity duration-300 ${correctRevealed ? 'opacity-100' : 'opacity-0'}`}
                      aria-hidden={!correctRevealed}
                    >
                      {votes}
                    </span>
                    {isScoredQuestion(currentQuestion) && (
                      <span
                        className={`host-reveal-check w-7 text-center text-green-600 font-black flex-shrink-0 transition-opacity duration-300 ${highlightCorrect ? 'opacity-100' : 'opacity-0'}`}
                        aria-hidden={!highlightCorrect}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  {/* Vote-share bar: the fill is the REAL percentage for every
                      option, including the correct one (green marks correct;
                      a forced-100% green bar misread as "everyone got it"). */}
                  <div className={`h-3 ${highlightCorrect ? 'bg-[#BBF7D0]' : 'bg-gray-100'}`}>
                    <div
                      className={`h-full transition-all duration-500 ${highlightCorrect ? 'bg-green-500' : OPTION_COLORS[i]}`}
                      style={{ width: correctRevealed ? `${pct}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {/* Reveal footer — ALWAYS mounted for scored questions with a fixed
              min-height, so the answer grid above (flex-1) is sized the same
              before and after the reveal. Inserting this strip at reveal time
              used to shrink every answer tile the moment the host revealed.
              Contents swap in place: waiting hint → (non-competitive) reveal
              button → "% got it right" + explanation. */}
          {isScoredQuestion(currentQuestion) && (() => {
            const revealCorrect = revealCorrectCount ?? optionCounts[Number(currentQuestion.correctAnswer)] ?? 0
            const showResults = questionEnded && correctRevealed
            const showManualReveal = sessionMode !== 'competitive' && questionEnded && !correctRevealed
            return (
              <div
                className="host-reveal-footer w-full rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 min-h-[58px]"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}
              >
                {showResults ? (
                  <>
                    {connectedCount > 0 && (
                      <p className="text-lg font-black whitespace-nowrap flex-shrink-0" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>
                        {Math.round((revealCorrect / connectedCount) * 100)}% got it right
                      </p>
                    )}
                    {explanation ? (
                      <p className="leading-snug font-semibold text-sm flex-1 min-w-0" style={{ color: 'rgba(255,255,255,0.82)' }}>
                        {explanation}
                      </p>
                    ) : connectedCount === 0 ? (
                      <p className="leading-snug font-semibold text-sm flex-1 min-w-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        No participants answered this question.
                      </p>
                    ) : null}
                  </>
                ) : showManualReveal ? (
                  <>
                    <button
                      onClick={() => setCorrectRevealed(true)}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-black text-sm transition-all hover:scale-[1.02] flex-shrink-0"
                      style={{ background: '#16A34A', color: '#fff' }}
                    >
                      Reveal Correct Answer
                    </button>
                    <p className="leading-snug font-semibold text-sm flex-1 min-w-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Answers are in — reveal when the room is ready.
                    </p>
                  </>
                ) : (
                  <p className="leading-snug font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Results and explanation appear here after the reveal.
                  </p>
                )}
              </div>
            )
          })()}

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

            </div>{/* /CENTER column */}

            {/* RIGHT — Join QR (moved out of the top bar) + always-visible
                participant roster rail (lg+). Mobile uses the edge-tab drawer
                rendered above; this rail is desktop-only so the join code and
                roster are permanently at hand on the projector view. */}
            <div className="hidden lg:flex flex-col gap-3 min-h-0">
              <JoinPill gameCode={gameCode} variant="dock" />
              <div className="flex-1 min-h-0">
                <LiveRosterPanel
                  participants={participants}
                  answeredKeys={answeredKeys}
                  answered={answered}
                  connectedCount={connectedCount}
                  onKick={kickParticipant}
                  anonymous={anonymousMode}
                  onToggleAnonymous={toggleAnonymousMode}
                  variant="rail"
                />
              </div>
            </div>
          </div>{/* /host-3col-stage */}

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
          {!isScoredQuestion(currentQuestion) && currentQuestion.type !== 'wordcloud' && questionEnded && liveStat && (
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

          {/* (Non-competitive "Reveal Correct Answer" now lives inside the
              always-mounted reveal footer above — same slot, zero reflow.) */}

          <div className="sticky bottom-0 z-30 mt-auto w-full pt-2">
            <div
              className="max-w-7xl mx-auto flex items-center justify-between gap-3 rounded-3xl px-3 py-2.5"
              style={{
                background: 'rgba(15,27,61,0.78)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 18px 60px rgba(0,0,0,0.34)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Symmetric 3-zone control bar: [left cluster] [CENTER primary]
                  [right cluster]. grid-cols-[1fr_auto_1fr] keeps the primary
                  action truly centered regardless of how many secondary buttons
                  each side holds — the 1fr spacers absorb any imbalance.
                  Below sm the 3 zones need ~530px, so the bar re-stacks into
                  two rows instead: primary action full-width on top (order-1),
                  the two icon clusters share the second row. */}
              <div className="host-control-bar flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
              {/* ── Left: secondary icon cluster ───────────────────────────
                  Music, Sound, Pause, and timer (+15s / restart) controls. */}
              <div className="order-2 flex-1 sm:order-none sm:flex-initial sm:col-start-1 flex items-center gap-1 sm:gap-1.5 min-w-0 justify-start">
                <button
                  onClick={() => setMusicOn(m => !m)}
                  title={musicOn ? 'Background music is playing — click to mute' : 'Play low-volume background music during the quiz'}
                  aria-label={musicOn ? 'Mute background music' : 'Play background music'}
                  aria-pressed={musicOn}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-base transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                  style={{
                    background: musicOn ? 'rgba(251,209,59,0.22)' : 'rgba(255,255,255,0.08)',
                    color: musicOn ? '#FBD13B' : 'rgba(255,255,255,0.78)',
                    border: `1px solid ${musicOn ? 'rgba(251,209,59,0.5)' : 'rgba(255,255,255,0.14)'}`,
                  }}>
                  {/* music note */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </button>
                <button
                  onClick={() => setSoundMuted(toggleMuted())}
                  title={soundMuted ? 'Sound effects are muted — click to unmute' : 'Mute all sound effects (ticks, chimes, celebrations)'}
                  aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                  aria-pressed={!soundMuted}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-base transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                  style={{
                    background: soundMuted ? 'rgba(255,255,255,0.08)' : 'rgba(251,209,59,0.22)',
                    color: soundMuted ? 'rgba(255,255,255,0.5)' : '#FBD13B',
                    border: `1px solid ${soundMuted ? 'rgba(255,255,255,0.14)' : 'rgba(251,209,59,0.5)'}`,
                  }}>
                  {soundMuted ? (
                    // muted speaker
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4V5z" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    // speaker on
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                </button>
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
                  title={paused ? 'Resume the quiz' : 'Pause the quiz'}
                  aria-label={paused ? 'Resume quiz' : 'Pause quiz'}
                  aria-pressed={paused}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                  style={{
                    background: paused ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.08)',
                    color: paused ? '#4ADE80' : 'rgba(255,255,255,0.78)',
                    border: `1px solid ${paused ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.14)'}`,
                  }}>
                  {paused ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  )}
                </button>
                {!questionEnded && (
                  <>
                    <button
                      onClick={() => socketRef.current?.emit('adjust_timer', { gameCode, action: 'extend', seconds: 15 }, () => {})}
                      title="Add 15 seconds to the timer"
                      aria-label="Add 15 seconds"
                      className="flex h-10 items-center justify-center rounded-xl px-2.5 text-[13px] font-black transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.78)',
                        border: '1px solid rgba(255,255,255,0.14)',
                      }}>
                      +15s
                    </button>
                    <button
                      onClick={() => socketRef.current?.emit('adjust_timer', { gameCode, action: 'restart' }, () => {})}
                      title="Restart the timer at the question's full time"
                      aria-label="Restart timer"
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.78)',
                        border: '1px solid rgba(255,255,255,0.14)',
                      }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                        <path d="M3 12a9 9 0 1 0 9-9" />
                        <path d="M3 4v5h5" />
                      </svg>
                    </button>
                  </>
                )}
                {/* (Removed the mirror/projector toggle — it only ever worked in
                    presenter mode, so it was a dead no-op in a live quiz.) */}
              </div>

              {/* ── Center: ONE primary action + a single cadence override ──
                  getPostQuestionAction drives label, colour, and onClick.
                  Override is EITHER "Show standings" OR "Skip" — never both. */}
              <div className="order-1 w-full sm:order-none sm:w-auto flex items-center justify-center gap-2 sm:col-start-2 min-w-0">
              {(() => {
              const isLast = questionIndex + 1 >= quiz.questions.length
              const scoredQ = isScoredQuestion(currentQuestion)
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
                    className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 px-5 rounded-full font-bold text-sm border-2 transition-all"
                    style={{
                      borderColor: armed ? '#DC2626' : 'rgba(255,255,255,0.2)',
                      color: armed ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
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
              // SINGLE cadence override (was two buttons). Cadence says
              // "skip standings" → offer a quiet "Show standings"; cadence
              // recommends standings → offer a quiet "Skip". One or the other.
              const showStandingsOverride = action === 'next' && questionEnded && scoredQ
                && (sessionMode === 'competitive' || sessionMode === 'accuracy')
              const skipStandingsOverride = action === 'standings'
              const overrideLabel = showStandingsOverride ? 'Show standings' : skipStandingsOverride ? 'Skip' : null
              const overrideOnClick = showStandingsOverride
                ? advanceFromQuestion
                : skipStandingsOverride
                  ? (questionEnded ? nextQuestion : () => { void advanceAfterEndingCurrentQuestion() })
                  : null
              return (
                <div className="flex items-center justify-center gap-2 w-full">
                  {overrideLabel && overrideOnClick && (
                    <button
                      onClick={overrideOnClick}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-semibold text-xs transition-all hover:underline underline-offset-4 shrink-0"
                      style={{ color: 'rgba(255,255,255,0.62)', background: 'transparent' }}
                      title={showStandingsOverride ? 'Show the leaderboard before moving on' : 'Skip the leaderboard and go straight to the next question'}
                    >
                      {overrideLabel}
                    </button>
                  )}
                  <button
                    onClick={onClick}
                    className="inline-flex h-11 flex-1 sm:flex-initial items-center justify-center gap-2 px-6 font-black text-sm rounded-full transition-colors shadow-md animate-pulse"
                    style={{
                      background: action === 'reveal' ? '#16A34A' : action === 'standings' && standingsRecommended ? '#FBD13B' : '#FBBF24',
                      color: action === 'reveal' ? '#FFFFFF' : '#0F1B3D',
                    }}
                  >
                    {label}
                    <NavChevron direction="forward" className="w-4 h-4" />
                  </button>
                </div>
              )
              })()}
              </div>

              {/* ── Right: secondary cluster ──────────────────────────────
                  Standings peek (L), Expand stats (S), and Phone remote.
                  Mirrors the left cluster so the centered primary stays balanced
                  and the bar reads symmetrically on a projector. */}
              <div className="order-3 sm:order-none flex items-center gap-1 sm:gap-1.5 justify-end sm:col-start-3">
                <button
                  onClick={() => setShowLeaderboardPopup(true)}
                  title="Peek at standings (press L)"
                  aria-label="Show standings"
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowImmersiveStats(s => !s)}
                  title="Full-screen stats (press S)"
                  aria-label="Toggle full-screen stats"
                  aria-pressed={showImmersiveStats}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#FBD13B] focus-visible:ring-offset-2"
                  style={{
                    background: showImmersiveStats ? 'rgba(251,209,59,0.22)' : 'rgba(255,255,255,0.08)',
                    color: showImmersiveStats ? '#FBD13B' : 'rgba(255,255,255,0.78)',
                    border: `1px solid ${showImmersiveStats ? 'rgba(251,209,59,0.5)' : 'rgba(255,255,255,0.14)'}`,
                  }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                    <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
                  </svg>
                </button>
                {/* Phone remote — reachable during the live quiz, not just the
                    lobby. Account-based, so the QR/link is safe to show here. */}
                <PhoneRemoteButton variant="bar" />
              </div>
              </div>{/* /3-zone grid */}
            </div>
          </div>
        </motion.div>
      )}

      {/* Pop-up leaderboard — trophy button or 'L' key. Opens over the current
          slide without advancing it; audience phones are unaffected. Renders the
          latest leaderboard_update snapshot, or an empty state before Q1 ends. */}
      {currentQuestion && (
        <ImmersiveStatsOverlay
          open={showImmersiveStats}
          onClose={() => setShowImmersiveStats(false)}
          questionNumber={answerableNumber}
          questionTotal={answerableTotal}
          questionText={currentQuestion.text}
          answered={answered}
          connectedCount={connectedCount}
          optionCounts={optionCounts}
          options={immersiveOptions}
          correctRevealed={correctRevealed}
          isScored={isScoredQuestion(currentQuestion)}
          autoOpenAfterReveal={autoStatsAfterReveal}
          onToggleAutoOpen={toggleAutoStatsAfterReveal}
        />
      )}
      {showLeaderboardPopup && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,27,61,0.78)' }}
          onClick={() => setShowLeaderboardPopup(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#0F1B3D' }}>
              <h3 className="text-lg font-black text-white">🏆 Live Leaderboard</h3>
              <button
                onClick={() => setShowLeaderboardPopup(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#FBD13B]"
                aria-label="Close leaderboard"
              >✕</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {leaderboard.length > 0 ? (
                <LeaderboardView
                  variant="fullscreen"
                  topN={10}
                  heading=""
                  rows={buildLeaderboardStageRows(leaderboard, [], 10)}
                />
              ) : (
                <p className="text-center py-10 text-sm font-semibold" style={{ color: '#9CA3AF' }}>
                  Live standings appear here after the first scored question.
                </p>
              )}
            </div>
            <div className="px-5 py-3 text-center text-xs font-semibold" style={{ color: '#9CA3AF', background: '#F8F9FA' }}>
              Press <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#E5E7EB', color: '#0F1B3D' }}>L</kbd> to toggle · click outside to close
            </div>
          </div>
        </div>
      )}

      {/* STANDINGS — dedicated between-questions screen for competitive quizzes */}
      {phase === 'standings' && quiz && currentQuestion && (
        <motion.div
          initial={reduceStageMotion ? false : { opacity: 0, y: 20, scale: 0.99 }}
          animate={reduceStageMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
          className="min-h-svh px-4 py-6 lg:px-8 space-y-6"
          style={{
            background:
              'radial-gradient(circle at 20% 10%, rgba(251,209,59,0.18), transparent 26%), radial-gradient(circle at 80% 18%, rgba(34,197,94,0.16), transparent 28%), linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
          }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>
              {onLeaderboardSlide ? 'Standings' : `After Question ${answerableNumber} of ${answerableTotal}`}
            </p>
            <h2 className="font-display text-4xl md:text-6xl font-black mt-1" style={{ fontFamily: 'var(--font-display)', color: '#0F1B3D' }}>
              {onLeaderboardSlide ? (currentQuestion.text?.trim() || 'Leaderboard') : 'Places Are Moving'}
            </h2>
          </div>

          {intermediateLeaderboard.length > 0 && (
            <div className="rounded-[28px]" style={{ background: '#fff', border: '1px solid #E5E7EB', padding: '22px 18px', minHeight: 'min(500px, 58vh)', boxShadow: '0 24px 80px rgba(15,27,61,0.12)' }}>
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
                      <p className="text-sm font-bold" style={{ color: '#FBD13B' }}>#{m.fromRank} → #{m.toRank}</p>
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
              <NavChevron direction="forward" className="w-4 h-4" />
            </button>
          </div>
          </div>
        </motion.div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <>
        {/* Celebration confetti fires for EVERY finale — including when the
            host ends the quiz early or nobody finished (empty leaderboard).
            The ranked Podium below still needs finishers, but the celebration
            itself must not depend on that. Firecracker/fanfare play from the
            mode-independent phase===ended effect. */}
        <LottieConfetti />
        <CelebrationConfetti active />
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
            /* lg+: viewport-locked hero for projectors (no scroll). Below lg the
               fixed height clipped the finale podium on short phones (SE et al),
               so phones get natural height and scroll instead. */
            className="relative overflow-hidden flex flex-col items-center justify-center px-4 md:px-8 py-4 md:py-6 min-h-[60svh] lg:h-[calc(100dvh-56px)]"
            style={{
              background:
                // Yellow top-center glow removed — it tinted the "Session
                // Complete" heading and hurt legibility. Cool cyan accent stays
                // low-left, behind the podium, away from the text.
                'radial-gradient(circle at 8% 72%, rgba(34,211,238,0.16), transparent 24%), linear-gradient(145deg, #071126 0%, #0F1B3D 58%, #111827 100%)',
              boxShadow: '0 30px 90px rgba(15,27,61,0.28)',
            }}
          >
            <div className="relative z-10 shrink-0 text-center">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.24em]" style={{ color: 'rgba(251,209,59,0.72)' }}>
                Final Standings
              </p>
              <h2 className="font-display mt-1 text-3xl md:text-5xl font-black" style={{ color: '#FFFFFF', fontFamily: 'var(--font-display)', letterSpacing: 0 }}>
                Session Complete
              </h2>
              <p className="mt-1 text-sm md:text-base font-semibold" style={{ color: 'rgba(255,255,255,0.68)' }}>
                {leaderboard.length} participant{leaderboard.length === 1 ? '' : 's'} finished
              </p>
            </div>

            {/* shrink-0 header + max-h-full card so the podium never grows up into
                the subtitle on short/projector viewports (was overlapping). */}
            <div className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center mt-4 md:mt-6 overflow-hidden">
              <div className="font-display w-full max-w-5xl max-h-full overflow-hidden rounded-[28px] p-3 md:p-5" style={{ background: 'rgba(255,255,255,0.96)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)', fontFamily: 'var(--font-display)' }}>
                <Podium
                  leaderboard={leaderboard}
                  sessionMode={sessionMode}
                  // Enable the ambient confetti loop so celebration continues
                  // after the winner-reveal burst. Previously false, which left
                  // only the subtle DOM layers (often invisible under macOS
                  // reduced-motion) — read as "confetti doesn't work."
                  loopConfetti
                  showRest={false}
                  variant="finale"
                />
              </div>
            </div>
          </motion.section>
        ) : null}

        {/* Rest-of-field report. Opacity-only fade (no y-translate, no mount
            delay) so the section occupies its layout box from the first frame —
            a delayed y-translate + 100ms delay previously made the page grow
            downward a moment after the podium mounted, read as a stutter. */}
        <motion.div
          initial={reduceStageMotion ? false : { opacity: 0 }}
          animate={reduceStageMotion ? undefined : { opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="px-4 max-w-7xl mx-auto py-8 space-y-8"
        >
          {!(sessionMode === 'competitive' && leaderboard.length > 0) && (
            <h2 className="text-4xl font-black max-w-3xl mx-auto" style={{ color: '#0F1B3D' }}>Session Complete</h2>
          )}

          {/* Direct line from the podium to the full session report — the
              dashboard report has the confidence grid, per-question breakdown
              and participant matrix, so surface it here instead of burying it
              in the disclosure below. */}
          {gameCode && (
            <div className="flex justify-center">
              <a
                href={`/host/reports/${gameCode}`}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: '#0F1B3D', color: '#FFFFFF', boxShadow: '0 6px 18px rgba(15,27,61,0.28)', fontFamily: 'var(--font-heading)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden><path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/></svg>
                View full session report
                <span aria-hidden>→</span>
              </a>
            </div>
          )}

          {/* The rest of the field — everyone outside the top-3 podium, so any
              player can scroll down and find exactly where they finished. This
              is the celebratory companion to the podium: names + scores only,
              no analytics. */}
          {leaderboard.length > 3 && (
            <div className="max-w-2xl mx-auto w-full">
              <h3
                className="font-display text-xl md:text-2xl font-extrabold mb-3"
                style={{ color: '#0F1B3D', fontFamily: 'var(--font-display)' }}
              >
                The rest of the field
              </h3>
              <div className="space-y-2">
                {leaderboard.slice(3).map((entry, i) => {
                  const rank = i + 4
                  return (
                    <div
                      key={`${entry.name}-${rank}`}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white border"
                      style={{ borderColor: '#E7E2D4' }}
                    >
                      <span
                        className="font-display text-lg font-extrabold tabular-nums w-9 text-center flex-shrink-0"
                        style={{ color: '#9CA3AF', fontFamily: 'var(--font-display)' }}
                      >
                        {rank}
                      </span>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: '#0F1B3D' }}
                      >
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 font-semibold truncate" style={{ color: '#0F1B3D' }}>
                        {entry.name}
                      </span>
                      {sessionMode === 'competitive' && (
                        <span
                          className="font-display text-base font-extrabold tabular-nums flex-shrink-0"
                          style={{ color: '#0F1B3D', fontFamily: 'var(--font-display)' }}
                        >
                          {entry.score.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
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

          {/* Host tools — analytics, sharing & follow-ups sit behind a closed
              disclosure so the post-game screen stays celebratory (podium +
              scores). The host can expand for the report/exports here; the full
              breakdown also lives on the quiz report page. */}
          <details className="max-w-3xl mx-auto group">
            <summary
              className="cursor-pointer list-none flex items-center justify-center gap-2 text-sm font-bold py-2 select-none"
              style={{ color: '#6B7280' }}
            >
              <span>Report, sharing &amp; follow-ups</span>
              <span className="transition-transform group-open:rotate-90">▸</span>
            </summary>
            <div className="space-y-8 pt-6">

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
                  style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
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
            </div>
          </details>

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
              style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              Play Again
            </button>

            {/* Export pills — compact row */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500">Export:</span>
              {plan !== 'pro' && (
                <span
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-400 bg-white cursor-not-allowed inline-flex items-center gap-1"
                  title="CSV export is a Pro feature — email info@quizotic.live to upgrade"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  CSV · Pro
                </span>
              )}
              {plan === 'pro' && <button
                onClick={() => {
                  if (!quiz || leaderboard.length === 0) return
                  const rows = [['Rank', 'Name', 'Score']]
                  leaderboard.forEach((entry, i) => {
                    rows.push([String(i + 1), entry.name, String(entry.score)])
                  })
                  if (questionStats.length > 0) {
                    rows.push([])
                    rows.push(['Question', 'Correct %', 'Type', 'Text'])
                    questionStats.filter(s => !s.isLeaderboard).forEach((stat, i) => {
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
              </button>}
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

          {/* Post-session feedback — the moment the host actually has an opinion
              about the product, so this is our highest-signal prompt. */}
          <div className="flex justify-center pt-1 pb-2">
            <button
              type="button"
              onClick={() => openFeedback('post-session')}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline-offset-4 hover:underline transition-colors"
            >
              How did that go? Send feedback
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
        <div className="fixed right-3 z-40" style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
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
