'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { ModeExplainerCard } from '@/components/host/ModeExplainerCard'
import { track } from '@/lib/analytics'
import { QUIZ_TEMPLATES } from '@/lib/quiz-templates'
import { saveQuiz, setActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

export function DashboardOnboarding() {
  const router = useRouter()

  function hostDemoSession() {
    const template = QUIZ_TEMPLATES.find(item => item.id === 'icebreaker-trivia') ?? QUIZ_TEMPLATES[0]
    if (!template) return
    const now = new Date().toISOString()
    const demoQuiz: Quiz = {
      ...template.quiz,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      questions: template.quiz.questions.map(question => ({ ...question, id: crypto.randomUUID() })),
    }
    saveQuiz(demoQuiz)
    setActiveSession(demoQuiz)
    track('demo_session_started')
    router.push('/host/session')
  }

  return (
    <div className="p-6 md:p-8" style={{ maxWidth: 900, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-8 pb-4">
        <div className="flex justify-center mb-4">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FBD13B', border: '2px solid #0D0D0D' }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l2 5.5L19.5 11 14 13l-2 5.5L10 13l-5.5-2L10 8.5z" /></svg>
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-black mb-2" style={{ color: 'var(--color-ink)' }}>Welcome to Quizotic!</h1>
        <p className="text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--color-text-muted)' }}>Let&apos;s get your first live session ready.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mx-auto max-w-2xl mt-8 mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeExplainerCard mode="quiz" href="/host/build" />
          <ModeExplainerCard mode="presentation" href="/host/present/create" />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="mx-auto max-w-2xl mb-4">
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #1F2E6C 100%)' }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] mb-1" style={{ color: '#FBD13B' }}>Feel it first</p>
            <h2 className="font-display text-lg font-black leading-tight text-white">Host a demo session right now</h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,.68)' }}>A ready-made icebreaker goes live instantly. Join from your phone to experience the learner view.</p>
          </div>
          <button onClick={hostDemoSession} className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-xl transition-all hover:opacity-90" style={{ background: '#FBD13B', color: '#0F1B3D', border: '2px solid #0F1B3D' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            Go live in 10 seconds
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-auto max-w-2xl mb-10">
        <Link href="/host/templates" className="flex items-center gap-3 rounded-2xl border p-4 transition-all hover:shadow-md" style={{ background: '#fff', borderColor: 'var(--color-line)', textDecoration: 'none' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-paper-2)', color: 'var(--color-ink)' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </span>
          <span className="flex-1 min-w-0"><strong className="block text-sm" style={{ color: 'var(--color-ink)' }}>Browse ready-made templates</strong><span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>{QUIZ_TEMPLATES.length} editable quizzes for schools and teams</span></span>
          <span aria-hidden style={{ color: '#94A3B8' }}>→</span>
        </Link>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="rounded-2xl border p-6" style={{ background: 'var(--color-paper)', borderColor: 'var(--color-line)' }}>
        <h2 className="font-display text-base font-black mb-4 text-center" style={{ color: 'var(--color-ink)' }}>3 steps to go live</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ['1', 'Create', 'Build a quiz or presentation with your content'],
            ['2', 'Host live', 'Start a session and share the join code'],
            ['3', 'Review', 'See engagement and learning evidence'],
          ].map(([step, title, description]) => (
            <div key={step} className="flex flex-col items-center text-center p-3">
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white mb-3" style={{ background: '#0F1B3D' }}>{step}</span>
              <strong className="text-sm mb-1" style={{ color: 'var(--color-ink)' }}>{title}</strong>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
            </div>
          ))}
        </div>
      </motion.div>
      <p className="text-center text-xs mt-6" style={{ color: '#7B879E' }}>Your teaching command center appears after your first session.</p>
    </div>
  )
}
