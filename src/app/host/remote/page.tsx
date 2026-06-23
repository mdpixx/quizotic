'use client'

// Phone Host Remote — /host/remote
//
// A mobile web surface that lets the host drive a live Quizotic session from
// their phone while the projector shows the big view. The host pairs with the
// projector's lobby PIN, then the phone mirrors the server's authoritative
// phase (lobby → question → standings → ended) and exposes the same one-shot
// controls the projector does (start / reveal / next / standings / end).
//
// DUAL-CONTROL SAFETY (see CLAUDE.md / session redesign A5):
//   The remote never advances phase optimistically. The visible screen is
//   DERIVED from the server-driven `phase` returned by useHostSocket, plus a
//   small set of local flags that are set ONLY when an action is emitted and
//   are cleared the moment the matching server event arrives. Each one-shot
//   button (reveal / next / standings / end-question) is gated by a local
//   `busy` state so two near-simultaneous taps (phone + projector) cannot
//   double-advance the session.
//
// Reused, not duplicated:
//   - useHostSocket ........ socket lifecycle + typed host events
//   - getPostQuestionAction  same post-question action logic as the projector
//   - buildLeaderboardStageRows  same row shaping for LeaderboardView
//   - LeaderboardView ....... compact standings list (shared component)
//   - sounds.ts ............ isMuted / toggleMuted (single global mute switch)

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'

import { useHostSocket, type HostPhase, type MySessionSummary } from '@/lib/hooks/useHostSocket'
import { isMuted, toggleMuted, playBackgroundMusic, stopBackgroundMusic } from '@/lib/sounds'
import { getPostQuestionAction, buildLeaderboardStageRows } from '@/lib/host-stage'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { RemoteSessionPicker } from './_components/RemoteSessionPicker'
import { RemoteLobby } from './_components/RemoteLobby'
import { RemoteQuestion } from './_components/RemoteQuestion'
import { RemoteStandings } from './_components/RemoteStandings'
import { RemoteEnded } from './_components/RemoteEnded'

// The remote subscribes to socket events but useHostSocket does not expose a
// `paused` flag (the server's session_state carries no paused field today) nor
// does it auto-transition phase to 'lobby' / 'standings'. We re-derive a view
// phase from the server phase plus a couple of local flags that are set on
// emit and cleared on the next server event — see DUAL-CONTROL SAFETY above.
type View = 'picker' | 'lobby' | 'question' | 'standings' | 'ended'

export default function RemotePage() {
  return (
    <Suspense fallback={<RemoteShellLoading />}>
      <RemotePageInner />
    </Suspense>
  )
}

function RemoteShellLoading() {
  return (
    <div
      className="min-h-svh flex items-center justify-center"
      style={{ background: 'var(--color-paper)' }}
    >
      <p className="font-display text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Loading remote…
      </p>
    </div>
  )
}

