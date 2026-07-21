// Typed client for the live-session control surface that server.mjs exposes
// via globalThis.__quizoticLiveControl. The custom Node server and Next.js
// route handlers run in the SAME process, but Next bundles its routes
// separately, so a plain module export from server.mjs is not importable.
// The globalThis bridge (same pattern as __quizoticNudgeAsyncSweep) is the
// channel. Optional chaining keeps every call a safe no-op (returning a
// not-found / unavailable shape) in tests and any context where the custom
// server isn't running — e.g. Vitest unit tests, or a serverless deploy.
//
// All auth + ownership is enforced by the CALLING route (Bearer API key →
// userId match) before these functions are invoked, mirroring how isHostSocket
// gates the socket path. These functions trust their caller.

export type LiveControlAction =
  | 'start'
  | 'next'
  | 'end_question'
  | 'show_standings'
  | 'end'

export interface CreateLiveSessionInput {
  userId: string
  /** Quiz payload in the same shape create_session accepts over the socket. */
  quizData: {
    id?: string | null
    title?: string
    questions: unknown[]
  }
  sessionMode?: string
  anonymousMode?: boolean
  teamMode?: boolean
  teamCount?: number
  ghostSessionId?: string
  displayMode?: string
  /** Socket id that should become the primary host surface (null for HTTP). */
  primaryHostSocketId?: string | null
}

export interface CreateLiveSessionResult {
  ok: boolean
  gameCode?: string
  hostResumeToken?: string
  error?: string
}

export interface ControlLiveSessionInput {
  action: LiveControlAction
  gameCode: string
  /** Label for logs, e.g. 'http:add-in'. */
  actor: string
}

export interface ControlLiveSessionResult {
  ok: boolean
  status?: string
  currentQuestionIndex?: number
  ended?: boolean
  questionIndex?: number
  error?: string
}

export interface LiveQuestionOption {
  text: string
  imageUrl: string | null
}

export interface LiveQuestion {
  id: string
  type: string
  text: string
  imageUrl: string | null
  timerSeconds: number
  points: number
  options: LiveQuestionOption[]
  rankingShuffle: number[] | null
}

export interface LiveLeaderboardEntry {
  rank: number
  name: string
  archetype: string | null
  score: number
  team: { index: number; name: string; color: string } | null
}

export interface LiveTeamLeaderboardEntry {
  name: string
  color: string
  score: number
  members: number
}

export interface LiveSessionSnapshot {
  gameCode: string
  /** 'lobby' | 'active' | 'ended' — mirrors the in-memory session status. */
  phase: string
  questionEnded: boolean
  type: string
  title: string
  currentQuestionIndex: number
  totalQuestions: number
  question: LiveQuestion | null
  optionCounts: number[] | null
  answeredCount: number
  connectedCount: number
  leaderboard: LiveLeaderboardEntry[]
  teamLeaderboard: LiveTeamLeaderboardEntry[] | null
  serverTimestamp: number
  questionEndsAt: number | null
  questionStartedAt: number | null
}

/**
 * Public, unauthenticated snapshot — for the on-slide embed view. Strips
 * leaderboard entries (only counts) and any host-only detail. Safe for any
 * audience observer to read.
 */
export interface PublicLiveSessionSnapshot {
  gameCode: string
  /** 'lobby' | 'question' | 'standings' | 'ended' */
  phase: string
  title: string
  connectedCount: number
  totalParticipants: number
  question: LiveQuestion | null
  optionCounts: number[] | null
  answeredCount: number
  currentQuestionIndex: number
  totalQuestions: number
  questionEndsAt: number | null
  questionStartedAt: number | null
  serverTimestamp: number
}

interface LiveControlBridge {
  createLiveSession: (input: CreateLiveSessionInput) => Promise<CreateLiveSessionResult>
  controlLiveSession: (input: ControlLiveSessionInput) => Promise<ControlLiveSessionResult>
  snapshotLiveSession: (gameCode: string) => LiveSessionSnapshot | null
  publicSnapshotLiveSession: (gameCode: string) => PublicLiveSessionSnapshot | null
  getSessionOwner: (gameCode: string) => string | null
  hasLiveSession: (gameCode: string) => boolean
}

function bridge(): LiveControlBridge | null {
  const g = globalThis as unknown as { __quizoticLiveControl?: LiveControlBridge }
  return g.__quizoticLiveControl ?? null
}

/** True when the custom server is running and the bridge is registered. */
export function isLiveControlAvailable(): boolean {
  return bridge() !== null
}

/**
 * Create a live session on behalf of a host. The caller MUST have already
 * authenticated the user and (for owned quizzes) verified ownership — this
 * function does not re-check. Returns the new gameCode + resume token.
 */
export async function createLiveSession(
  input: CreateLiveSessionInput
): Promise<CreateLiveSessionResult> {
  const b = bridge()
  if (!b) {
    return {
      ok: false,
      error: 'Live session control is unavailable (custom server not running).',
    }
  }
  return b.createLiveSession(input)
}

/**
 * Drive a live session with a host action. The caller MUST verify the
 * requesting user owns the session (see sessionOwnerMatches) before calling.
 */
export async function controlLiveSession(
  input: ControlLiveSessionInput
): Promise<ControlLiveSessionResult> {
  const b = bridge()
  if (!b) {
    return { ok: false, error: 'Live session control is unavailable.' }
  }
  return b.controlLiveSession(input)
}

/**
 * Read-only snapshot of a live session. Safe to expose to any observer —
 * contains no correct-answer keys, no participant PII beyond display names,
 * and only top-5 leaderboard (already public on the projector).
 */
export function snapshotLiveSession(gameCode: string): LiveSessionSnapshot | null {
  const b = bridge()
  if (!b) return null
  return b.snapshotLiveSession(gameCode)
}

/**
 * Returns true if `userId` owns the live session at `gameCode`. Use this to
 * gate control + snapshot calls in routes before delegating to the bridge.
 */
export function sessionOwnerMatches(gameCode: string, userId: string): boolean {
  const b = bridge()
  if (!b) return false
  const owner = b.getSessionOwner(gameCode)
  return !!owner && owner === userId
}

/** Whether a live (in-memory) session exists for the given code. */
export function hasLiveSession(gameCode: string): boolean {
  const b = bridge()
  return b ? b.hasLiveSession(gameCode) : false
}

/**
 * Public, unauthenticated snapshot — safe for any observer. Strips PII vs
 * snapshotLiveSession. Used by the on-slide embed view.
 */
export function publicSnapshotLiveSession(gameCode: string): PublicLiveSessionSnapshot | null {
  const b = bridge()
  if (!b) return null
  return b.publicSnapshotLiveSession(gameCode)
}
