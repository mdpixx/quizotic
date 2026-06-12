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

export function setActiveSession(quiz: Quiz): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(quiz))
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
