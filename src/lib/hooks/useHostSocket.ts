'use client'

// useHostSocket — reusable, typed host-side Socket.io hook.
//
// Single source of truth for connecting a host surface (the projector
// session page AND the future phone remote) to the Quizotic realtime
// engine. It owns the socket lifecycle: connects with host auth, joins the
// `host:<gameCode>` room, and forwards the standard host events into typed
// React state.
//
// IMPORTANT (A3 design decision):
//   The existing host session page (src/app/host/session/page.tsx) has a
//   battle-tested socket setup — refs, answer outbox, clock-sync, host_resume
//   reclaim — wired directly into component state. Rewiring that page onto
//   this hook mid-redesign risks destabilising a live platform. So this hook
//   is shipped as a clean, standalone, importable module; the page keeps its
//   own working wiring for now. The phone-remote page (Wave 2) consumes this
//   hook directly. Both speak the SAME event names and payloads defined below,
//   so there is exactly one contract to maintain.
//
// Event names + payload shapes are pinned to server.mjs. Do not rename without
// updating the server. Payloads stay < 1KB.

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

// ─── Types ──────────────────────────────────────────────────────────────────

export type HostPhase = 'lobby' | 'question' | 'standings' | 'ended'

/** A participant row in a session_state snapshot. */
export interface HostParticipantState {
  participantId: string | null
  name: string
  archetype: string | null
  team: { index: number; name: string; color: string } | null
}

/** Authoritative snapshot broadcast every ~5s and on host_join_remote. */
export interface SessionStatePayload {
  active: HostParticipantState[]
  disconnected: HostParticipantState[]
  connectedCount: number
  totalCount: number
}

/** A live session owned by the signed-in user, returned by host_list_my_sessions. */
export interface MySessionSummary {
  gameCode: string
  title: string
  phase: 'lobby' | 'active' | 'ended'
  playerCount: number
}

export interface AnswerReceivedPayload {
  count: number
  optionCounts?: number[]
}

export interface LeaderboardEntryLike {
  name: string
  archetype?: string
  score: number
}

export interface LeaderboardUpdatePayload {
  top: LeaderboardEntryLike[]
  teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null
  topMovers?: { name: string; archetype?: string; fromRank: number; toRank: number; delta: number }[]
  standingsRecommended?: boolean
}

/** Question lifecycle change. Host uses this to sync timer + countdown. */
export interface QuestionShowPayload {
  startAt?: number
  index: number
  question: unknown
  total: number
}

export interface QuestionEndedPayload {
  correctAnswer: string
  explanation: string | null
}

export interface SessionEndedPayload {
  leaderboard: LeaderboardEntryLike[]
  teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null
  questionStats: unknown[]
  sessionMode?: string
}

/** Surface state exposed by the hook. */
export interface HostSocketState {
  /** True once the socket has fired `connect`. */
  connected: boolean
  /** Derived lifecycle phase the host UI should render. */
  phase: HostPhase | null
  /** Last authoritative session_state snapshot (participants + counts). */
  sessionState: SessionStatePayload | null
  /** Live answer count + per-option counts as answers arrive. */
  answerCount: number
  optionCounts: number[]
  /** Latest leaderboard update snapshot. */
  leaderboard: LeaderboardEntryLike[]
  teamLeaderboard: { name: string; color: string; score: number; members: number }[] | null
  topMovers: { name: string; archetype?: string; fromRank: number; toRank: number; delta: number }[]
  standingsRecommended: boolean
  /** Explanation shown after a question ends. */
  explanation: string | null
  /** Index of the currently-active question (from question_show). */
  questionIndex: number | null
  /** Last error from a server-side host_remote_error or connect_error. */
  error: string | null
}

