'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

const modes = [
  {
    id: 'quiz',
    label: 'I want to test knowledge',
    icon: '🎯',
    title: 'Live Quizzes',
    color: '#4361EE',
    bg: '#F0F4FF',
    features: [
      { label: 'Best for', value: 'Testing, revision, assessment, certification' },
      { label: 'Scoring', value: 'Points, leaderboards, streaks, speed bonus' },
      { label: 'Question types', value: 'MCQ, True/False, Case Study, Ranking, Open-ended' },
      { label: 'Use when', value: '"Did they learn it?" — measure comprehension after teaching' },
      { label: 'Example', value: 'End-of-chapter revision, compliance assessment, entrance exam prep' },
    ],
    examples: ['Chapter revision test', 'Compliance training quiz', 'Science Olympiad practice', 'Weekly concept check'],
  },
  {
    id: 'presentation',
    label: 'I want to engage my audience',
    icon: '📊',
    title: 'Interactive Presentations',
    color: '#FF6B6B',
    bg: '#FFF5F5',
    features: [
      { label: 'Best for', value: 'Gathering opinions, brainstorming, feedback, icebreakers' },
      { label: 'Scoring', value: 'No scores — participation only, safe space for opinions' },
      { label: 'Slide types', value: 'Polls, Word Cloud, Rating, Pinpoint, Q&A, Emoji Pulse' },
      { label: 'Use when', value: '"What do they think?" — collect input during a session' },
      { label: 'Example', value: 'Conference feedback, team retrospective, class brainstorming' },
    ],
    examples: ['Conference live poll', 'Team retrospective', 'Brainstorming session', 'Event audience check-in'],
  },
]

export function QuizVsPresentation() {
  const [active, setActive] = useState<'quiz' | 'presentation'>('quiz')
  const mode = modes.find(m => m.id === active)!

  return (
    <section className="py-20 md:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div {...fadeUp} className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#FF6B6B' }}>
            Quiz or Presentation?
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Which One Do You Need?
          </h2>
          <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: '#4A5568' }}>
            Not sure? Here&apos;s a quick guide to help you choose the right tool.
          </p>
        </motion.div>

        {/* Toggle tabs */}
        <motion.div {...fadeUp} className="flex justify-center mb-10">
          <div className="inline-flex rounded-2xl p-1" style={{ background: '#F1F5F9' }}>
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setActive(m.id as 'quiz' | 'presentation')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: active === m.id ? m.color : 'transparent',
                  color: active === m.id ? '#fff' : '#64748B',
                }}
              >
                <span>{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.title}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <div className="grid md:grid-cols-3 gap-8 items-start">
              {/* Feature details */}
              <div className="md:col-span-2 rounded-2xl p-6 md:p-8" style={{ background: mode.bg, border: `1.5px solid ${mode.color}20` }}>
                <h3 className="text-2xl font-black mb-6 flex items-center gap-3" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                  <span>{mode.icon}</span> {mode.title}
                </h3>
                <div className="space-y-4">
                  {mode.features.map(f => (
                    <div key={f.label} className="flex gap-3">
                      <span className="text-xs font-bold uppercase tracking-wide mt-0.5 w-28 flex-shrink-0" style={{ color: mode.color }}>
                        {f.label}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Example use cases */}
                <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${mode.color}20` }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: mode.color }}>Popular use cases</p>
                  <div className="flex flex-wrap gap-2">
                    {mode.examples.map(ex => (
                      <span key={ex} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#fff', color: mode.color, border: `1px solid ${mode.color}30` }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pro tip card */}
              <div className="flex flex-col items-center justify-center">
                <div className="rounded-2xl p-5 w-full" style={{ background: active === 'quiz' ? '#F0F4FF' : '#FFF5F5', border: `1.5px solid ${mode.color}20` }}>
                  <div className="text-3xl mb-3 text-center">💡</div>
                  <p className="text-sm font-bold mb-2 text-center" style={{ color: '#1B2559' }}>Pro Tip</p>
                  <p className="text-sm leading-relaxed text-center" style={{ color: '#4A5568' }}>
                    {active === 'quiz'
                      ? 'Start with a quiz — students love the competition! Streaks and leaderboards drive repeat engagement.'
                      : 'Use word clouds as icebreakers — they get everyone involved instantly. Great for large audiences.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
