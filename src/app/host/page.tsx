'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadQuizzes, deleteQuiz, setActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

export default function HostLibraryPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setQuizzes(loadQuizzes())
  }, [])

  function handleStartSession() {
    const quiz = quizzes.find(q => q.id === selected)
    if (!quiz) return
    setActiveSession(quiz)
    router.push('/host/session')
  }

  function handleDelete(id: string) {
    deleteQuiz(id)
    setQuizzes(loadQuizzes())
    if (selected === id) setSelected(null)
  }

  return (
    <div className="min-h-screen p-4">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10 -mx-4 px-4 mb-6 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">
          Quizo<span className="text-lime-400">tic</span>
        </span>
        <button
          onClick={() => router.push('/host/create')}
          className="bg-lime-400 text-black font-bold rounded-xl px-4 py-2 text-sm hover:bg-lime-300 transition-colors"
        >
          + New Quiz
        </button>
      </header>

      <main className="max-w-2xl mx-auto">
        {quizzes.length === 0 ? (
          <div className="text-center space-y-4 py-20">
            <p className="text-4xl">📋</p>
            <h2 className="text-xl font-semibold text-gray-900">No quizzes yet</h2>
            <p className="text-gray-400 text-sm">Create your first quiz to get started.</p>
            <button
              onClick={() => router.push('/host/create')}
              className="px-6 py-3 bg-lime-400 text-black font-bold rounded-xl hover:bg-lime-300 transition-colors"
            >
              Create Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                onClick={() => setSelected(quiz.id === selected ? null : quiz.id)}
                className={`bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-4 ${
                  selected === quiz.id
                    ? 'border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="rounded-xl bg-indigo-50 w-10 h-10 flex items-center justify-center text-xl flex-shrink-0">
                    📋
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-bold truncate">{quiz.title}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                      {quiz.subject && ` · ${quiz.subject}`}
                      {quiz.language && quiz.language !== 'English' && ` · ${quiz.language}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(quiz.id) }}
                    className="text-gray-400 hover:text-red-400 transition-colors text-xs px-2 py-1"
                  >
                    Delete
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setActiveSession(quiz); router.push('/host/session') }}
                    className="bg-lime-400 text-black font-bold rounded-xl px-4 py-2 text-sm hover:bg-lime-300 transition-colors"
                  >
                    Start →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
