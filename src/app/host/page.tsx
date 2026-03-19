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
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Host</span>
        </span>
        <button
          onClick={() => router.push('/host/create')}
          className="px-4 py-2 bg-lime-400 text-zinc-950 font-bold rounded-lg hover:bg-lime-300 transition-colors text-sm"
        >
          + Create New Quiz
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {quizzes.length === 0 ? (
          <div className="text-center space-y-4 py-20">
            <p className="text-4xl">📋</p>
            <h2 className="text-xl font-semibold">No quizzes yet</h2>
            <p className="text-zinc-400 text-sm">Create your first quiz to get started.</p>
            <button
              onClick={() => router.push('/host/create')}
              className="px-6 py-3 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 transition-colors"
            >
              Create Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Quizzes</h1>
            <div className="space-y-3">
              {quizzes.map(quiz => (
                <div
                  key={quiz.id}
                  onClick={() => setSelected(quiz.id === selected ? null : quiz.id)}
                  className={`rounded-xl p-5 border cursor-pointer transition-all ${
                    selected === quiz.id
                      ? 'border-lime-400 bg-lime-400/5'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{quiz.title}</h3>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                        {quiz.subject && ` · ${quiz.subject}`}
                        {quiz.language && quiz.language !== 'English' && ` · ${quiz.language}`}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(quiz.id) }}
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs px-2 py-1 flex-shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <button
                onClick={handleStartSession}
                className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
              >
                Start Session →
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
