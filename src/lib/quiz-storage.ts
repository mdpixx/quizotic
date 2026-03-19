import type { Quiz } from './quiz-types'

const QUIZZES_KEY = 'quizotic_quizzes'
const SESSION_KEY = 'quizotic_active_session'

export function loadQuizzes(): Quiz[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUIZZES_KEY) ?? '[]')
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
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