function RemotePageInner() {
  const { status } = useSession()
  const searchParams = useSearchParams()

  // ── Pairing (account-based, no PIN) ──────────────────────────────────────
  // A deep link (?code=) takes control of that session directly; otherwise the
  // phone lists the signed-in user's live sessions and they tap one.
  const deepLinkCode = searchParams.get('code') ?? ''
  const [gameCode, setGameCode] = useState(deepLinkCode)
  const [mySessions, setMySessions] = useState<MySessionSummary[] | null>(null)

  // One hook for the whole remote lifecycle. We do NOT auto-join on mount —
  // pairing happens once a session is picked (or auto, see effect below).
  const host = useHostSocket()

  // ── Local, server-anchored view state ────────────────────────────────────
  // These flags bridge the gap between useHostSocket's phase (which only moves
  // on question_show / session_ended) and the full lobby→question→standings→
  // ended flow. Each is set when we EMIT the matching action and reset when a
  // server event advances past it, so the screen always reflects what the
  // server has actually accepted.
  const [started, setStarted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [showingStandings, setShowStandings] = useState(false)
  const [paused, setPaused] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  const [mirrorOn, setMirrorOn] = useState(false)
  const [soundMuted, setSoundMuted] = useState(false)

  // Per-action busy gates (DUAL-CONTROL SAFETY). Each one-shot stays disabled
  // until the matching server event advances the view.
  const [busy, setBusy] = useState<string | null>(null)

  // Paired once the server confirms host_join_remote by sending a session_state
  // snapshot. We do NOT set this optimistically — a rejected take-control must
  // keep the picker mounted so its error banner stays visible.
  const paired = !!host.sessionState

  // Derived view from server phase + local bridge flags.
  const view: View = useMemo(() => {
    if (!paired) return 'picker'
    const p: HostPhase | null = host.phase
    if (p === 'ended') return 'ended'
    if (showingStandings) return 'standings'
    if (p === 'question') return 'question'
    if (started) return 'question'
    return 'lobby'
  }, [paired, host.phase, started, showingStandings])

  // ── Server-event anchoring ───────────────────────────────────────────────
  // When the server advances phase, reset the local bridge flags, release any
  // busy gate, and stop background music when the session ends. This is the
  // legitimate "adjust local state when an external (server) value changes"
  // case; the ref-during-render alternative is blocked by react-hooks/refs, so
  // we block-disable the stricter react-hooks/set-state-in-effect rule here
  // (also covers the mute-from-localStorage mount init just below).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (host.phase === 'question') {
      setRevealed(false)
      setShowStandings(false)
      setBusy(null)
    } else if (host.phase === 'ended') {
      setShowStandings(false)
      setBusy(null)
      try { stopBackgroundMusic() } catch { /* noop */ }
    }
  }, [host.phase])

  // Keep the local mute toggle in sync with the persisted global switch.
  // Seeding from localStorage during the initial render would mismatch
  // hydration, so read the browser value once after mount.
  useEffect(() => { setSoundMuted(isMuted()) }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Background music follows the host's toggle (same behaviour as projector).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (musicOn) { try { playBackgroundMusic() } catch { /* noop */ } }
    else { try { stopBackgroundMusic() } catch { /* noop */ } }
    return () => { try { stopBackgroundMusic() } catch { /* noop */ } }
  }, [musicOn])

  // ── Pairing (account-based) ──────────────────────────────────────────────
  // Once the socket connects: a deep link (?code=) takes control of that
  // session; otherwise list the user's live sessions and auto-connect if there
  // is exactly one, else show the picker. Identity (the auth cookie on the
  // socket) is the gate — no PIN.
  const { connected: hostConnected, sessionState: hostSessionState, listMySessions, takeControl } = host
  useEffect(() => {
    if (!hostConnected || hostSessionState) return
    let cancelled = false
    void (async () => {
      if (deepLinkCode) {
        setGameCode(deepLinkCode)
        takeControl({ gameCode: deepLinkCode })
        return
      }
      const list = await listMySessions()
      if (cancelled) return
      setMySessions(list)
      if (list.length === 1) {
        setGameCode(list[0].gameCode)
        takeControl({ gameCode: list[0].gameCode })
      }
    })()
    return () => { cancelled = true }
  }, [hostConnected, hostSessionState, deepLinkCode, listMySessions, takeControl])

  const handlePick = useCallback((code: string) => {
    setGameCode(code)
    host.takeControl({ gameCode: code })
    // Do NOT optimistically mark paired — stay on the picker until the server
    // replies with a session_state (success) or host_remote_error (banner).
  }, [host])

  const handleRefresh = useCallback(async () => {
    setMySessions(await host.listMySessions())
  }, [host])

  // ── Action handlers (each emits, sets a bridge flag, arms a busy gate) ───
  const handleStart = useCallback(() => {
    if (busy) return
    setBusy('start')
    setStarted(true)
    host.startQuiz()
  }, [busy, host])

  const handleReveal = useCallback(async () => {
    if (busy) return
    setBusy('reveal')
    // endQuestion is the ack-wrapped one-shot; on success the server's
    // question_ended event lands explanation in the hook.
    const ok = await host.endQuestion()
    if (ok) setRevealed(true)
    else setBusy(null)
  }, [busy, host])

  const handleStandings = useCallback(() => {
    if (busy) return
    setBusy('standings')
    setShowStandings(true)
    host.showStandings()
  }, [busy, host])

  const handleNext = useCallback(() => {
    if (busy) return
    setBusy('next')
    setShowStandings(false)
    setRevealed(false)
    host.nextQuestion()
  }, [busy, host])

  const handleEndSession = useCallback(() => {
    if (busy) return
    setBusy('end')
    host.endSession()
  }, [busy, host])

  const handlePauseToggle = useCallback(() => {
    if (paused) { setPaused(false); host.resumeQuiz() }
    else { setPaused(true); host.pauseQuiz() }
  }, [paused, host])

  const handleSoundToggle = useCallback(() => {
    const next = toggleMuted()
    setSoundMuted(next)
  }, [])

  const handleMusicToggle = useCallback(() => setMusicOn(v => !v), [])
  const handleMirrorToggle = useCallback(() => {
    setMirrorOn(v => {
      const next = !v
      host.toggleMirror(next)
      return next
    })
  }, [host])

  // ── Derived leaderboard rows for standings / ended ───────────────────────
  const standingsRows = useMemo(
    () => buildLeaderboardStageRows(host.leaderboard),
    [host.leaderboard],
  )

  // ── Auth gate (graceful client prompt — host/layout.tsx also runs auth()) ─
  if (status === 'loading') {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
        <p className="font-display text-sm" style={{ color: 'var(--color-text-muted)' }}>Checking sign-in…</p>
      </div>
    )
  }
  if (status === 'unauthenticated') {
    return <SignInPrompt onSignIn={() => signIn()} />
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (view === 'picker') {
    return (
      <RemoteSessionPicker
        sessions={mySessions}
        loading={host.error === null && (!!deepLinkCode || mySessions === null)}
        connected={host.connected}
        error={host.error}
        onPick={handlePick}
        onRefresh={handleRefresh}
        logo={<QuizoticLogo variant="onLight" className="text-xl" markSize={28} />}
      />
    )
  }

  if (view === 'lobby') {
    return (
      <RemoteLobby
        gameCode={gameCode}
        connectedCount={host.sessionState?.connectedCount ?? 0}
        socketConnected={host.connected}
        busy={busy === 'start'}
        onStart={handleStart}
        soundMuted={soundMuted}
        onToggleSound={handleSoundToggle}
        onToggleMusic={handleMusicToggle}
        musicOn={musicOn}
        onEndSession={handleEndSession}
      />
    )
  }

  if (view === 'standings') {
    return (
      <RemoteStandings
        rows={standingsRows}
        teamLeaderboard={host.teamLeaderboard}
        standingsRecommended={host.standingsRecommended}
        busy={busy === 'next'}
        onNext={handleNext}
        soundMuted={soundMuted}
        onToggleSound={handleSoundToggle}
      />
    )
  }

  if (view === 'ended') {
    return (
      <RemoteEnded
        rows={standingsRows}
        teamLeaderboard={host.teamLeaderboard}
        busy={busy === 'end'}
        onEndSession={handleEndSession}
      />
    )
  }

  // view === 'question' (default once started)
  // questionEnded = the server has closed the question (explanation arrived).
  const questionEnded = host.explanation !== null || revealed
  const connectedCount = host.sessionState?.connectedCount ?? 0
  const action = getPostQuestionAction({
    sessionMode: 'competitive', // projector default; hook doesn't expose mode
    isScored: true,             // scored MCQ is the dominant case for the remote
    questionEnded,
    correctRevealed: revealed,
    isLastQuestion: false,      // we can't know the total from the hook; the
                                // projector owns end-of-quiz detection. The
                                // remote always offers Next; if it's truly the
                                // last question the server ends the session and
                                // view flips to 'ended' on session_ended.
    answered: host.answerCount,
    connectedCount,
  })

  return (
    <RemoteQuestion
      phase="question"
      questionIndex={host.questionIndex}
      questionEnded={questionEnded}
      action={action}
      answerCount={host.answerCount}
      connectedCount={connectedCount}
      optionCounts={host.optionCounts}
      explanation={host.explanation}
      paused={paused}
      socketConnected={host.connected}
      busy={busy}
      onReveal={handleReveal}
      onNext={handleNext}
      onStandings={handleStandings}
      onEndSession={handleEndSession}
      onPauseToggle={handlePauseToggle}
      soundMuted={soundMuted}
      onToggleSound={handleSoundToggle}
      onToggleMusic={handleMusicToggle}
      musicOn={musicOn}
      onToggleMirror={handleMirrorToggle}
      mirrorOn={mirrorOn}
      standingsRows={standingsRows}
      teamLeaderboard={host.teamLeaderboard}
      standingsRecommended={host.standingsRecommended}
    />
  )
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      className="min-h-svh flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: 'var(--color-paper)' }}
    >
      <QuizoticLogo variant="onLight" className="text-2xl" markSize={32} />
      <div>
        <h1 className="font-display text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
          Host sign-in required
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Sign in to drive your live session from this phone.
        </p>
      </div>
      <button
        onClick={onSignIn}
        className="w-full max-w-xs rounded-2xl py-4 text-base font-black font-display"
        style={{
          background: 'var(--color-yellow)',
          color: 'var(--color-primary)',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 4px 0 var(--color-primary)',
        }}
      >
        Sign in
      </button>
    </div>
  )
}
