'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import type { PublicLiveSessionSnapshot } from '@/lib/live-control'

interface EmbedLiveViewProps {
  gameCode: string
  /** Initial server-rendered snapshot; null when the session isn't live yet. */
  initialSnapshot: PublicLiveSessionSnapshot | null
}

const POLL_INTERVAL_MS = 1500

/**
 * Audience-facing live view, designed to be iframed onto a PowerPoint slide
 * or Google Slides sidebar during present mode. Renders whatever phase the
 * live session is in:
 *   - lobby      → join QR + game code + "waiting for host"
 *   - question   → question text + options (no correct-answer highlight) +
 *                  optional per-option bar chart + countdown
 *   - standings  → "revealing results" interstitial
 *   - ended      → "quiz ended" + participant count
 *
 * Polls the public snapshot endpoint rather than subscribing over Socket.IO
 * so it works inside the Google Apps Script sandbox (which can't speak
 * sockets) and stays a tiny bundle. The host drives phase transitions via
 * the HTTP control API or the host UI; this view just reflects them.
 */
export function EmbedLiveView({ gameCode, initialSnapshot }: EmbedLiveViewProps) {
  const [snapshot, setSnapshot] = useState<PublicLiveSessionSnapshot | null>(initialSnapshot)
  const [now, setNow] = useState(Date.now())
  const [connectionLost, setConnectionLost] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll the public snapshot endpoint. Stops when the tab is hidden to avoid
  // burning cycles on a slide that isn't visible.
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/embed/snapshot?code=${encodeURIComponent(gameCode)}`, {
          cache: 'no-store',
        })
        if (cancelled) return
        if (res.status === 404) {
          // Session not live — keep showing the lobby/waiting state.
          setSnapshot(null)
          setConnectionLost(false)
          return
        }
        if (!res.ok) throw new Error(`snapshot ${res.status}`)
        const json = (await res.json()) as { data?: PublicLiveSessionSnapshot }
        if (json.data) {
          setSnapshot(json.data)
          setConnectionLost(false)
        }
      } catch {
        if (!cancelled) setConnectionLost(true)
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) {
        // Skip while hidden; resume on visibility change.
        return
      }
      pollTimer.current = setTimeout(async () => {
        await poll()
        scheduleNext()
      }, POLL_INTERVAL_MS)
    }

    scheduleNext()

    const onVisibility = () => {
      if (!document.hidden && !cancelled) {
        if (pollTimer.current) clearTimeout(pollTimer.current)
        scheduleNext()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [gameCode])

  // 1Hz ticker for the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const phase = snapshot?.phase ?? 'lobby'

  return (
    <div className="embed-root">
      <header className="embed-header">
        <span className="embed-mark" aria-hidden>Q</span>
        <span className="embed-title">{snapshot?.title || 'Quizotic Live'}</span>
      </header>

      <main className="embed-main">
        {phase === 'lobby' && <LobbyView gameCode={gameCode} snapshot={snapshot} />}
        {phase === 'question' && (
          <QuestionView snapshot={snapshot} now={now} />
        )}
        {phase === 'standings' && <StandingsView snapshot={snapshot} />}
        {phase === 'ended' && <EndedView snapshot={snapshot} />}
      </main>

      <footer className="embed-footer">
        {snapshot && (
          <span className="embed-meta">
            {snapshot.connectedCount} live
            {snapshot.totalParticipants > snapshot.connectedCount &&
              ` · ${snapshot.totalParticipants} joined`}
          </span>
        )}
        {connectionLost && <span className="embed-warn">reconnecting…</span>}
        <span className="embed-brand">quizotic.live</span>
      </footer>

      <style>{STYLES}</style>
    </div>
  )
}

function LobbyView({
  gameCode,
  snapshot,
}: {
  gameCode: string
  snapshot: PublicLiveSessionSnapshot | null
}) {
  const joinUrl = `https://www.quizotic.live/join?code=${gameCode}`
  return (
    <div className="embed-lobby">
      <div className="embed-qr">
        <QRCode value={joinUrl} size={160} bgColor="transparent" fgColor="#1a1a2e" />
      </div>
      <div className="embed-lobby-text">
        <div className="embed-lobby-label">Join at</div>
        <div className="embed-lobby-url">quizotic.live/join</div>
        <div className="embed-lobby-code-label">Game code</div>
        <div className="embed-lobby-code">{gameCode}</div>
        {snapshot && snapshot.connectedCount > 0 && (
          <div className="embed-lobby-waiting">
            {snapshot.connectedCount} player{snapshot.connectedCount === 1 ? '' : 's'} ready
          </div>
        )}
        {!snapshot && <div className="embed-lobby-waiting">Waiting for host…</div>}
      </div>
    </div>
  )
}

