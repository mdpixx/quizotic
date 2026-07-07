import type { Quiz } from './quiz-types'
import { track } from './analytics'

const QUIZZES_KEY = 'quizotic_quizzes'
const SESSION_KEY = 'quizotic_active_session'

function isValidQuiz(q: unknown): q is Quiz {
  if (!q || typeof q !== 'object') return false
  const obj = q as Record<string, unknown>
  return typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.questions)
}

export function loadQuizzes(): Quiz[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(QUIZZES_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(isValidQuiz)
  } catch {
    return []
  }
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = loadQuizzes()
  const existing = quizzes.findIndex(q => q.id === quiz.id)
  if (existing >= 0) {
    quizzes[existing] = quiz
  } else {
    quizzes.push(quiz)
    // Activation funnel: a quiz id seen for the first time is a creation,
    // whether it came from the builder, AI generation, or a template.
    track('quiz_created', { questionCount: quiz.questions.length })
  }
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function deleteQuiz(id: string): void {
  const quizzes = loadQuizzes().filter(q => q.id !== id)
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

// Fresh-start intent marker. Set whenever the host deliberately picks a quiz
// to host (Start live, Host from My Quizzes, demo). The session page consumes
// it on boot to tell "the host wants a NEW session" apart from "this hosting
// tab reloaded mid-game" — only the reload case may silently resume a
// still-running session (see /host/session host_resume handling).
const START_INTENT_KEY = 'quizotic_start_intent'

export function setActiveSession(quiz: Quiz): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(quiz))
  try {
    sessionStorage.setItem(START_INTENT_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable — the session page falls back to resume-first
  }
}

/**
 * Read-and-clear the fresh-start marker. Returns true when the host arrived
 * via an explicit "host this quiz" action in the last 2 minutes (the marker
 * is per-tab; the TTL guards against a stale marker from an abandoned
 * navigation suppressing reload-recovery much later).
 */
export function consumeStartIntent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(START_INTENT_KEY)
    sessionStorage.removeItem(START_INTENT_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < 2 * 60_000
  } catch {
    return false
  }
}

export function getActiveSession(): Quiz | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidQuiz(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
