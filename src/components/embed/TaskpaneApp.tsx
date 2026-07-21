'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import type { LiveSessionSnapshot, LiveControlAction } from '@/lib/live-control'

interface QuizSummary {
  id: string
  title: string
  subject?: string | null
}

interface CreatedSession {
  gameCode: string
  hostControlToken: string
  joinUrl: string
  embedUrl: string
}

const STORAGE_KEY = 'quizotic_taskpane_api_key'
const POLL_INTERVAL_MS = 2000

declare global {
  interface Window {
    // Minimal Office.js typing — full types load from the CDN at runtime.
    Office?: {
      onReady?: (cb: (info: { host: string }) => void) => void
      context?: {
        document?: {
          settings?: {
            get(name: string): unknown
            set(name: string, value: unknown): void
            saveAsync(cb?: () => void): void
          }
        }
      }
      EventType?: { ActiveViewChanged?: string }
    }
  }
}

/**
 * PowerPoint taskpane host control surface. Five-step flow:
 *   1. Connect    — paste API key (issued at quizotic.live/host/settings)
 *   2. Pick quiz  — list the host's quizzes
 *   3. Start      — mint a live session, get the game code
 *   4. Insert     — write the code + QR onto the current slide via Office.js
 *   5. Control    — start / next / end-question / standings / end buttons
 *
 * Uses the HTTP control API exclusively — no Socket.IO subscription — so it
 * works identically in PowerPoint for Web, Mac, and Windows without worrying
 * about socket-handshake cookie origin issues. Live state is read by polling
 * the owner snapshot endpoint every 2s.
 */