function QuestionView({
  snapshot,
  now,
}: {
  snapshot: PublicLiveSessionSnapshot | null
  now: number
}) {
  if (!snapshot?.question) return <StandingsView snapshot={snapshot} />
  const q = snapshot.question
  const totalAnswered = snapshot.answeredCount
  const totalConnected = Math.max(snapshot.connectedCount, 1)
  const answeredPct = Math.round((totalAnswered / totalConnected) * 100)

  // Countdown from the absolute server deadline.
  let remainingSec: number | null = null
  if (snapshot.questionEndsAt) {
    remainingSec = Math.max(0, Math.ceil((snapshot.questionEndsAt - now) / 1000))
  }

  const optCounts = snapshot.optionCounts ?? []
  const maxCount = Math.max(1, ...optCounts)

  return (
    <div className="embed-question">
      <div className="embed-question-meta">
        <span>
          Q{(snapshot.currentQuestionIndex >= 0 ? snapshot.currentQuestionIndex : 0) + 1}
          {snapshot.totalQuestions > 0 && ` / ${snapshot.totalQuestions}`}
        </span>
        {remainingSec !== null && (
          <span className={`embed-timer ${remainingSec <= 5 ? 'embed-timer-low' : ''}`}>
            ⏱ {remainingSec}s
          </span>
        )}
        <span className="embed-answered">{answeredPct}% answered</span>
      </div>

      <h1 className="embed-question-text">{q.text || 'Question'}</h1>

      {q.imageUrl && (
        <div className="embed-question-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.imageUrl} alt="" />
        </div>
      )}

      <div className={`embed-options ${q.options.length > 4 ? 'embed-options-grid' : ''}`}>
        {q.options.map((opt, i) => {
          const count = optCounts[i] ?? 0
          const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0
          const barW = Math.round((count / maxCount) * 100)
          return (
            <div key={i} className="embed-option">
              <div className="embed-option-bar" style={{ width: `${barW}%` }} />
              <div className="embed-option-content">
                {opt.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.imageUrl} alt="" className="embed-option-img" />
                )}
                <span className="embed-option-text">{opt.text || `Option ${i + 1}`}</span>
                {totalAnswered > 0 && <span className="embed-option-pct">{pct}%</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StandingsView({ snapshot }: { snapshot: PublicLiveSessionSnapshot | null }) {
  return (
    <div className="embed-standings">
      <div className="embed-standings-icon">📊</div>
      <div className="embed-standings-text">
        {snapshot && snapshot.totalQuestions > 0
          ? `Revealing Q${(snapshot.currentQuestionIndex >= 0 ? snapshot.currentQuestionIndex : 0) + 1}`
          : 'Standings'}
      </div>
      {snapshot && (
        <div className="embed-standings-meta">
          {snapshot.answeredCount} of {snapshot.connectedCount} answered
        </div>
      )}
    </div>
  )
}

function EndedView({ snapshot }: { snapshot: PublicLiveSessionSnapshot | null }) {
  return (
    <div className="embed-ended">
      <div className="embed-ended-icon">🏆</div>
      <div className="embed-ended-text">Quiz complete</div>
      {snapshot && snapshot.totalParticipants > 0 && (
        <div className="embed-ended-meta">
          {snapshot.totalParticipants} participant{snapshot.totalParticipants === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────
// Inline CSS so the embed is fully self-contained inside an iframe on a
// foreign origin — no dependency on the global stylesheet loading. Responsive
// to the iframe size Office/Google gives it via clamp() typography.
const STYLES = `
.embed-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;
  padding: clamp(8px, 2vmin, 24px);
}
.embed-header {
  display: flex;
  align-items: center;
  gap: clamp(6px, 1vmin, 14px);
  padding-bottom: clamp(6px, 1vmin, 14px);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.embed-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(22px, 4vmin, 36px);
  height: clamp(22px, 4vmin, 36px);
  border-radius: 8px;
  background: #FBD13B;
  color: #1a1a2e;
  font-weight: 800;
  font-size: clamp(14px, 2.5vmin, 22px);
}
.embed-title {
  font-weight: 600;
  font-size: clamp(13px, 2.2vmin, 20px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.embed-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(8px, 2vmin, 20px) 0;
  min-height: 0;
}
.embed-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: clamp(6px, 1vmin, 12px);
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: clamp(10px, 1.6vmin, 13px);
  opacity: 0.7;
}
.embed-warn { color: #fbbf24; }
.embed-brand { font-weight: 600; }

/* Lobby */
.embed-lobby {
  display: flex;
  align-items: center;
  gap: clamp(16px, 4vmin, 48px);
  flex-wrap: wrap;
  justify-content: center;
}
.embed-qr {
  background: #fff;
  padding: clamp(8px, 1.5vmin, 16px);
  border-radius: 12px;
  line-height: 0;
}
.embed-lobby-text { text-align: left; }
.embed-lobby-label, .embed-lobby-code-label {
  font-size: clamp(11px, 1.8vmin, 15px);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.embed-lobby-url {
  font-size: clamp(16px, 3vmin, 26px);
  font-weight: 600;
  margin-bottom: clamp(8px, 1.5vmin, 16px);
}
.embed-lobby-code {
  font-size: clamp(36px, 9vmin, 80px);
  font-weight: 800;
  letter-spacing: 0.15em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.embed-lobby-waiting {
  margin-top: clamp(6px, 1.5vmin, 14px);
  font-size: clamp(12px, 2vmin, 18px);
  opacity: 0.85;
}

/* Question */
.embed-question {
  width: 100%;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.8vmin, 18px);
}
.embed-question-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: clamp(11px, 1.8vmin, 16px);
  opacity: 0.85;
}
.embed-timer-low { color: #f87171; font-weight: 700; }
.embed-question-text {
  font-size: clamp(20px, 5vmin, 48px);
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
}
.embed-question-img img {
  max-width: 100%;
  max-height: 30vmin;
  border-radius: 12px;
  object-fit: contain;
}
.embed-options {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.4vmin, 12px);
}
.embed-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.embed-option {
  position: relative;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: clamp(8px, 1.4vmin, 14px);
  overflow: hidden;
  min-height: clamp(36px, 6vmin, 64px);
}
.embed-option-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(251, 209, 59, 0.25);
  transition: width 0.4s ease;
}
.embed-option-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.5vmin, 16px);
  padding: clamp(8px, 1.6vmin, 16px) clamp(10px, 2vmin, 22px);
  height: 100%;
}
.embed-option-img {
  width: clamp(28px, 5vmin, 48px);
  height: clamp(28px, 5vmin, 48px);
  border-radius: 8px;
  object-fit: cover;
}
.embed-option-text {
  flex: 1;
  font-size: clamp(13px, 2.6vmin, 22px);
  font-weight: 500;
}
.embed-option-pct {
  font-size: clamp(12px, 2.2vmin, 18px);
  font-weight: 700;
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
}

/* Standings + Ended (centered interstitials) */
.embed-standings, .embed-ended {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.5vmin, 16px);
  text-align: center;
}
.embed-standings-icon, .embed-ended-icon {
  font-size: clamp(40px, 10vmin, 96px);
  line-height: 1;
}
.embed-standings-text, .embed-ended-text {
  font-size: clamp(20px, 5vmin, 44px);
  font-weight: 700;
}
.embed-standings-meta, .embed-ended-meta {
  font-size: clamp(12px, 2vmin, 18px);
  opacity: 0.75;
}
`