export interface UseHostSocketResult extends HostSocketState {
  /** The raw socket.io client (null until connected). Escape hatch for
   *  advanced callers (clock-sync, ack callbacks). Prefer the emit helpers. */
  socket: Socket | null
  /** List the live sessions owned by the signed-in user (phone remote picker).
   *  Resolves [] if not signed in or none are live. */
  listMySessions: () => Promise<MySessionSummary[]>
  /** Take control of one of the user's own live sessions from a phone. Identity
   *  is the gate (no PIN) — resolves false if the account doesn't own it. */
  takeControl: (args: { gameCode: string }) => Promise<boolean>
  // ─── Emit helpers (no-ops until connected/joined) ────────────────────────
  startQuiz: () => void
  nextQuestion: () => void
  endQuestion: () => Promise<boolean>
  showStandings: () => void
  pauseQuiz: () => void
  resumeQuiz: () => void
  endSession: () => void
  /** Toggle whether content mirrors to participant phones (presenter mode). */
  toggleMirror: (mirror: boolean) => void
  /** Tear down the socket. Also called automatically on unmount. */
  disconnect: () => void
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Connect a host surface to the Quizotic realtime engine.
 *
 * @param gameCode  Optional initial code — if supplied the hook takes control
 *                  on mount (phone remote pairing by account identity, no PIN).
 */
export function useHostSocket(gameCode?: string): UseHostSocketResult {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  const [phase, setPhase] = useState<HostPhase | null>(null)
  const [sessionState, setSessionState] = useState<SessionStatePayload | null>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [optionCounts, setOptionCounts] = useState<number[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryLike[]>([])
  const [teamLeaderboard, setTeamLeaderboard] = useState<{ name: string; color: string; score: number; members: number }[] | null>(null)
  const [topMovers, setTopMovers] = useState<{ name: string; archetype?: string; fromRank: number; toRank: number; delta: number }[]>([])
  const [standingsRecommended, setStandingsRecommended] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [questionIndex, setQuestionIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Set up the socket once (lazy). Caller drives takeControl() with the gameCode.
  useEffect(() => {
    const s = io()
    socketRef.current = s

    const onConnect = () => {
      // Expose the socket once it's actually connected — keeps this setState
      // inside an async callback instead of the synchronous effect body.
      setSocket(s)
      setConnected(true)
      setError(null)
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = () => { setConnected(false); setError('Connection failed. Check your network.') }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onConnectError)

    s.on('host_remote_error', ({ message }: { message?: string }) => {
      setError(typeof message === 'string' ? message : 'Remote host error')
    })

    s.on('session_state', (payload: SessionStatePayload) => {
      setSessionState(payload)
    })

    s.on('answer_received', ({ count, optionCounts: counts }: AnswerReceivedPayload) => {
      setAnswerCount(count)
      if (counts) setOptionCounts(counts)
    })

    s.on('live_responses', (payload: { questionIndex: number }) => {
      if (typeof payload?.questionIndex === 'number') setQuestionIndex(payload.questionIndex)
    })

    s.on('question_show', ({ index }: QuestionShowPayload) => {
      setQuestionIndex(index)
      setPhase('question')
      setExplanation(null)
    })

    s.on('question_ended', ({ explanation: exp }: QuestionEndedPayload) => {
      setExplanation(exp)
    })

    s.on('leaderboard_update', (payload: LeaderboardUpdatePayload) => {
      setLeaderboard(payload.top ?? [])
      if (payload.teamLeaderboard !== undefined) setTeamLeaderboard(payload.teamLeaderboard)
      setTopMovers(payload.topMovers ?? [])
      setStandingsRecommended(!!payload.standingsRecommended)
    })

    s.on('participant_joined', () => { /* session_state reconciles authoritatively */ })
    s.on('participant_rejoined', () => { /* session_state reconciles authoritatively */ })
    s.on('participant_disconnected', () => { /* session_state reconciles authoritatively */ })
    s.on('participant_left', () => { /* session_state reconciles authoritatively */ })

    s.on('session_ended', () => {
      setPhase('ended')
    })

    return () => {
      s.off('connect')
      s.off('disconnect')
      s.off('connect_error')
      s.off('host_remote_error')
      s.off('session_state')
      s.off('answer_received')
      s.off('live_responses')
      s.off('question_show')
      s.off('question_ended')
      s.off('leaderboard_update')
      s.off('participant_joined')
      s.off('participant_rejoined')
      s.off('participant_disconnected')
      s.off('participant_left')
      s.off('session_ended')
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [])

  // Track the active gameCode so emit helpers close over the current value.
  const gameCodeRef = useRef<string | undefined>(gameCode)
  useEffect(() => { gameCodeRef.current = gameCode }, [gameCode])

  const listMySessions = useCallback((): Promise<MySessionSummary[]> => {
    const s = socketRef.current
    if (!s) return Promise.resolve([])
    return new Promise<MySessionSummary[]>(resolve => {
      let settled = false
      const timeout = setTimeout(() => { if (!settled) { settled = true; resolve([]) } }, 4000)
      s.emit('host_list_my_sessions', (res?: { success?: boolean; error?: string; sessions?: MySessionSummary[] }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (res && !res.success && res.error) setError(res.error)
        resolve(res?.sessions ?? [])
      })
    })
  }, [])

  const takeControl = useCallback(({ gameCode: code }: { gameCode: string }): Promise<boolean> => {
    const s = socketRef.current
    if (!s) return Promise.resolve(false)
    gameCodeRef.current = code
    // Account-based pairing: identity (the signed-in cookie carried by the
    // socket) is the gate. The server confirms with a session_state snapshot.
    return new Promise<boolean>(resolve => {
      let settled = false
      const timeout = setTimeout(() => { if (!settled) { settled = true; resolve(false) } }, 4000)
      s.emit('host_join_remote', { gameCode: code }, (res?: { success?: boolean; error?: string }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (res && !res.success && res.error) setError(res.error)
        resolve(!!res?.success)
      })
    })
  }, [])

  const emitIfReady = useCallback((event: string, payload: Record<string, unknown>) => {
    const code = gameCodeRef.current
    if (!code) return
    socketRef.current?.emit(event, { gameCode: code, ...payload })
  }, [])

  const startQuiz = useCallback(() => emitIfReady('start_quiz', {}), [emitIfReady])
  const nextQuestion = useCallback(() => emitIfReady('next_question', {}), [emitIfReady])
  const showStandings = useCallback(() => emitIfReady('show_standings', {}), [emitIfReady])
  const pauseQuiz = useCallback(() => emitIfReady('pause_quiz', {}), [emitIfReady])
  const resumeQuiz = useCallback(() => emitIfReady('resume_quiz', {}), [emitIfReady])
  const endSession = useCallback(() => emitIfReady('end_session', {}), [emitIfReady])
  const toggleMirror = useCallback((mirror: boolean) => {
    emitIfReady('toggle_mirror_to_participants', { mirror })
  }, [emitIfReady])

  const endQuestion = useCallback((): Promise<boolean> => {
    const code = gameCodeRef.current
    const s = socketRef.current
    if (!s?.connected || !code) return Promise.resolve(false)
    return new Promise<boolean>(resolve => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        resolve(false)
      }, 3000)
      s.emit('end_question', { gameCode: code }, (res?: { success?: boolean }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(!!res?.success)
      })
    })
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  // Auto-take-control if a code was supplied up-front and the socket connects
  // (phone remote deep-link). Identity is the gate — no PIN needed.
  useEffect(() => {
    if (gameCode && connected) takeControl({ gameCode })
    // takeControl is stable; re-run when the code or connection changes.
  }, [gameCode, connected, takeControl])

  return {
    socket,
    connected,
    phase,
    sessionState,
    answerCount,
    optionCounts,
    leaderboard,
    teamLeaderboard,
    topMovers,
    standingsRecommended,
    explanation,
    questionIndex,
    error,
    listMySessions,
    takeControl,
    startQuiz,
    nextQuestion,
    endQuestion,
    showStandings,
    pauseQuiz,
    resumeQuiz,
    endSession,
    toggleMirror,
    disconnect,
  }
}