export function TaskpaneApp() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)

  const [session, setSession] = useState<CreatedSession | null>(null)
  const [snapshot, setSnapshot] = useState<LiveSessionSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [officeReady, setOfficeReady] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Boot: hydrate API key from localStorage, init Office.js.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (stored) setApiKey(stored)

    if (typeof window !== 'undefined' && window.Office?.onReady) {
      window.Office.onReady(() => setOfficeReady(true))
    } else {
      // Running outside Office (e.g. browser dev) — still allow the flow.
      setOfficeReady(true)
    }
  }, [])

  // When API key becomes available, load the quiz list.
  useEffect(() => {
    if (!apiKey) return
    setLoadingQuizzes(true)
    fetch('/api/v1/quizzes?limit=50', { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load quizzes (${res.status})`)
        const json = (await res.json()) as { data?: QuizSummary[] }
        setQuizzes(json.data ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingQuizzes(false))
  }, [apiKey])

  // Poll the owner snapshot while a session is live.
  useEffect(() => {
    if (!apiKey || !session) return
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/v1/sessions/${session.gameCode}/snapshot`,
          { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
        )
        if (cancelled) return
        if (res.status === 404) {
          setSnapshot(null)
          return
        }
        if (!res.ok) throw new Error(`snapshot ${res.status}`)
        const json = (await res.json()) as { data?: LiveSessionSnapshot }
        if (json.data) setSnapshot(json.data)
      } catch {
        /* swallow — transient poll failures don't reset the UI */
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      pollTimer.current = setTimeout(async () => {
        await poll()
        scheduleNext()
      }, POLL_INTERVAL_MS)
    }
    scheduleNext()

    return () => {
      cancelled = true
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [apiKey, session])

  const handleConnect = useCallback(async () => {
    setVerifying(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/v1/quizzes?limit=1', {
        headers: { Authorization: `Bearer ${keyInput.trim()}` },
      })
      if (res.status === 401) {
        setAuthError('Invalid API key. Get yours at quizotic.live/host/settings.')
        return
      }
      if (!res.ok) throw new Error(`Verification failed (${res.status})`)
      const key = keyInput.trim()
      window.localStorage.setItem(STORAGE_KEY, key)
      setApiKey(key)
      setKeyInput('')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setVerifying(false)
    }
  }, [keyInput])

  const handleDisconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    setApiKey(null)
    setQuizzes([])
    setSelectedQuizId(null)
    setSession(null)
    setSnapshot(null)
  }, [])

  const handleStart = useCallback(async () => {
    if (!apiKey || !selectedQuizId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ quizId: selectedQuizId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(body.error?.message || `Failed to start session (${res.status})`)
      }
      const json = (await res.json()) as { data?: CreatedSession }
      if (!json.data) throw new Error('No session in response')
      setSession(json.data)
      // Persist the active gameCode in the document so a slideshow entry can
      // re-derive the embed URL without round-tripping to the server.
      if (typeof window !== 'undefined' && window.Office?.context?.document?.settings) {
        window.Office.context.document.settings.set('quizotic_game_code', json.data.gameCode)
        window.Office.context.document.settings.saveAsync()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed')
    } finally {
      setBusy(false)
    }
  }, [apiKey, selectedQuizId])

  const handleControl = useCallback(
    async (action: LiveControlAction) => {
      if (!apiKey || !session) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/sessions/${session.gameCode}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ action }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
          throw new Error(body.error?.message || `${action} failed (${res.status})`)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `${action} failed`)
      } finally {
        setBusy(false)
      }
    },
    [apiKey, session]
  )

  const handleEnd = useCallback(async () => {
    await handleControl('end')
    setSession(null)
    setSnapshot(null)
  }, [handleControl])

  // ─── Step 1: connect ───
  if (!apiKey) {
    return (
      <div className="tp-root">
        <header className="tp-header">
          <span className="tp-mark">Q</span>
          <h1>Quizotic</h1>
        </header>
        <div className="tp-body">
          <p className="tp-step-label">Step 1 · Connect your account</p>
          <p className="tp-help">
            Generate an API key at{' '}
            <a href="https://www.quizotic.live/host/settings" target="_blank" rel="noreferrer">
              quizotic.live/host/settings
            </a>{' '}
            and paste it below.
          </p>
          <input
            className="tp-input"
            type="password"
            placeholder="qz_…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            autoFocus
          />
          {authError && <div className="tp-error">{authError}</div>}
          <button
            className="tp-btn tp-btn-primary"
            onClick={handleConnect}
            disabled={!keyInput.trim() || verifying}
          >
            {verifying ? 'Verifying…' : 'Connect'}
          </button>
          {!officeReady && (
            <p className="tp-hint">Initializing Office… (or open this URL in a browser to test)</p>
          )}
        </div>
        <style>{STYLES}</style>
      </div>
    )
  }

  // ─── Step 2-5: main control surface ───
  return (
    <div className="tp-root">
      <header className="tp-header">
        <span className="tp-mark">Q</span>
        <h1>Quizotic</h1>
        <button className="tp-link" onClick={handleDisconnect} title="Disconnect account">
          Sign out
        </button>
      </header>

      <div className="tp-body">
        {error && <div className="tp-error">{error}</div>}

        {!session && (
          <>
            <p className="tp-step-label">Step 2 · Pick a quiz</p>
            {loadingQuizzes ? (
              <p className="tp-hint">Loading your quizzes…</p>
            ) : quizzes.length === 0 ? (
              <p className="tp-hint">
                No quizzes yet. Create one at{' '}
                <a href="https://www.quizotic.live/host/build" target="_blank" rel="noreferrer">
                  quizotic.live/host/build
                </a>
                .
              </p>
            ) : (
              <select
                className="tp-select"
                value={selectedQuizId ?? ''}
                onChange={(e) => setSelectedQuizId(e.target.value || null)}
                size={Math.min(8, quizzes.length)}
              >
                <option value="" disabled>
                  Select a quiz…
                </option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                    {q.subject ? ` · ${q.subject}` : ''}
                  </option>
                ))}
              </select>
            )}

            <button
              className="tp-btn tp-btn-primary"
              onClick={handleStart}
              disabled={!selectedQuizId || busy}
              style={{ marginTop: 12 }}
            >
              {busy ? 'Starting…' : 'Start live session'}
            </button>
          </>
        )}

        {session && (
          <SessionControls
            session={session}
            snapshot={snapshot}
            busy={busy}
            onControl={handleControl}
            onEnd={handleEnd}
          />
        )}
      </div>

      <style>{STYLES}</style>
    </div>
  )
}

function SessionControls({
  session,
  snapshot,
  busy,
  onControl,
  onEnd,
}: {
  session: CreatedSession
  snapshot: LiveSessionSnapshot | null
  busy: boolean
  onControl: (a: LiveControlAction) => void
  onEnd: () => void
}) {
  const phase = snapshot?.phase ?? 'lobby'
  const qi = snapshot?.currentQuestionIndex ?? -1
  const total = snapshot?.totalQuestions ?? 0
  const connected = snapshot?.connectedCount ?? 0
  const answered = snapshot?.answeredCount ?? 0

  return (
    <>
      <div className="tp-session-card">
        <div className="tp-session-qr">
          <QRCode value={session.joinUrl} size={88} bgColor="transparent" fgColor="#1a1a2e" />
        </div>
        <div>
          <div className="tp-session-label">Game code</div>
          <div className="tp-session-code">{session.gameCode}</div>
          <a
            className="tp-link"
            href={session.joinUrl}
            target="_blank"
            rel="noreferrer"
          >
            {session.joinUrl.replace(/^https?:\/\//, '')}
          </a>
        </div>
      </div>

      <div className="tp-status">
        <span className={`tp-phase tp-phase-${phase}`}>
          {phase === 'lobby' && '🟢 Lobby'}
          {phase === 'active' && '▶ Live'}
          {phase === 'ended' && '✓ Ended'}
        </span>
        {phase === 'active' && total > 0 && (
          <span className="tp-progress">
            Q{qi + 1} / {total}
          </span>
        )}
      </div>

      {(phase === 'active' || phase === 'lobby') && (
        <div className="tp-stats">
          <div>
            <div className="tp-stat-num">{connected}</div>
            <div className="tp-stat-label">live</div>
          </div>
          <div>
            <div className="tp-stat-num">{answered}</div>
            <div className="tp-stat-label">answered</div>
          </div>
        </div>
      )}

      <div className="tp-controls">
        {phase === 'lobby' && (
          <button
            className="tp-btn tp-btn-primary"
            onClick={() => onControl('start')}
            disabled={busy}
          >
            Start quiz
          </button>
        )}
        {phase === 'active' && (
          <>
            <button
              className="tp-btn"
              onClick={() => onControl('end_question')}
              disabled={busy}
            >
              Reveal answer
            </button>
            <button
              className="tp-btn tp-btn-primary"
              onClick={() => onControl('next')}
              disabled={busy}
            >
              {qi + 1 >= total ? 'Finish' : 'Next question →'}
            </button>
            <button
              className="tp-btn tp-btn-ghost"
              onClick={() => onControl('show_standings')}
              disabled={busy}
            >
              Show standings
            </button>
          </>
        )}
        <button className="tp-btn tp-btn-danger" onClick={onEnd} disabled={busy}>
          End session
        </button>
      </div>
    </>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────
const STYLES = `
.tp-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #fafafa;
  color: #1a1a2e;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-size: 14px;
}
.tp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #1a1a2e;
  color: #fff;
}
.tp-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #FBD13B;
  color: #1a1a2e;
  font-weight: 800;
  font-size: 16px;
}
.tp-header h1 { font-size: 16px; font-weight: 700; margin: 0; flex: 1; }
.tp-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.tp-step-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  margin: 0 0 4px;
}
.tp-help, .tp-hint { font-size: 13px; color: #4b5563; line-height: 1.4; margin: 0 0 8px; }
.tp-help a, .tp-hint a { color: #4f46e5; }
.tp-input, .tp-select {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 14px;
  font-family: inherit;
  background: #fff;
  box-sizing: border-box;
}
.tp-input:focus, .tp-select:focus { outline: 2px solid #4f46e5; border-color: transparent; }
.tp-select { overflow: auto; }
.tp-btn {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #1a1a2e;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.tp-btn:hover:not(:disabled) { background: #f3f4f6; }
.tp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-btn-primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.tp-btn-primary:hover:not(:disabled) { background: #4338ca; }
.tp-btn-danger { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.tp-btn-danger:hover:not(:disabled) { background: #fee2e2; }
.tp-btn-ghost { background: transparent; }
.tp-link {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  padding: 0;
}
.tp-link:hover { color: #4f46e5; }
.tp-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
}
.tp-session-card {
  display: flex;
  gap: 14px;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
}
.tp-session-qr { background: #fff; padding: 4px; border-radius: 6px; line-height: 0; }
.tp-session-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
.tp-session-code { font-size: 28px; font-weight: 800; letter-spacing: 0.1em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tp-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
}
.tp-phase { font-weight: 600; font-size: 13px; }
.tp-phase-lobby { color: #059669; }
.tp-phase-active { color: #4f46e5; }
.tp-phase-ended { color: #6b7280; }
.tp-progress { font-size: 13px; color: #6b7280; }
.tp-stats {
  display: flex;
  gap: 12px;
  margin: 4px 0 12px;
}
.tp-stats > div {
  flex: 1;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}
.tp-stat-num { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
.tp-stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
.tp-controls { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
`
